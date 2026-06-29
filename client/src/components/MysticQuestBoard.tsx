import { useMemo } from 'react';

interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

const ACTION_INFO: Record<string, { label: string; icon: string; color: string; key?: string }> = {
  MOVE_N: { label: 'North', icon: '⬆', color: '#66ccff', key: 'W' },
  MOVE_S: { label: 'South', icon: '⬇', color: '#66ccff', key: 'S' },
  MOVE_E: { label: 'East', icon: '➡', color: '#66ccff', key: 'D' },
  MOVE_W: { label: 'West', icon: '⬅', color: '#66ccff', key: 'A' },
  ATTACK: { label: 'Attack', icon: '⚔️', color: '#ff6644', key: 'Q' },
  CAST_FIREBALL: { label: 'Fireball', icon: '🔥', color: '#ff4400', key: 'F' },
  CAST_HEAL: { label: 'Heal', icon: '💚', color: '#44ff88', key: 'H' },
  CAST_SHIELD: { label: 'Shield', icon: '🛡️', color: '#4488ff', key: 'G' },
  GATHER: { label: 'Gather', icon: '💎', color: '#ffdd00', key: 'E' },
  REST: { label: 'Rest', icon: '💤', color: '#aa88ff', key: 'R' },
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

const MONSTER_SPRITES: Record<string, string> = {
  Goblin: '👺',
  Wolf: '🐺',
  Skeleton: '💀',
  Dragon: '🐉',
};

const MONSTER_MAX_HP: Record<string, number> = {
  Goblin: 20, Wolf: 30, Skeleton: 40, Dragon: 80,
};

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="mq-hpbar">
      <div className="mq-hpbar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function ManaBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="mq-manabar">
      <div className="mq-manabar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function MysticQuestBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  const { turn, totalTurns, terrain, whiteHero, blackHero, monsters, resources, pickups } = useMemo(() => {
    const fields: Record<string, string> = {};
    for (const token of boardState.split('|')) {
      const sep = token.indexOf('=');
      if (sep > 0) fields[token.slice(0, sep)] = token.slice(sep + 1);
    }

    const terrainStr = fields['terrain'] || '';
    const heroesStr = fields['heroes'] || '';
    const monstersStr = fields['monsters'] || '';
    const resourcesStr = fields['resources'] || '';
    const pickupsStr = fields['pickups'] || '';

    const parsedTerrain = terrainStr ? terrainStr.split('/').map((row) => row.split('')) : [];
    const heroParts = heroesStr.split('&');
    const wh = heroParts[0] ? parseHero(heroParts[0]) : null;
    const bh = heroParts[1] ? parseHero(heroParts[1]) : null;

    return {
      turn: fields['turn'] || 'w',
      totalTurns: fields['turns'] || '0',
      terrain: parsedTerrain,
      whiteHero: wh,
      blackHero: bh,
      monsters: parseMonsters(monstersStr),
      resources: new Set(resourcesStr ? resourcesStr.split(';').filter(Boolean) : []),
      pickups: new Set(pickupsStr ? pickupsStr.split(';').filter(Boolean) : []),
    };
  }, [boardState]);

  function play(action: string) {
    if (!interactive || !onHumanMove) return;
    if (!legalMoves.includes(action)) return;
    onHumanMove(action);
  }

  function getTileContent(x: number, y: number, cell: string) {
    // Heroes
    if (whiteHero && whiteHero.x === x + 1 && whiteHero.y === y + 1) {
      return { type: 'hero-w' as const, sprite: '🧙', label: 'Red Hero' };
    }
    if (blackHero && blackHero.x === x + 1 && blackHero.y === y + 1) {
      return { type: 'hero-b' as const, sprite: '🧝', label: 'Blue Hero' };
    }
    // Monsters
    const mon = monsters.find((m) => m.x === x + 1 && m.y === y + 1);
    if (mon) return { type: 'monster' as const, sprite: MONSTER_SPRITES[mon.type] || '👾', label: mon.type, monster: mon };
    // Resources & pickups
    const key = `${x},${y}`;
    if (resources.has(key)) return { type: 'resource' as const, sprite: '💎', label: 'Resource' };
    if (pickups.has(key)) return { type: 'pickup' as const, sprite: '📜', label: 'Spell Scroll' };
    return null;
  }

  function tileClass(cell: string) {
    switch (cell) {
      case '#': return 'mq-tile-wall';
      case '^': return 'mq-tile-mountain';
      case '~': return 'mq-tile-water';
      default: return 'mq-tile-grass';
    }
  }

  const activeHero = turn === 'w' ? whiteHero : blackHero;
  const activeName = turn === 'w' ? 'Red' : 'Blue';

  return (
    <div className="mq-board">
      {/* Header */}
      <div className="mq-title-bar">
        <span className="mq-game-title">⚔️ MYSTIC QUEST</span>
        <span className="mq-turn-badge">Turn {totalTurns}/100 · {activeName} Hero</span>
      </div>

      <div className="mq-layout">
        {/* Map grid */}
        <div className="mq-map-area">
          <div className="mq-grid" style={{ gridTemplateColumns: `repeat(${terrain[0]?.length || 12}, 1fr)` }}>
            {terrain.map((row, y) =>
              row.map((cell, x) => {
                const content = getTileContent(x, y, cell);
                const isActiveHeroTile =
                  (turn === 'w' && whiteHero && whiteHero.x === x + 1 && whiteHero.y === y + 1) ||
                  (turn === 'b' && blackHero && blackHero.x === x + 1 && blackHero.y === y + 1);

                return (
                  <div
                    key={`${x}-${y}`}
                    className={`mq-tile ${tileClass(cell)} ${isActiveHeroTile ? 'mq-tile-active' : ''}`}
                    title={`(${x + 1},${y + 1}) ${content?.label || cell}`}
                  >
                    {content && (
                      <div className={`mq-entity mq-entity-${content.type}`}>
                        <span className="mq-sprite">{content.sprite}</span>
                        {content.type === 'monster' && content.monster && (
                          <HpBar
                            current={content.monster.hp}
                            max={MONSTER_MAX_HP[content.monster.type] || 40}
                            color="#ff4444"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Side panel - hero stats */}
        <div className="mq-sidebar">
          {[whiteHero, blackHero].filter(Boolean).map((hero) => {
            if (!hero) return null;
            const isActive = hero.side === turn;
            const label = hero.side === 'w' ? '🧙 Red' : '🧝 Blue';
            const hpColor = hero.hp / hero.maxHp > 0.5 ? '#44ff88' : hero.hp / hero.maxHp > 0.25 ? '#ffaa00' : '#ff4444';
            return (
              <div key={hero.side} className={`mq-hero-card ${isActive ? 'mq-hero-card-active' : ''}`}>
                <div className="mq-hero-header">
                  <span className="mq-hero-name">{label}</span>
                  <span className="mq-hero-level">Lv.{hero.level}</span>
                </div>
                <div className="mq-stat-row">
                  <span className="mq-stat-label">HP</span>
                  <HpBar current={hero.hp} max={hero.maxHp} color={hpColor} />
                  <span className="mq-stat-num">{hero.hp}/{hero.maxHp}</span>
                </div>
                <div className="mq-stat-row">
                  <span className="mq-stat-label">MP</span>
                  <ManaBar current={hero.mana} max={hero.maxMana} />
                  <span className="mq-stat-num">{hero.mana}/{hero.maxMana}</span>
                </div>
                <div className="mq-hero-stats-grid">
                  <span>⚔️ {hero.atk}</span>
                  <span>🛡️ {hero.def}{hero.shieldTurns > 0 ? `+5` : ''}</span>
                  <span>💰 {hero.gold}</span>
                  <span>✨ {hero.xp}xp</span>
                </div>
                {hero.spells.length > 0 && (
                  <div className="mq-hero-spells">
                    {hero.spells.map((s) => (
                      <span key={s} className="mq-spell-badge">{s === 'FIREBALL' ? '🔥' : s === 'HEAL' ? '💚' : '🛡️'}</span>
                    ))}
                  </div>
                )}
                {hero.shieldTurns > 0 && (
                  <div className="mq-buff">🛡️ Shield ({hero.shieldTurns})</div>
                )}
              </div>
            );
          })}

          {/* Monster list */}
          {monsters.length > 0 && (
            <div className="mq-monster-panel">
              <div className="mq-panel-title">Monsters</div>
              {monsters.map((m, i) => (
                <div key={i} className="mq-monster-row">
                  <span className="mq-monster-icon">{MONSTER_SPRITES[m.type] || '👾'}</span>
                  <span className="mq-monster-name">{m.type}</span>
                  <span className="mq-monster-hp">{m.hp}hp</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      {interactive && legalMoves.length > 0 && (
        <div className="mq-action-bar">
          {legalMoves.map((move) => {
            const info = ACTION_INFO[move] || { label: move, icon: '▶', color: '#888' };
            return (
              <button
                key={move}
                className="mq-action-btn"
                onClick={() => play(move)}
                style={{ '--action-color': info.color } as React.CSSProperties}
                title={info.key ? `${info.label} [${info.key}]` : info.label}
              >
                <span className="mq-action-icon">{info.icon}</span>
                <span className="mq-action-label">{info.label}</span>
                {info.key && <span className="mq-action-key">{info.key}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

