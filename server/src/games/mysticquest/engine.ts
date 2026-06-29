export type MQColor = 'w' | 'b';
export type MQStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';
export type TerrainBase = '.' | '#' | '^' | '~';
export type SpellName = 'FIREBALL' | 'HEAL' | 'SHIELD';

export interface Hero {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  mana: number;
  maxMana: number;
  gold: number;
  x: number;
  y: number;
  spells: string[];
  level: number;
  xp: number;
}

export interface Monster {
  type: string;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  x: number;
  y: number;
}

interface HeroState extends Hero {
  shieldTurns: number;
}

interface SeenPosition {
  x: number;
  y: number;
}

interface MonsterTemplate {
  type: Monster['type'];
  hp: number;
  atk: number;
  def: number;
  xp: number;
}

const WIDTH = 12;
const HEIGHT = 10;
const VISION_RANGE = 4;
const MAX_TURNS = 100;
const LEVEL_THRESHOLDS = [50, 120, 250] as const;
const SPELLS: SpellName[] = ['FIREBALL', 'HEAL', 'SHIELD'];
const DIRECTIONS = {
  MOVE_N: { dx: 0, dy: -1, label: 'north' },
  MOVE_S: { dx: 0, dy: 1, label: 'south' },
  MOVE_E: { dx: 1, dy: 0, label: 'east' },
  MOVE_W: { dx: -1, dy: 0, label: 'west' },
} as const;

const MONSTERS: Record<string, MonsterTemplate> = {
  Goblin: { type: 'Goblin', hp: 20, atk: 8, def: 2, xp: 15 },
  Wolf: { type: 'Wolf', hp: 30, atk: 12, def: 3, xp: 25 },
  Skeleton: { type: 'Skeleton', hp: 40, atk: 15, def: 5, xp: 40 },
  Dragon: { type: 'Dragon', hp: 80, atk: 25, def: 10, xp: 100 },
};

export class MysticQuestEngine {
  private terrain: TerrainBase[][] = [];
  private resourceNodes = new Set<string>();
  private spellPickups = new Set<string>();
  private monsters: Monster[] = [];
  private heroes: Record<MQColor, HeroState>;
  private currentTurn: MQColor = 'w';
  private totalTurns = 0;
  private generation = 0;
  private lastSeenEnemy: Record<MQColor, SeenPosition | null> = { w: null, b: null };

  constructor() {
    this.heroes = {
      w: this.createHero(0, 0),
      b: this.createHero(0, HEIGHT - 1),
    };
    this.reset();
  }

  reset(): void {
    this.generation += 1;
    const rng = this.createRng(0x4d51c3 + this.generation * 977);

    this.terrain = Array.from({ length: HEIGHT }, () => Array<TerrainBase>(WIDTH).fill('.'));
    this.resourceNodes.clear();
    this.spellPickups.clear();
    this.monsters = [];
    this.currentTurn = 'w';
    this.totalTurns = 0;
    this.lastSeenEnemy = { w: null, b: null };

    const whiteStartX = 2 + Math.floor(rng() * 3);
    const blackStartX = 7 + Math.floor(rng() * 3);
    this.heroes = {
      w: this.createHero(whiteStartX, 0),
      b: this.createHero(blackStartX, HEIGHT - 1),
    };

    const reserved = new Set<string>([
      this.key(this.heroes.w.x, this.heroes.w.y),
      this.key(this.heroes.b.x, this.heroes.b.y),
      this.key(this.heroes.w.x, this.heroes.w.y + 1),
      this.key(this.heroes.b.x, this.heroes.b.y - 1),
      this.key(5, 4),
      this.key(6, 4),
      this.key(5, 5),
      this.key(6, 5),
    ]);

    this.placeImpassableTerrain(rng, reserved);
    this.placeForests(rng, reserved);
    this.placeResources(rng, 4 + Math.floor(rng() * 3));
    this.placeSpellPickups(rng, 3 + Math.floor(rng() * 2));
    this.placeMonsters(rng, 3 + Math.floor(rng() * 3));
  }

  turn(): MQColor {
    return this.currentTurn;
  }

