// ─── Platform Race (Mario-style side-scroll dash) ───────
// Two runners race down IDENTICAL seeded tracks. Each tick a runner picks
// RUN (advance one cell), JUMP (leap two cells, clearing the next hazard),
// or WAIT. Pits drop you back to your last checkpoint; pipes block you.
// First runner to cross the finish flag wins.
//
// Turn model (paired): White commits an action (hidden), then Black
// commits — and both runners resolve on their own lane simultaneously.

export type MarioColor = 'w' | 'b';
export type MarioStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';
export type MarioAction = 'RUN' | 'JUMP' | 'WAIT';

export const MARIO_LENGTH = 48; // finish flag sits at index MARIO_LENGTH
const MAX_ROUNDS = 90;

type Cell = 'G' | 'P' | '#' | 'F';

interface Runner {
  pos: number;
  checkpoint: number;
  falls: number;
  blocks: number;
  finished: boolean;
  finishRound: number;
  event: string;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MarioEngine {
  private track: Cell[] = [];
  private white: Runner = MarioEngine.newRunner();
  private black: Runner = MarioEngine.newRunner();
  private round = 1;
  private currentTurn: MarioColor = 'w';
  private pendingWhite: MarioAction | null = null;

  constructor(seed?: number) {
    this.generateTrack(seed ?? Math.floor(Math.random() * 2 ** 31));
  }

  private static newRunner(): Runner {
    return { pos: 0, checkpoint: 0, falls: 0, blocks: 0, finished: false, finishRound: 0, event: 'at the start line' };
  }

  reset(): void {
    this.white = MarioEngine.newRunner();
    this.black = MarioEngine.newRunner();
    this.round = 1;
    this.currentTurn = 'w';
    this.pendingWhite = null;
  }

  private generateTrack(seed: number): void {
    const rng = mulberry32(seed);
    const L = MARIO_LENGTH;
    const cells: Cell[] = new Array(L + 1).fill('G');
    let i = 4; // safe starting runway
    while (i < L - 3) {
      if (rng() < 0.55) {
        cells[i] = rng() < 0.5 ? 'P' : '#';
        cells[i + 1] = 'G';            // guaranteed landing cell
        i += 2 + Math.floor(rng() * 2); // keep hazards separated
      } else {
        i += 1;
      }
    }
    cells[L] = 'F';
    this.track = cells;
  }

  turn(): MarioColor { return this.currentTurn; }
  getMoveCount(): number { return this.round; }

  boardState(): string {
    return [
      MARIO_LENGTH, this.currentTurn, this.round,
      this.white.pos, this.black.pos,
      this.white.checkpoint, this.black.checkpoint,
      this.white.falls, this.black.falls,
      this.white.finished ? '1' : '0', this.black.finished ? '1' : '0',
      this.track.join(''),
      this.white.event, this.black.event,
    ].join(';');
  }

  legalMoves(): string[] {
    return ['RUN', 'JUMP', 'WAIT'];
  }

  private label(c: Cell): string {
    if (c === 'P') return 'PIT (gap)';
    if (c === '#') return 'PIPE (wall)';
    if (c === 'F') return 'FINISH flag';
    return 'ground';
  }

  private immediateHint(pos: number): string {
    const L = MARIO_LENGTH;
    if (pos + 1 >= L) return 'The FINISH flag is the very next cell — RUN through it to win!';
    const n1 = this.track[pos + 1];
    const n2 = pos + 2 <= L ? this.track[pos + 2] : 'G';
    if (n1 === 'P') return 'Cell +1 is a PIT — JUMP now to clear it (you land on +2). RUN would drop you back to your checkpoint.';
    if (n1 === '#') return 'Cell +1 is a PIPE wall — JUMP to hop over it onto +2. RUN would be blocked.';
    if (n2 === 'P') return 'Cell +1 is safe ground but +2 is a PIT — RUN one step (do NOT JUMP into the pit).';
    if (n2 === '#') return 'Cell +1 is safe ground but +2 is a PIPE — RUN one step (do NOT JUMP into it).';
    return 'Open track ahead — JUMP to cover two cells and build a lead.';
  }

  boardForPrompt(side: MarioColor): string {
    const me = side === 'w' ? this.white : this.black;
    const opp = side === 'w' ? this.black : this.white;
    const L = MARIO_LENGTH;

    const preview: string[] = [];
    for (let k = 1; k <= 5; k++) {
      const idx = me.pos + k;
      if (idx > L) break;
      preview.push(`  +${k} (cell ${idx}): ${this.label(this.track[idx])}`);
    }

    return [
      `PLATFORM RACE — you are runner ${side === 'w' ? 'RED' : 'GREEN'}. Reach cell ${L} (the finish flag) first.`,
      `You are at cell ${me.pos} of ${L} (${L - me.pos} to go). Opponent is at cell ${opp.pos}.`,
      `Falls so far: you ${me.falls}, opponent ${opp.falls}. Your last checkpoint: cell ${me.checkpoint}.`,
      '',
      'Track ahead:',
      ...preview,
      '',
      `Hint: ${this.immediateHint(me.pos)}`,
      `Last tick: you ${me.event}.`,
      '',
      'RUN = +1 cell, JUMP = +2 cells (leaps the next hazard), WAIT = hold position.',
    ].join('\n');
  }

  private parseAction(s: string): MarioAction | null {
    const u = s.trim().toUpperCase();
    if (u === 'RUN' || u === 'R' || u === 'GO' || u === 'WALK') return 'RUN';
    if (u === 'JUMP' || u === 'J' || u === 'HOP' || u === 'LEAP') return 'JUMP';
    if (u === 'WAIT' || u === 'W' || u === 'HOLD' || u === 'STAY') return 'WAIT';
    return null;
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const action = this.parseAction(notation);
    if (!action) return null;

    if (this.currentTurn === 'w') {
      this.pendingWhite = action;
      this.currentTurn = 'b';
      return { san: `R${this.round} RED ${action}` };
    }

    this.resolve(this.white, this.pendingWhite ?? 'WAIT');
    this.resolve(this.black, action);
    this.pendingWhite = null;

    const san = `R${this.round} GREEN ${action} | RED@${this.white.pos} GRN@${this.black.pos}`;
    const event = this.white.finished || this.black.finished ? 'finish' : undefined;
    this.round++;
    this.currentTurn = 'w';
    return { san, captured: event };
  }

  private resolve(p: Runner, action: MarioAction): void {
    if (p.finished) { p.event = 'already finished'; return; }
    const L = MARIO_LENGTH;

    if (action === 'WAIT') { p.event = 'held position'; return; }

    const step = action === 'JUMP' ? 2 : 1;
    const target = p.pos + step;

    if (target >= L) {
      p.pos = L; p.finished = true; p.finishRound = this.round;
      p.checkpoint = L;
      p.event = 'crossed the finish flag!';
      return;
    }

    const cell = this.track[target];
    if (cell === 'P') {
      p.pos = p.checkpoint; p.falls++;
      p.event = action === 'JUMP' ? 'jumped into a pit and respawned' : 'ran into a pit and respawned';
      return;
    }
    if (cell === '#') {
      p.blocks++;
      p.event = action === 'JUMP' ? 'bonked a pipe mid-air (blocked)' : 'was blocked by a pipe';
      return; // position unchanged
    }

    p.pos = target;
    p.checkpoint = target; // standing safely on ground
    p.event = action === 'JUMP' ? `leaped to cell ${target}` : `advanced to cell ${target}`;
  }

  isGameOver(): boolean {
    return this.white.finished || this.black.finished || this.round > MAX_ROUNDS;
  }

  gameStatus(): MarioStatus {
    if (this.white.finished && this.black.finished) {
      if (this.white.finishRound < this.black.finishRound) return 'white_wins';
      if (this.black.finishRound < this.white.finishRound) return 'black_wins';
      return 'draw';
    }
    if (this.white.finished) return 'white_wins';
    if (this.black.finished) return 'black_wins';
    if (this.round > MAX_ROUNDS) {
      if (this.white.pos > this.black.pos) return 'white_wins';
      if (this.black.pos > this.white.pos) return 'black_wins';
      return 'draw';
    }
    return 'active';
  }
}
