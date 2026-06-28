// ─── Risk Engine ────────────────────────────────────────
// Simplified two-player Risk on the classic 42-territory map.
// A turn has three phases: reinforce → attack → fortify.
//   • Reinforce: place your army pool on one owned territory.
//   • Attack:    blitz an adjacent enemy territory (dice combat),
//                repeat as desired, then END_ATTACK.
//   • Fortify:   optionally move armies between two connected
//                owned territories, then the turn passes.
// White = Blue army, Black = Red army. Conquer the whole map to win.

export type RiskColor = 'w' | 'b';
export type RiskPhase = 'reinforce' | 'attack' | 'fortify';
export type RiskStatus = 'active' | 'white_wins' | 'black_wins';

interface Territory {
  code: string;
  name: string;
  continent: string;
  x: number;
  y: number;
  neighbors: string[];
}

interface Continent {
  name: string;
  bonus: number;
  members: string[];
}

// Map definition (code, name, continent, x, y, neighbors)
const TERRITORIES: Territory[] = [
  // North America
  { code: 'ALK', name: 'Alaska', continent: 'North America', x: 60, y: 95, neighbors: ['NWT', 'ALB', 'KAM'] },
  { code: 'NWT', name: 'NW Territory', continent: 'North America', x: 165, y: 90, neighbors: ['ALK', 'ALB', 'ONT', 'GRL'] },
  { code: 'GRL', name: 'Greenland', continent: 'North America', x: 320, y: 55, neighbors: ['NWT', 'ONT', 'QUE', 'ICE'] },
  { code: 'ALB', name: 'Alberta', continent: 'North America', x: 135, y: 165, neighbors: ['ALK', 'NWT', 'ONT', 'WUS'] },
  { code: 'ONT', name: 'Ontario', continent: 'North America', x: 220, y: 165, neighbors: ['NWT', 'ALB', 'GRL', 'QUE', 'WUS', 'EUS'] },
  { code: 'QUE', name: 'Quebec', continent: 'North America', x: 310, y: 165, neighbors: ['GRL', 'ONT', 'EUS'] },
  { code: 'WUS', name: 'Western US', continent: 'North America', x: 150, y: 245, neighbors: ['ALB', 'ONT', 'EUS', 'CAM'] },
  { code: 'EUS', name: 'Eastern US', continent: 'North America', x: 240, y: 255, neighbors: ['ONT', 'QUE', 'WUS', 'CAM'] },
  { code: 'CAM', name: 'Cent. America', continent: 'North America', x: 185, y: 330, neighbors: ['WUS', 'EUS', 'VEN'] },
  // South America
  { code: 'VEN', name: 'Venezuela', continent: 'South America', x: 250, y: 380, neighbors: ['CAM', 'BRA', 'PER'] },
  { code: 'BRA', name: 'Brazil', continent: 'South America', x: 320, y: 430, neighbors: ['VEN', 'PER', 'ARG', 'NAF'] },
  { code: 'PER', name: 'Peru', continent: 'South America', x: 250, y: 460, neighbors: ['VEN', 'BRA', 'ARG'] },
  { code: 'ARG', name: 'Argentina', continent: 'South America', x: 270, y: 535, neighbors: ['PER', 'BRA'] },
  // Europe
  { code: 'ICE', name: 'Iceland', continent: 'Europe', x: 430, y: 120, neighbors: ['GRL', 'GBR', 'SCA'] },
  { code: 'GBR', name: 'Great Britain', continent: 'Europe', x: 440, y: 195, neighbors: ['ICE', 'SCA', 'NEU', 'WEU'] },
  { code: 'SCA', name: 'Scandinavia', continent: 'Europe', x: 515, y: 110, neighbors: ['ICE', 'GBR', 'NEU', 'UKR'] },
  { code: 'NEU', name: 'North Europe', continent: 'Europe', x: 510, y: 200, neighbors: ['GBR', 'SCA', 'UKR', 'SEU', 'WEU'] },
  { code: 'WEU', name: 'West Europe', continent: 'Europe', x: 450, y: 270, neighbors: ['GBR', 'NEU', 'SEU', 'NAF'] },
  { code: 'SEU', name: 'South Europe', continent: 'Europe', x: 535, y: 265, neighbors: ['NEU', 'WEU', 'UKR', 'NAF', 'EGY', 'MEA'] },
  { code: 'UKR', name: 'Ukraine', continent: 'Europe', x: 610, y: 165, neighbors: ['SCA', 'NEU', 'SEU', 'URA', 'AFG', 'MEA'] },
  // Africa
  { code: 'NAF', name: 'North Africa', continent: 'Africa', x: 480, y: 370, neighbors: ['BRA', 'WEU', 'SEU', 'EGY', 'EAF', 'CON'] },
  { code: 'EGY', name: 'Egypt', continent: 'Africa', x: 550, y: 355, neighbors: ['SEU', 'NAF', 'EAF', 'MEA'] },
  { code: 'EAF', name: 'East Africa', continent: 'Africa', x: 600, y: 425, neighbors: ['NAF', 'EGY', 'CON', 'SAF', 'MAD', 'MEA'] },
  { code: 'CON', name: 'Congo', continent: 'Africa', x: 545, y: 465, neighbors: ['NAF', 'EAF', 'SAF'] },
  { code: 'SAF', name: 'South Africa', continent: 'Africa', x: 565, y: 535, neighbors: ['CON', 'EAF', 'MAD'] },
  { code: 'MAD', name: 'Madagascar', continent: 'Africa', x: 640, y: 525, neighbors: ['EAF', 'SAF'] },
  // Asia
  { code: 'URA', name: 'Ural', continent: 'Asia', x: 670, y: 145, neighbors: ['UKR', 'SIB', 'CHN', 'AFG'] },
  { code: 'SIB', name: 'Siberia', continent: 'Asia', x: 725, y: 110, neighbors: ['URA', 'YAK', 'IRK', 'MON', 'CHN'] },
  { code: 'YAK', name: 'Yakutsk', continent: 'Asia', x: 805, y: 85, neighbors: ['SIB', 'IRK', 'KAM'] },
  { code: 'KAM', name: 'Kamchatka', continent: 'Asia', x: 890, y: 100, neighbors: ['YAK', 'IRK', 'MON', 'JPN', 'ALK'] },
  { code: 'IRK', name: 'Irkutsk', continent: 'Asia', x: 765, y: 165, neighbors: ['SIB', 'YAK', 'KAM', 'MON'] },
  { code: 'MON', name: 'Mongolia', continent: 'Asia', x: 795, y: 215, neighbors: ['SIB', 'KAM', 'IRK', 'JPN', 'CHN'] },
  { code: 'JPN', name: 'Japan', continent: 'Asia', x: 905, y: 215, neighbors: ['KAM', 'MON'] },
  { code: 'AFG', name: 'Afghanistan', continent: 'Asia', x: 665, y: 235, neighbors: ['UKR', 'URA', 'CHN', 'MEA', 'IND'] },
  { code: 'CHN', name: 'China', continent: 'Asia', x: 765, y: 280, neighbors: ['URA', 'SIB', 'MON', 'AFG', 'IND', 'SIA'] },
  { code: 'MEA', name: 'Middle East', continent: 'Asia', x: 625, y: 305, neighbors: ['UKR', 'SEU', 'EGY', 'EAF', 'AFG', 'IND'] },
  { code: 'IND', name: 'India', continent: 'Asia', x: 715, y: 340, neighbors: ['AFG', 'CHN', 'MEA', 'SIA'] },
  { code: 'SIA', name: 'Siam', continent: 'Asia', x: 795, y: 345, neighbors: ['CHN', 'IND', 'INO'] },
  // Australia
  { code: 'INO', name: 'Indonesia', continent: 'Australia', x: 825, y: 425, neighbors: ['SIA', 'NGU', 'WAU'] },
  { code: 'NGU', name: 'New Guinea', continent: 'Australia', x: 915, y: 430, neighbors: ['INO', 'WAU', 'EAU'] },
  { code: 'WAU', name: 'West Australia', continent: 'Australia', x: 845, y: 515, neighbors: ['INO', 'NGU', 'EAU'] },
  { code: 'EAU', name: 'East Australia', continent: 'Australia', x: 925, y: 525, neighbors: ['NGU', 'WAU'] },
];

