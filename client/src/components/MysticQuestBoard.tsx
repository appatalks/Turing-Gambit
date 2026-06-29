interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

const TERRAIN_DISPLAY: Record<string, { symbol: string; label: string }> = {
  '.': { symbol: '·', label: 'Plains' },
  '#': { symbol: '▓', label: 'Wall' },
  '^': { symbol: '▲', label: 'Mountain' },
  '~': { symbol: '≈', label: 'Water' },
};

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  MOVE_N: { label: 'North', icon: '⬆' },
  MOVE_S: { label: 'South', icon: '⬇' },
  MOVE_E: { label: 'East', icon: '➡' },
  MOVE_W: { label: 'West', icon: '⬅' },
  ATTACK: { label: 'Attack', icon: '⚔' },
  CAST_FIREBALL: { label: 'Fireball', icon: '🔥' },
  CAST_HEAL: { label: 'Heal', icon: '💚' },
  CAST_SHIELD: { label: 'Shield', icon: '🛡' },
  GATHER: { label: 'Gather', icon: '💎' },
  REST: { label: 'Rest', icon: '💤' },
};

interface ParsedHero {
  side: string;
  hp: number; maxHp: number;
  atk: number; def: number;
  mana: number; maxMana: number;
  gold: number; x: number; y: number;
  level: number; xp: number;
  shieldTurns: number;
  spells: string[];
}

interface ParsedMonster {
  type: string;
  hp: number; atk: number; def: number; xp: number;
  x: number; y: number;
}

function parseHero(raw: string): ParsedHero | null {
  const parts = raw.split(',');
  if (parts.length < 14) return null;
  return {
    side: parts[0],
    hp: +parts[1], maxHp: +parts[2],
    atk: +parts[3], def: +parts[4],
    mana: +parts[5], maxMana: +parts[6],
    gold: +parts[7], x: +parts[8], y: +parts[9],
    level: +parts[10], xp: +parts[11],
    shieldTurns: +parts[12],
    spells: parts[13] && parts[13] !== '' ? parts[13].split('~') : [],
  };
}

function parseMonsters(raw: string): ParsedMonster[] {
  if (!raw) return [];
  return raw.split(';').filter(Boolean).map((m) => {
    const p = m.split(',');
    return { type: p[0], hp: +p[1], atk: +p[2], def: +p[3], xp: +p[4], x: +p[5], y: +p[6] };
  });
}

export function MysticQuestBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  // Parse: turn=w|turns=5|terrain=............/...|resources=3,4;5,6|pickups=1,2|heroes=w,...|b,...|monsters=Goblin,...;Wolf,...
  const fields: Record<string, string> = {};
  for (const token of boardState.split('|')) {
    const sep = token.indexOf('=');
    if (sep > 0) fields[token.slice(0, sep)] = token.slice(sep + 1);
  }

  const turn = fields['turn'] || 'w';
  const totalTurns = fields['turns'] || '0';
  const terrainStr = fields['terrain'] || '';
  const heroesStr = fields['heroes'] || '';
  const monstersStr = fields['monsters'] || '';
  const resourcesStr = fields['resources'] || '';
  const pickupsStr = fields['pickups'] || '';

  const terrain = terrainStr ? terrainStr.split('/').map((row) => row.split('')) : [];
  const [whRaw, blRaw] = heroesStr.split(/\|(?=[wb],)/);
  const whiteHero = whRaw ? parseHero(whRaw) : null;
  const blackHero = blRaw ? parseHero(blRaw) : null;
  const monsters = parseMonsters(monstersStr);
  const resources = new Set(resourcesStr ? resourcesStr.split(';').filter(Boolean) : []);
  const pickups = new Set(pickupsStr ? pickupsStr.split(';').filter(Boolean) : []);

  const activeHero = turn === 'w' ? whiteHero : blackHero;

  function play(action: string) {
    if (!interactive || !onHumanMove) return;
    if (!legalMoves.includes(action)) return;
    onHumanMove(action);
  }

  function cellDisplay(x: number, y: number, cell: string) {
    // Check for heroes
    if (whiteHero && whiteHero.x === x + 1 && whiteHero.y === y + 1) return { symbol: 'R', cls: 'mq-hero-w' };
    if (blackHero && blackHero.x === x + 1 && blackHero.y === y + 1) return { symbol: 'B', cls: 'mq-hero-b' };
    // Check for monsters
    const mon = monsters.find((m) => m.x === x + 1 && m.y === y + 1);
    if (mon) return { symbol: 'M', cls: 'mq-monster' };
    // Check resources & pickups
    const key = `${x},${y}`;
    if (resources.has(key)) return { symbol: '*', cls: 'mq-resource' };
    if (pickups.has(key)) return { symbol: '$', cls: 'mq-spell' };
    // Terrain
    const t = TERRAIN_DISPLAY[cell] || TERRAIN_DISPLAY['.'];
    return { symbol: t.symbol, cls: `mq-terrain-${cell === '.' ? 'plain' : cell === '#' ? 'wall' : cell === '^' ? 'mountain' : 'water'}` };
  }

  return (
    <div className="mq-wrap">
      <div className="mq-header">
        <span className="mq-title">Mystic Quest</span>
        <span className="mq-turn-info">Turn {totalTurns} — {turn === 'w' ? 'Red' : 'Blue'} to move</span>
      </div>

      <div className="mq-main">
        {/* Map */}
        <div className="mq-map">
          {terrain.map((row, y) => (
            <div key={y} className="mq-row">
              {row.map((cell, x) => {
                const display = cellDisplay(x, y, cell);
                return (
                  <span key={x} className={`mq-cell ${display.cls}`} title={`(${x + 1},${y + 1})`}>
                    {display.symbol}
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mq-stats">
          {[whiteHero, blackHero].filter(Boolean).map((hero) => {
            if (!hero) return null;
            const label = hero.side === 'w' ? 'Red' : 'Blue';
            const isActive = hero.side === turn;
            return (
              <div key={hero.side} className={`mq-hero-stats ${isActive ? 'mq-hero-active' : ''}`}>
                <div className="mq-hero-name">{label} Hero (Lv.{hero.level})</div>
                <div className="mq-stat">❤ {hero.hp}/{hero.maxHp}</div>
                <div className="mq-stat">⚔ ATK {hero.atk} | 🛡 DEF {hero.def}</div>
                <div className="mq-stat">🔮 Mana {hero.mana}/{hero.maxMana}</div>
                <div className="mq-stat">💰 Gold {hero.gold}</div>
                <div className="mq-stat">XP {hero.xp}</div>
                {hero.spells.length > 0 && (
                  <div className="mq-stat">Spells: {hero.spells.join(', ')}</div>
                )}
                {hero.shieldTurns > 0 && (
                  <div className="mq-stat">🛡 Shield ({hero.shieldTurns} turns)</div>
                )}
              </div>
            );
          })}

          {monsters.length > 0 && (
            <div className="mq-monsters-list">
              <div className="mq-section-title">Monsters</div>
              {monsters.map((m, i) => (
                <div key={i} className="mq-monster-entry">
                  {m.type} ({m.x},{m.y}) — {m.hp}HP
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {interactive && legalMoves.length > 0 && (
        <div className="mq-actions">
          {legalMoves.map((move) => {
            const info = ACTION_LABELS[move] || { label: move, icon: '▶' };
            return (
              <button
                key={move}
                className="mq-btn"
                onClick={() => play(move)}
              >
                {info.icon} {info.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
