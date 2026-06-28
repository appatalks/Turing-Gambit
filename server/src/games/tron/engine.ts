// ─── Tron Light-Cycles (tick-based grid duel) ───────────
// Two riders leave solid trails behind them on a square grid. Run into a
// wall, your own trail, or the opponent's trail and you crash. Last rider
// alive wins; simultaneous crashes are a draw.
//
// Turn model (paired): White commits a direction (hidden), then Black
// commits — and both cycles advance ONE cell at the same instant, so a
// head-on collision is possible and fatal to both.

export type TronColor = 'w' | 'b';
export type TronStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';
export type TronDir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export const TRON_GRID = 18; // x,y: 0 .. 17

const DELTA: Record<TronDir, { dx: number; dy: number }> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};
const REVERSE: Record<TronDir, TronDir> = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};
const ALL_DIRS: TronDir[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
const MAX_ROUNDS = 120; // safety cap so a perfect-survival game still ends

interface Pt { x: number; y: number; }

export class TronEngine {
  private whiteHead: Pt = { x: 3, y: 9 };
  private blackHead: Pt = { x: TRON_GRID - 4, y: 9 };
  private whiteDir: TronDir = 'RIGHT';
  private blackDir: TronDir = 'LEFT';
  private whiteTrail: Pt[] = [{ x: 3, y: 9 }];
  private blackTrail: Pt[] = [{ x: TRON_GRID - 4, y: 9 }];
  private occupied = new Set<string>([`3,9`, `${TRON_GRID - 4},9`]);
  private crashedW = false;
  private crashedB = false;
  private round = 1;
  private currentTurn: TronColor = 'w';
  private pendingWhite: TronDir | null = null;
  private lastEvent = 'Engines on — trails laid';

  reset(): void {
    this.whiteHead = { x: 3, y: 9 };
    this.blackHead = { x: TRON_GRID - 4, y: 9 };
    this.whiteDir = 'RIGHT'; this.blackDir = 'LEFT';
    this.whiteTrail = [{ x: 3, y: 9 }];
    this.blackTrail = [{ x: TRON_GRID - 4, y: 9 }];
    this.occupied = new Set([`3,9`, `${TRON_GRID - 4},9`]);
    this.crashedW = false; this.crashedB = false;
    this.round = 1; this.currentTurn = 'w';
    this.pendingWhite = null; this.lastEvent = 'Engines on — trails laid';
  }

  turn(): TronColor { return this.currentTurn; }
  getMoveCount(): number { return this.round; }

  boardState(): string {
    const trail = (t: Pt[]) => t.map((p) => `${p.x},${p.y}`).join(' ');
    return [
      TRON_GRID, this.currentTurn, this.round, this.lastEvent,
      `${this.whiteHead.x},${this.whiteHead.y}`,
      `${this.blackHead.x},${this.blackHead.y}`,
      this.whiteDir, this.blackDir,
      this.crashedW ? '1' : '0', this.crashedB ? '1' : '0',
      trail(this.whiteTrail), trail(this.blackTrail),
    ].join(';');
  }

  legalMoves(): string[] {
    const dir = this.currentTurn === 'w' ? this.whiteDir : this.blackDir;
    return ALL_DIRS.filter((d) => d !== REVERSE[dir]);
  }

  private cellStatus(head: Pt, dir: TronDir): 'SAFE' | 'WALL' | 'TRAIL' {
    const { dx, dy } = DELTA[dir];
    const nx = head.x + dx, ny = head.y + dy;
    if (nx < 0 || ny < 0 || nx >= TRON_GRID || ny >= TRON_GRID) return 'WALL';
    if (this.occupied.has(`${nx},${ny}`)) return 'TRAIL';
    return 'SAFE';
  }

  boardForPrompt(side: TronColor): string {
    const head = side === 'w' ? this.whiteHead : this.blackHead;
    const dir = side === 'w' ? this.whiteDir : this.blackDir;
    const oppHead = side === 'w' ? this.blackHead : this.whiteHead;
    const oppDir = side === 'w' ? this.blackDir : this.whiteDir;
    const legal = this.legalMoves() as TronDir[];

    const scan = legal
      .map((d) => `  ${d}: ${this.cellStatus(head, d)}`)
      .join('\n');

    const dist = Math.abs(head.x - oppHead.x) + Math.abs(head.y - oppHead.y);

    return [
      `TRON LIGHT-CYCLES — you are the ${side === 'w' ? 'CYAN' : 'ORANGE'} rider.`,
      `Grid is ${TRON_GRID}×${TRON_GRID}. Top-left is (0,0); x grows right, y grows down.`,
      `Your head: (${head.x},${head.y}) heading ${dir}.`,
      `Opponent head: (${oppHead.x},${oppHead.y}) heading ${oppDir} — ${dist} cells away.`,
      '',
      'Crashing into a wall, your own trail, or the opponent trail is fatal.',
      'You cannot reverse direction. Each legal turn leads to:',
      scan,
      '',
      `Last tick: ${this.lastEvent}`,
      'Pick the direction that keeps you alive and boxes the opponent in.',
    ].join('\n');
  }

  private parseDir(s: string): TronDir | null {
    const u = s.trim().toUpperCase();
    if (u === 'UP' || u === 'U' || u === 'NORTH' || u === 'N') return 'UP';
    if (u === 'DOWN' || u === 'D' || u === 'SOUTH' || u === 'S') return 'DOWN';
    if (u === 'LEFT' || u === 'L' || u === 'WEST' || u === 'W') return 'LEFT';
    if (u === 'RIGHT' || u === 'R' || u === 'EAST' || u === 'E') return 'RIGHT';
    return null;
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const dir = this.parseDir(notation);
    if (!dir) return null;
    if (dir === REVERSE[this.currentTurn === 'w' ? this.whiteDir : this.blackDir]) return null;

    if (this.currentTurn === 'w') {
      this.pendingWhite = dir;
      this.currentTurn = 'b';
      return { san: `R${this.round} CYAN ${dir}` };
    }

    // Black commits → advance both cycles at once.
    const wDir = this.pendingWhite ?? this.whiteDir;
    const bDir = dir;
    this.pendingWhite = null;

    const wNext = { x: this.whiteHead.x + DELTA[wDir].dx, y: this.whiteHead.y + DELTA[wDir].dy };
    const bNext = { x: this.blackHead.x + DELTA[bDir].dx, y: this.blackHead.y + DELTA[bDir].dy };

    const wHits = this.hits(wNext);
    const bHits = this.hits(bNext);
    const headOn = wNext.x === bNext.x && wNext.y === bNext.y;

    this.crashedW = wHits || headOn;
    this.crashedB = bHits || headOn;

    if (!this.crashedW) {
      this.whiteHead = wNext; this.whiteDir = wDir;
      this.whiteTrail.push(wNext); this.occupied.add(`${wNext.x},${wNext.y}`);
    }
    if (!this.crashedB) {
      this.blackHead = bNext; this.blackDir = bDir;
      this.blackTrail.push(bNext); this.occupied.add(`${bNext.x},${bNext.y}`);
    }

    if (headOn) this.lastEvent = 'Head-on collision!';
    else if (this.crashedW && this.crashedB) this.lastEvent = 'Both riders crashed!';
    else if (this.crashedW) this.lastEvent = 'CYAN crashed!';
    else if (this.crashedB) this.lastEvent = 'ORANGE crashed!';
    else this.lastEvent = 'Both riders survive';

    const san = `R${this.round} ORANGE ${bDir} → ${this.lastEvent}`;
    this.round++;
    this.currentTurn = 'w';
    return { san, captured: (this.crashedW || this.crashedB) ? 'crash' : undefined };
  }

  private hits(p: Pt): boolean {
    if (p.x < 0 || p.y < 0 || p.x >= TRON_GRID || p.y >= TRON_GRID) return true;
    return this.occupied.has(`${p.x},${p.y}`);
  }

  isGameOver(): boolean {
    return this.crashedW || this.crashedB || this.round > MAX_ROUNDS;
  }

  gameStatus(): TronStatus {
    if (this.crashedW && this.crashedB) return 'draw';
    if (this.crashedW) return 'black_wins';
    if (this.crashedB) return 'white_wins';
    if (this.round > MAX_ROUNDS) {
      // Time limit — the rider who claimed more territory wins.
      if (this.whiteTrail.length > this.blackTrail.length) return 'white_wins';
      if (this.blackTrail.length > this.whiteTrail.length) return 'black_wins';
      return 'draw';
    }
    return 'active';
  }
}