const CONTINENTS: Continent[] = [
  { name: 'North America', bonus: 5, members: ['ALK', 'NWT', 'GRL', 'ALB', 'ONT', 'QUE', 'WUS', 'EUS', 'CAM'] },
  { name: 'South America', bonus: 2, members: ['VEN', 'BRA', 'PER', 'ARG'] },
  { name: 'Europe', bonus: 5, members: ['ICE', 'GBR', 'SCA', 'NEU', 'WEU', 'SEU', 'UKR'] },
  { name: 'Africa', bonus: 3, members: ['NAF', 'EGY', 'EAF', 'CON', 'SAF', 'MAD'] },
  { name: 'Asia', bonus: 7, members: ['URA', 'SIB', 'YAK', 'KAM', 'IRK', 'MON', 'JPN', 'AFG', 'CHN', 'MEA', 'IND', 'SIA'] },
  { name: 'Australia', bonus: 2, members: ['INO', 'NGU', 'WAU', 'EAU'] },
];

const TMAP = new Map(TERRITORIES.map((t) => [t.code, t]));

interface Cell { owner: RiskColor; armies: number; }

export class RiskEngine {
  private cells = new Map<string, Cell>();
  private currentTurn: RiskColor = 'w';
  private phase: RiskPhase = 'reinforce';
  private reinforcePool = 0;
  private lastBattle: string | null = null;
  private attacksThisTurn = 0;