  boardState(): string {
    const terrain = this.terrain.map((row) => row.join('')).join('/');
    const resources = [...this.resourceNodes].sort().join(';');
    const pickups = [...this.spellPickups].sort().join(';');
    const heroState = (side: MQColor): string => {
      const hero = this.heroes[side];
      const seen = this.lastSeenEnemy[side];
      const spells = hero.spells.join('~');
      const seenText = seen ? `${seen.x + 1},${seen.y + 1}` : '-';
      return [
        side,
        hero.hp,
        hero.maxHp,
        hero.atk,
        hero.def,
        hero.mana,
        hero.maxMana,
        hero.gold,
        hero.x + 1,
        hero.y + 1,
        hero.level,
        hero.xp,
        hero.shieldTurns,
        spells,
        seenText,
      ].join(',');
    };
    const monsters = this.monsters
      .map((monster) => [monster.type, monster.hp, monster.atk, monster.def, monster.xp, monster.x + 1, monster.y + 1].join(','))
      .join(';');

    return [
      `turn=${this.currentTurn}`,
      `turns=${this.totalTurns}`,
      `terrain=${terrain}`,
      `resources=${resources}`,
      `pickups=${pickups}`,
      `heroes=${heroState('w')}&${heroState('b')}`,
      `monsters=${monsters}`,
    ].join('|');
  }

  boardForPrompt(side: MQColor = this.currentTurn): string {
    const hero = this.heroes[side];
    const enemySide: MQColor = side === 'w' ? 'b' : 'w';
    const enemy = this.heroes[enemySide];

    if (this.isVisible(hero, enemy.x, enemy.y)) {
      this.lastSeenEnemy[side] = { x: enemy.x, y: enemy.y };
    }

    const minX = Math.max(0, hero.x - VISION_RANGE);
    const maxX = Math.min(WIDTH - 1, hero.x + VISION_RANGE);
    const minY = Math.max(0, hero.y - VISION_RANGE);
    const maxY = Math.min(HEIGHT - 1, hero.y + VISION_RANGE);

    const visibleMonsters = this.monsters
      .filter((monster) => this.isVisible(hero, monster.x, monster.y))
      .sort((a, b) => this.distance(hero.x, hero.y, a.x, a.y) - this.distance(hero.x, hero.y, b.x, b.y) || a.y - b.y || a.x - b.x);

    const header = Array.from({ length: maxX - minX + 1 }, (_, index) => String(minX + index + 1).padStart(2, ' ')).join(' ');
    const rows: string[] = [`   ${header}`];

    for (let y = minY; y <= maxY; y++) {
      const cells: string[] = [];
      for (let x = minX; x <= maxX; x++) {
        if (!this.isVisible(hero, x, y)) {
          cells.push('?');
          continue;
        }
        cells.push(this.displayCell(side, x, y));
      }
      rows.push(`${String(y + 1).padStart(2, ' ')} ${cells.join('  ')}`);
    }

    const nextThreshold = this.nextLevelThreshold(hero.level);
    const xpText = nextThreshold === null ? `${hero.xp}/MAX` : `${hero.xp}/${nextThreshold}`;
    const spellsText = hero.spells.length > 0 ? hero.spells.join(', ') : 'None';
    const nearbyText = visibleMonsters.length > 0
      ? visibleMonsters.map((monster) => `${monster.type} at (${monster.x + 1}, ${monster.y + 1}) [${monster.hp}/${this.maxMonsterHp(monster.type)} HP]`).join('; ')
      : 'None';
    const lastSeen = this.lastSeenEnemy[side];
    const enemySeenText = lastSeen ? `(${lastSeen.x + 1}, ${lastSeen.y + 1})` : 'unknown';
    const heroLabel = side === 'w' ? 'Red' : 'Blue';

    return `=== MYSTIC QUEST — Your Hero (${heroLabel}) ===
HP: ${hero.hp}/${hero.maxHp} | ATK: ${hero.atk} | DEF: ${this.effectiveDefense(hero)} | Mana: ${hero.mana}/${hero.maxMana} | Gold: ${hero.gold} | Level: ${hero.level} (XP: ${xpText})
Spells: ${spellsText}
Position: (${hero.x + 1}, ${hero.y + 1})

--- Visible Map (4-tile vision) ---
${rows.join('\n')}
  (R=You, B=Enemy, M=Monster, *=Resource, $=Spell, ?=Fog)

Nearby: ${nearbyText}
Enemy hero last seen: ${enemySeenText}`;
  }