  constructor() { this.reset(); }

  reset(): void {
    this.cells.clear();
    // Shuffle territories, split evenly between the two armies.
    const codes = TERRITORIES.map((t) => t.code);
    for (let i = codes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [codes[i], codes[j]] = [codes[j], codes[i]];
    }
    codes.forEach((code, i) => {
      this.cells.set(code, { owner: i % 2 === 0 ? 'w' : 'b', armies: 1 });
    });
    // Distribute remaining starting armies (40 total per side → 19 extra each).
    for (const owner of ['w', 'b'] as RiskColor[]) {
      const owned = codes.filter((c) => this.cells.get(c)!.owner === owner);
      let extra = 40 - owned.length;
      while (extra > 0) {
        const c = owned[Math.floor(Math.random() * owned.length)];
        this.cells.get(c)!.armies++;
        extra--;
      }
    }
    this.currentTurn = 'w';
    this.phase = 'reinforce';
    this.lastBattle = null;
    this.reinforcePool = this.computeReinforcements('w');
  }

  turn(): RiskColor { return this.currentTurn; }
  getPhase(): RiskPhase { return this.phase; }

  private ownedBy(owner: RiskColor): string[] {
    return TERRITORIES.filter((t) => this.cells.get(t.code)!.owner === owner).map((t) => t.code);
  }

  private computeReinforcements(owner: RiskColor): number {
    const owned = this.ownedBy(owner);
    let n = Math.max(3, Math.floor(owned.length / 3));
    const ownedSet = new Set(owned);
    for (const cont of CONTINENTS) {
      if (cont.members.every((m) => ownedSet.has(m))) n += cont.bonus;
    }
    return n;
  }

  // ── State serialization ────────────────────────────
  boardState(): string {
    // header: phase turn pool | per-territory CODE:owner:armies
    const terr = TERRITORIES.map((t) => {
      const c = this.cells.get(t.code)!;
      return `${t.code}:${c.owner.toUpperCase()}:${c.armies}`;
    }).join(',');
    return `${this.phase} ${this.currentTurn} ${this.reinforcePool} | ${terr}`;
  }

  boardForPrompt(): string {
    const me = this.currentTurn;
    const meName = me === 'w' ? 'BLUE (White)' : 'RED (Black)';
    const lines: string[] = [];
    lines.push(`You are ${meName}. Phase: ${this.phase.toUpperCase()}.`);
    if (this.phase === 'reinforce') lines.push(`Reinforcement pool: ${this.reinforcePool} armies to place.`);

    const fmt = (code: string) => {
      const c = this.cells.get(code)!;
      const t = TMAP.get(code)!;
      return `${code}(${t.name})=${c.armies}`;
    };

    const mine = this.ownedBy(me);
    const foe = this.ownedBy(me === 'w' ? 'b' : 'w');
    lines.push(`\nYOUR TERRITORIES (${mine.length}): ${mine.map(fmt).join(', ')}`);
    lines.push(`\nENEMY TERRITORIES (${foe.length}): ${foe.map(fmt).join(', ')}`);

    // Continent control
    const ctrl: string[] = [];
    for (const cont of CONTINENTS) {
      const mineCount = cont.members.filter((m) => this.cells.get(m)!.owner === me).length;
      ctrl.push(`${cont.name}: you ${mineCount}/${cont.members.length} (+${cont.bonus})`);
    }
    lines.push(`\nContinents — ${ctrl.join('; ')}`);

    if (this.lastBattle) lines.push(`\nLast battle: ${this.lastBattle}`);

    // Borders / options hint
    if (this.phase === 'attack') {
      const opts = this.attackOptions(me).slice(0, 30);
      lines.push(`\nPossible attacks (FROM→TO): ${opts.length ? opts.map((o) => `${o.from}->${o.to}`).join(', ') : 'none'}`);
    } else if (this.phase === 'fortify') {
      const opts = this.fortifyOptions(me).slice(0, 30);
      lines.push(`\nPossible fortifications (FROM→TO): ${opts.length ? opts.map((o) => `${o.from}->${o.to}`).join(', ') : 'none'}`);
    }
    return lines.join('\n');
  }

  // ── Move enumeration ───────────────────────────────
  private attackOptions(me: RiskColor): { from: string; to: string }[] {
    const out: { from: string; to: string }[] = [];
    for (const t of TERRITORIES) {
      const c = this.cells.get(t.code)!;
      if (c.owner !== me || c.armies < 2) continue;
      for (const n of t.neighbors) {
        if (this.cells.get(n)!.owner !== me) out.push({ from: t.code, to: n });
      }
    }
    return out;
  }

  private fortifyOptions(me: RiskColor): { from: string; to: string }[] {
    const out: { from: string; to: string }[] = [];
    for (const t of TERRITORIES) {
      const c = this.cells.get(t.code)!;
      if (c.owner !== me || c.armies < 2) continue;
      for (const n of t.neighbors) {
        if (this.cells.get(n)!.owner === me) out.push({ from: t.code, to: n });
      }
    }
    return out;
  }

  legalMoves(): string[] {
    const me = this.currentTurn;
    if (this.phase === 'reinforce') {
      return this.ownedBy(me).map((c) => `REINFORCE ${c}`);
    }
    if (this.phase === 'attack') {
      // Cap attacks per turn so a turn always concludes.
      if (this.attacksThisTurn >= 12) return ['END_ATTACK'];
      const moves = this.attackOptions(me).map((o) => `ATTACK ${o.from} ${o.to}`);
      moves.push('END_ATTACK');
      return moves;
    }
    // fortify
    const moves = this.fortifyOptions(me).map((o) => `FORTIFY ${o.from} ${o.to}`);
    moves.push('END_TURN');
    return moves;
  }