  legalMoves(): string[] {
    if (this.isGameOver()) return [];

    const hero = this.heroes[this.currentTurn];
    const moves: string[] = [];

    for (const [notation, dir] of Object.entries(DIRECTIONS)) {
      const nx = hero.x + dir.dx;
      const ny = hero.y + dir.dy;
      if (this.canMoveTo(nx, ny)) moves.push(notation);
    }

    if (this.selectAdjacentTarget(hero)) moves.push('ATTACK');
    if (hero.spells.includes('FIREBALL') && hero.mana >= 15 && this.selectFireballTarget(hero)) moves.push('CAST_FIREBALL');
    if (hero.spells.includes('HEAL') && hero.mana >= 10 && hero.hp < hero.maxHp) moves.push('CAST_HEAL');
    if (hero.spells.includes('SHIELD') && hero.mana >= 10 && hero.shieldTurns === 0) moves.push('CAST_SHIELD');
    if (this.resourceNodes.has(this.key(hero.x, hero.y))) moves.push('GATHER');
    moves.push('REST');

    return moves;
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const move = notation.trim().toUpperCase();
    if (!this.legalMoves().includes(move)) return null;

    const side = this.currentTurn;
    const hero = this.heroes[side];
    let result: { san: string; captured?: string } | null = null;

    if (move in DIRECTIONS) {
      const dir = DIRECTIONS[move as keyof typeof DIRECTIONS];
      hero.x += dir.dx;
      hero.y += dir.dy;
      const pickupText = this.collectSpellPickup(hero);
      result = { san: `${this.heroName(side)} moves ${dir.label} to (${hero.x + 1}, ${hero.y + 1})${pickupText}` };
    } else if (move === 'ATTACK') {
      result = this.resolveAttack(side);
    } else if (move === 'CAST_FIREBALL') {
      result = this.resolveFireball(side);
    } else if (move === 'CAST_HEAL') {
      hero.mana -= 10;
      hero.hp = Math.min(hero.maxHp, hero.hp + 25);
      result = { san: `${this.heroName(side)} casts Heal` };
    } else if (move === 'CAST_SHIELD') {
      hero.mana -= 10;
      hero.shieldTurns = 4;
      result = { san: `${this.heroName(side)} casts Shield (+5 DEF)` };
    } else if (move === 'GATHER') {
      this.resourceNodes.delete(this.key(hero.x, hero.y));
      hero.gold += 50;
      result = { san: `${this.heroName(side)} gathers 50 gold` };
    } else if (move === 'REST') {
      hero.mana = Math.min(hero.maxMana, hero.mana + 10);
      hero.hp = Math.min(hero.maxHp, hero.hp + 5);
      result = { san: `${this.heroName(side)} rests` };
    }

    if (!result) return null;

    this.finishTurn(side);
    return result;
  }

  isGameOver(): boolean {
    return this.gameStatus() !== 'active';
  }

  gameStatus(): MQStatus {
    const whiteDead = this.heroes.w.hp <= 0;
    const blackDead = this.heroes.b.hp <= 0;

    if (whiteDead && blackDead) return 'draw';
    if (whiteDead) return 'black_wins';
    if (blackDead) return 'white_wins';

    if (this.totalTurns >= MAX_TURNS) {
      if (this.heroes.w.hp > this.heroes.b.hp) return 'white_wins';
      if (this.heroes.b.hp > this.heroes.w.hp) return 'black_wins';
      return 'draw';
    }

    return 'active';
  }

  private createHero(x: number, y: number): HeroState {
    return {
      hp: 100,
      maxHp: 100,
      atk: 15,
      def: 5,
      mana: 50,
      maxMana: 50,
      gold: 0,
      x,
      y,
      spells: [],
      level: 1,
      xp: 0,
      shieldTurns: 0,
    };
  }