  private rollDice(n: number): number[] {
    return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);
  }

  // Resolve a blitz battle: keep rolling until the target is taken
  // or the attacker can no longer attack (1 army left). On conquest
  // only a limited spearhead advances, so a single turn can't sweep
  // the whole map.
  private resolveBattle(from: string, to: string): { conquered: boolean; text: string } {
    const a = this.cells.get(from)!;
    const d = this.cells.get(to)!;
    let aLoss = 0, dLoss = 0;
    let guard = 0;
    while (a.armies >= 2 && d.armies > 0 && guard++ < 500) {
      const aDice = this.rollDice(Math.min(3, a.armies - 1));
      const dDice = this.rollDice(Math.min(2, d.armies));
      const rounds = Math.min(aDice.length, dDice.length);
      for (let i = 0; i < rounds; i++) {
        if (d.armies <= 0) break;
        if (aDice[i] > dDice[i]) { d.armies--; dLoss++; }
        else { a.armies--; aLoss++; }
        if (a.armies < 2) break; // can no longer attack
      }
    }
    if (d.armies <= 0) {
      // Conquer: advance a limited spearhead (up to 3), leaving the
      // rest of the army to garrison the origin territory.
      d.owner = a.owner;
      const advance = Math.max(1, Math.min(a.armies - 1, 3));
      d.armies = advance;
      a.armies -= advance;
      return { conquered: true, text: `${from}→${to} CONQUERED (−${aLoss} you, −${dLoss} enemy, +${advance} moved)` };
    }
    return { conquered: false, text: `${from}→${to} repelled (−${aLoss} you, −${dLoss} enemy; ${to} holds ${d.armies})` };
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const parts = notation.trim().toUpperCase().split(/\s+/);
    const cmd = parts[0];
    const me = this.currentTurn;

    if (this.phase === 'reinforce' && cmd === 'REINFORCE') {
      const code = parts[1];
      const c = this.cells.get(code);
      if (!code || !c || c.owner !== me) return null;
      const placed = this.reinforcePool;
      c.armies += placed;
      this.reinforcePool = 0;
      this.phase = 'attack';
      this.lastBattle = null;
      return { san: `Reinforce ${code} +${placed}` };
    }

    if (this.phase === 'attack') {
      if (cmd === 'END_ATTACK') {
        this.phase = 'fortify';
        return { san: 'End attack' };
      }
      if (cmd === 'ATTACK') {
        const from = parts[1], to = parts[2];
        const cf = this.cells.get(from), ct = this.cells.get(to);
        if (!cf || !ct || cf.owner !== me || ct.owner === me || cf.armies < 2) return null;
        if (!TMAP.get(from)!.neighbors.includes(to)) return null;
        const res = this.resolveBattle(from, to);
        this.lastBattle = res.text;
        this.attacksThisTurn++;
        return { san: res.text, captured: res.conquered ? 'territory' : undefined };
      }
      return null;
    }

    if (this.phase === 'fortify') {
      if (cmd === 'END_TURN') {
        this.endTurn();
        return { san: 'End turn' };
      }
      if (cmd === 'FORTIFY') {
        const from = parts[1], to = parts[2];
        const cf = this.cells.get(from), ct = this.cells.get(to);
        if (!cf || !ct || cf.owner !== me || ct.owner !== me || cf.armies < 2) return null;
        if (!TMAP.get(from)!.neighbors.includes(to)) return null;
        const moved = cf.armies - 1;
        ct.armies += moved;
        cf.armies = 1;
        this.endTurn();
        return { san: `Fortify ${from}→${to} (${moved})` };
      }
      return null;
    }

    return null;
  }

  private endTurn(): void {
    this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';
    this.phase = 'reinforce';
    this.lastBattle = null;
    this.attacksThisTurn = 0;
    this.reinforcePool = this.computeReinforcements(this.currentTurn);
  }

  isGameOver(): boolean {
    return this.gameStatus() !== 'active';
  }

  gameStatus(): RiskStatus {
    const wOwns = this.ownedBy('w').length;
    const bOwns = this.ownedBy('b').length;
    if (bOwns === 0) return 'white_wins';
    if (wOwns === 0) return 'black_wins';
    return 'active';
  }
}