  private createRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
  }

  private isPassable(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const cell = this.terrain[y][x];
    return cell !== '^' && cell !== '~';
  }

  private canMoveTo(x: number, y: number): boolean {
    if (!this.isPassable(x, y)) return false;
    if (this.heroAt(x, y)) return false;
    if (this.monsterAt(x, y)) return false;
    return true;
  }

  private heroAt(x: number, y: number): MQColor | null {
    for (const side of ['w', 'b'] as const) {
      const hero = this.heroes[side];
      if (hero.x === x && hero.y === y) return side;
    }
    return null;
  }

  private monsterAt(x: number, y: number): Monster | null {
    return this.monsters.find((monster) => monster.x === x && monster.y === y) ?? null;
  }

  private terrainDefenseBonus(x: number, y: number): number {
    return this.terrain[y][x] === '#' ? 1 : 0;
  }

  private effectiveDefense(hero: HeroState): number {
    return hero.def + this.terrainDefenseBonus(hero.x, hero.y) + (hero.shieldTurns > 0 ? 5 : 0);
  }

  private isVisible(hero: HeroState, x: number, y: number): boolean {
    return this.distance(hero.x, hero.y, x, y) <= VISION_RANGE;
  }

  private distance(ax: number, ay: number, bx: number, by: number): number {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  private displayCell(viewSide: MQColor, x: number, y: number): string {
    const me = this.heroes[viewSide];
    const foe = this.heroes[viewSide === 'w' ? 'b' : 'w'];
    if (me.x === x && me.y === y) return 'R';
    if (foe.x === x && foe.y === y) return 'B';
    if (this.monsterAt(x, y)) return 'M';
    if (this.resourceNodes.has(this.key(x, y))) return '*';
    if (this.spellPickups.has(this.key(x, y))) return '$';
    return this.terrain[y][x];
  }

  private heroName(side: MQColor): string {
    return side === 'w' ? 'Red Hero' : 'Blue Hero';
  }

  private nextLevelThreshold(level: number): number | null {
    return LEVEL_THRESHOLDS[level - 1] ?? null;
  }

  private maxMonsterHp(type: string): number {
    return MONSTERS[type]?.hp ?? 0;
  }

  private selectAdjacentTarget(hero: HeroState): { kind: 'hero'; side: MQColor } | { kind: 'monster'; monster: Monster } | null {
    const enemySide: MQColor = hero === this.heroes.w ? 'b' : 'w';
    const enemy = this.heroes[enemySide];
    if (this.distance(hero.x, hero.y, enemy.x, enemy.y) === 1) {
      return { kind: 'hero', side: enemySide };
    }

    const monsters = this.monsters
      .filter((monster) => this.distance(hero.x, hero.y, monster.x, monster.y) === 1)
      .sort((a, b) => a.hp - b.hp || a.y - b.y || a.x - b.x);
    return monsters.length > 0 ? { kind: 'monster', monster: monsters[0] } : null;
  }

  private selectFireballTarget(hero: HeroState): { kind: 'hero'; side: MQColor } | { kind: 'monster'; monster: Monster } | null {
    const enemySide: MQColor = hero === this.heroes.w ? 'b' : 'w';
    const enemy = this.heroes[enemySide];
    if (this.distance(hero.x, hero.y, enemy.x, enemy.y) <= 3) {
      return { kind: 'hero', side: enemySide };
    }

    const monsters = this.monsters
      .filter((monster) => this.distance(hero.x, hero.y, monster.x, monster.y) <= 3)
      .sort((a, b) => a.hp - b.hp || a.y - b.y || a.x - b.x);
    return monsters.length > 0 ? { kind: 'monster', monster: monsters[0] } : null;
  }

  private resolveAttack(side: MQColor): { san: string; captured?: string } | null {
    const hero = this.heroes[side];
    const target = this.selectAdjacentTarget(hero);
    if (!target) return null;

    if (target.kind === 'hero') {
      const defender = this.heroes[target.side];
      const damage = Math.max(1, hero.atk - this.effectiveDefense(defender));
      defender.hp = Math.max(0, defender.hp - damage);
      const captured = defender.hp <= 0 ? this.heroName(target.side) : undefined;
      return {
        san: `${this.heroName(side)} attacks ${this.heroName(target.side)} for ${damage}`,
        captured,
      };
    }

    const monster = target.monster;
    const damage = Math.max(1, hero.atk - (monster.def + this.terrainDefenseBonus(monster.x, monster.y)));
    monster.hp = Math.max(0, monster.hp - damage);
    if (monster.hp <= 0) {
      this.monsters = this.monsters.filter((entry) => entry !== monster);
      this.awardXp(hero, monster.xp);
      return {
        san: `${this.heroName(side)} slays ${monster.type} for ${damage}`,
        captured: monster.type,
      };
    }
    return { san: `${this.heroName(side)} attacks ${monster.type} for ${damage}` };
  }

  private resolveFireball(side: MQColor): { san: string; captured?: string } | null {
    const hero = this.heroes[side];
    const target = this.selectFireballTarget(hero);
    if (!target || hero.mana < 15) return null;
    hero.mana -= 15;

    if (target.kind === 'hero') {
      const defender = this.heroes[target.side];
      const damage = Math.max(1, hero.atk + 10 - this.effectiveDefense(defender));
      defender.hp = Math.max(0, defender.hp - damage);
      const captured = defender.hp <= 0 ? this.heroName(target.side) : undefined;
      return {
        san: `${this.heroName(side)} casts Fireball on ${this.heroName(target.side)} for ${damage}`,
        captured,
      };
    }

    const monster = target.monster;
    const damage = Math.max(1, hero.atk + 10 - (monster.def + this.terrainDefenseBonus(monster.x, monster.y)));
    monster.hp = Math.max(0, monster.hp - damage);
    if (monster.hp <= 0) {
      this.monsters = this.monsters.filter((entry) => entry !== monster);
      this.awardXp(hero, monster.xp);
      return {
        san: `${this.heroName(side)} incinerates ${monster.type} for ${damage}`,
        captured: monster.type,
      };
    }
    return { san: `${this.heroName(side)} casts Fireball on ${monster.type} for ${damage}` };
  }

  private awardXp(hero: HeroState, xp: number): void {
    hero.xp += xp;
    while (hero.level - 1 < LEVEL_THRESHOLDS.length && hero.xp >= LEVEL_THRESHOLDS[hero.level - 1]) {
      hero.level += 1;
      hero.maxHp += 10;
      hero.atk += 3;
      hero.def += 2;
      hero.hp = hero.maxHp;
      hero.mana = hero.maxMana;
    }
  }

  private collectSpellPickup(hero: HeroState): string {
    const tileKey = this.key(hero.x, hero.y);
    if (!this.spellPickups.has(tileKey)) return '';

    this.spellPickups.delete(tileKey);
    const available = SPELLS.filter((spell) => !hero.spells.includes(spell));
    const spell = available[0] ?? SPELLS[0];
    if (!hero.spells.includes(spell)) hero.spells.push(spell);
    return ` and learns ${spell}`;
  }

  private finishTurn(side: MQColor): void {
    const hero = this.heroes[side];
    if (hero.shieldTurns > 0) hero.shieldTurns -= 1;
    this.totalTurns += 1;
    this.currentTurn = side === 'w' ? 'b' : 'w';
  }

  private placeImpassableTerrain(rng: () => number, reserved: Set<string>): void {
    const candidates = this.shuffleCells(rng, (x, y) => {
      if (reserved.has(this.key(x, y))) return false;
      return y > 0 && y < HEIGHT - 1 && !(x >= 4 && x <= 7 && y >= 3 && y <= 6);
    });
    const count = Math.floor(WIDTH * HEIGHT * 0.15);
    for (let i = 0; i < count && i < candidates.length; i++) {
      const { x, y } = candidates[i];
      this.terrain[y][x] = rng() < 0.55 ? '^' : '~';
    }
  }

  private placeForests(rng: () => number, reserved: Set<string>): void {
    const candidates = this.shuffleCells(rng, (x, y) => this.terrain[y][x] === '.' && !reserved.has(this.key(x, y)));
    const count = 12 + Math.floor(rng() * 5);
    for (let i = 0; i < count && i < candidates.length; i++) {
      const { x, y } = candidates[i];
      this.terrain[y][x] = '#';
    }
  }

  private placeResources(rng: () => number, count: number): void {
    const cells = this.shuffleCells(rng, (x, y) => this.canOccupyFeature(x, y));
    for (let i = 0; i < count && i < cells.length; i++) {
      this.resourceNodes.add(this.key(cells[i].x, cells[i].y));
    }
  }

  private placeSpellPickups(rng: () => number, count: number): void {
    const cells = this.shuffleCells(rng, (x, y) => this.canOccupyFeature(x, y) && !this.resourceNodes.has(this.key(x, y)));
    for (let i = 0; i < count && i < cells.length; i++) {
      this.spellPickups.add(this.key(cells[i].x, cells[i].y));
    }
  }

  private placeMonsters(rng: () => number, count: number): void {
    const cells = this.shuffleCells(rng, (x, y) => {
      if (!this.canOccupyFeature(x, y)) return false;
      if (this.resourceNodes.has(this.key(x, y)) || this.spellPickups.has(this.key(x, y))) return false;
      return this.distance(this.heroes.w.x, this.heroes.w.y, x, y) >= 3
        && this.distance(this.heroes.b.x, this.heroes.b.y, x, y) >= 3;
    });

    const roster: MonsterTemplate[] = [];
    if (count >= 4 && rng() < 0.4) roster.push(MONSTERS.Dragon);
    const regulars = [MONSTERS.Goblin, MONSTERS.Wolf, MONSTERS.Skeleton];
    while (roster.length < count) {
      roster.push(regulars[Math.floor(rng() * regulars.length)]);
    }

    for (let i = 0; i < Math.min(count, cells.length); i++) {
      const template = roster[i];
      const pos = cells[i];
      this.monsters.push({ ...template, x: pos.x, y: pos.y });
    }
  }

  private canOccupyFeature(x: number, y: number): boolean {
    if (!this.isPassable(x, y)) return false;
    return !this.heroAt(x, y) && !this.monsterAt(x, y);
  }

  private shuffleCells(rng: () => number, predicate: (x: number, y: number) => boolean): Array<{ x: number; y: number }> {
    const cells: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if (predicate(x, y)) cells.push({ x, y });
      }
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return cells;
  }
}
