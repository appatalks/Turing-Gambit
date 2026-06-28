// ─── Global Thermonuclear War — Modernized Triad ───────
// 8 targets per side. Nuclear triad: ICBM, SLBM, BOMBER, MIRV.
// "A strange game. The only winning move is not to play."
//
// Triad & strikes:
//   ICBM   — Land-based. Fast. Blocked by missile defense.
//   SLBM   — Submarine-launched. Penetrates defense (always hits).
//   BOMBER — Air-based. Destroys target AND strips its defense.
//   MIRV   — ICBM with 3 warheads. Hits target + 2 neighbors. Each blockable.
//
// Defense:
//   DEFEND — Interceptors. Blocks ICBM/MIRV warheads. Bypassed by SLBM. Stripped by bomber.
//
// Diplomacy:
//   NEGOTIATE — 3 consecutive mutual negotiations → peace.

export type TargetStatus = 'intact' | 'destroyed' | 'defended';
export type StrikeType = 'icbm' | 'slbm' | 'bomber' | 'mirv';
export type WargamesColor = 'b' | 'w';
export type WargamesStatus = 'active' | 'white_wins' | 'black_wins' | 'draw' | 'peace';

export interface WargamesState {
  sideA: TargetStatus[];
  sideB: TargetStatus[];
  turn: WargamesColor;
  round: number;
  defcon: number;
  consecutiveNegotiations: number;
  totalStrikes: number;
  log: string[];
}

const NUM_TARGETS = 8;
const SIDE_A_NAMES = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL'];
const SIDE_B_NAMES = ['INDIA', 'JULIET', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA'];
const MAX_ROUNDS = 16;
const CITIES_TO_WIN = 5;

export class WargamesEngine {
  private state: WargamesState;

  constructor() {
    this.state = this.initialState();
  }

  private initialState(): WargamesState {
    return {
      sideA: Array(NUM_TARGETS).fill('intact'),
      sideB: Array(NUM_TARGETS).fill('intact'),
      turn: 'w',
      round: 1,
      defcon: 5,
      consecutiveNegotiations: 0,
      totalStrikes: 0,
      log: [],
    };
  }

  reset(): void { this.state = this.initialState(); }
  turn(): WargamesColor { return this.state.turn; }

  boardState(): string {
    const a = this.state.sideA.map((s) => s[0]).join('');
    const b = this.state.sideB.map((s) => s[0]).join('');
    return `${a} ${b} ${this.state.defcon} ${this.state.round} ${this.state.turn}`;
  }

  boardForPrompt(): string {
    const fmt = (targets: TargetStatus[], names: string[]) =>
      targets.map((s, i) => `  ${i + 1}. ${names[i]}: ${s.toUpperCase()}`).join('\n');

    const yourSide = this.state.turn === 'w' ? 'Side A' : 'Side B';
    const enemySide = this.state.turn === 'w' ? 'Side B' : 'Side A';
    const yourTargets = this.state.turn === 'w' ? this.state.sideA : this.state.sideB;
    const enemyTargets = this.state.turn === 'w' ? this.state.sideB : this.state.sideA;
    const yourNames = this.state.turn === 'w' ? SIDE_A_NAMES : SIDE_B_NAMES;
    const enemyNames = this.state.turn === 'w' ? SIDE_B_NAMES : SIDE_A_NAMES;

    return `DEFCON ${this.state.defcon} | Round ${this.state.round}/${MAX_ROUNDS} | First to ${CITIES_TO_WIN} destroyed wins

YOUR TARGETS (${yourSide}):
${fmt(yourTargets, yourNames)}

ENEMY TARGETS (${enemySide}):
${fmt(enemyTargets, enemyNames)}

Nuclear Triad:
  ICBM   — Fast land strike. Blocked by enemy defense.
  SLBM   — Submarine launch. Penetrates all defenses.
  BOMBER — Air strike. Destroys target AND strips its defense.
  MIRV   — 3-warhead ICBM. Hits target + 2 neighbors. Each blockable.

${this.state.consecutiveNegotiations > 0 ? `Negotiations: ${this.state.consecutiveNegotiations}/3 rounds\n` : ''}`;
  }

  legalMoves(): string[] {
    const moves: string[] = [];
    const enemyTargets = this.state.turn === 'w' ? this.state.sideB : this.state.sideA;

    enemyTargets.forEach((s, i) => {
      if (s !== 'destroyed') {
        moves.push(`ICBM ${i + 1}`);
        moves.push(`SLBM ${i + 1}`);
        moves.push(`BOMBER ${i + 1}`);
        moves.push(`MIRV ${i + 1}`);
      }
    });

    const ownTargets = this.state.turn === 'w' ? this.state.sideA : this.state.sideB;
    ownTargets.forEach((s, i) => {
      if (s !== 'destroyed') moves.push(`DEFEND ${i + 1}`);
    });

    moves.push('NEGOTIATE');
    return moves;
  }

  makeMove(notation: string): { san: string; captured?: string; strikeType?: StrikeType } | null {
    const action = this.parseAction(notation);
    if (!action) return null;

    // Defenses last one turn
    this.state.sideA = this.state.sideA.map((s) => (s === 'defended' ? 'intact' : s));
    this.state.sideB = this.state.sideB.map((s) => (s === 'defended' ? 'intact' : s));

    const turn = this.state.turn;
    const side = turn === 'w' ? 'Side A' : 'Side B';
    let san = '';
    let captured: string | undefined;
    let strikeType: StrikeType | undefined;

    const isStrike = ['icbm', 'slbm', 'bomber', 'mirv'].includes(action.type);

    if (isStrike) {
      const targets = turn === 'w' ? this.state.sideB : this.state.sideA;
      const names = turn === 'w' ? SIDE_B_NAMES : SIDE_A_NAMES;
      strikeType = action.type as StrikeType;
      const label = action.type.toUpperCase();

      // MIRV hits target + 2 neighbors
      const indices = action.type === 'mirv'
        ? [action.target - 1, action.target % NUM_TARGETS, (action.target + 1) % NUM_TARGETS]
        : [action.target - 1];

      const results: string[] = [];
      for (const idx of indices) {
        if (idx < 0 || idx >= NUM_TARGETS) continue;
        const before = targets[idx];
        if (before === 'destroyed') { results.push(`${names[idx]}(already hit)`); continue; }

        if (before === 'defended') {
          if (action.type === 'icbm' || action.type === 'mirv') {
            targets[idx] = 'intact'; // intercepted
            results.push(`${names[idx]}(INTERCEPTED)`);
          } else {
            targets[idx] = 'destroyed';
            results.push(`${names[idx]}(PENETRATED)`);
            captured = 'target';
            this.state.totalStrikes++;
          }
        } else {
          targets[idx] = 'destroyed';
          results.push(`${names[idx]}(DESTROYED)`);
          captured = 'target';
          this.state.totalStrikes++;
        }
      }

      san = `${side} ${label} → ${results.join(', ')}`;
      this.state.consecutiveNegotiations = 0;
      this.updateDefcon();

    } else if (action.type === 'defend') {
      const targets = turn === 'w' ? this.state.sideA : this.state.sideB;
      const names = turn === 'w' ? SIDE_A_NAMES : SIDE_B_NAMES;
      const idx = action.target - 1;
      if (idx < 0 || idx >= NUM_TARGETS || targets[idx] === 'destroyed') return null;
      targets[idx] = 'defended';
      san = `${side} deploys interceptors at ${names[idx]}`;
      this.state.consecutiveNegotiations = 0;

    } else if (action.type === 'negotiate') {
      san = `${side} proposes ceasefire`;
      if (this.state.turn === 'b') {
        const lastLog = this.state.log[this.state.log.length - 1] || '';
        if (lastLog.includes('proposes ceasefire')) {
          this.state.consecutiveNegotiations++;
          san += ` (mutual — ${this.state.consecutiveNegotiations}/3)`;
        } else {
          this.state.consecutiveNegotiations = 0;
        }
      }
    }

    this.state.log.push(san);
    if (this.state.turn === 'b') this.state.round++;
    this.state.turn = this.state.turn === 'w' ? 'b' : 'w';

    return { san, captured, strikeType };
  }

  private parseAction(notation: string): { type: string; target: number } | null {
    const upper = notation.trim().toUpperCase();
    if (upper === 'NEGOTIATE') return { type: 'negotiate', target: 0 };
    const match = upper.match(/^(ICBM|SLBM|BOMBER|MIRV|DEFEND|STRIKE)\s+(\d)$/);
    if (!match) return null;
    let type = match[1].toLowerCase();
    if (type === 'strike') type = 'icbm';
    return { type, target: parseInt(match[2]) };
  }

  private updateDefcon(): void {
    const s = this.state.totalStrikes;
    if (s >= 9) this.state.defcon = 1;
    else if (s >= 7) this.state.defcon = 2;
    else if (s >= 4) this.state.defcon = 3;
    else if (s >= 1) this.state.defcon = 4;
  }

  isGameOver(): boolean {
    if (this.state.consecutiveNegotiations >= 3) return true;
    if (this.state.round > MAX_ROUNDS) return true;
    const aD = this.state.sideA.filter((s) => s === 'destroyed').length;
    const bD = this.state.sideB.filter((s) => s === 'destroyed').length;
    return aD >= CITIES_TO_WIN || bD >= CITIES_TO_WIN;
  }

  gameStatus(): WargamesStatus {
    if (this.state.consecutiveNegotiations >= 3) return 'peace';
    const aD = this.state.sideA.filter((s) => s === 'destroyed').length;
    const bD = this.state.sideB.filter((s) => s === 'destroyed').length;
    if (aD >= CITIES_TO_WIN && bD >= CITIES_TO_WIN) return 'draw';
    if (aD >= CITIES_TO_WIN) return 'black_wins';
    if (bD >= CITIES_TO_WIN) return 'white_wins';
    if (this.state.round > MAX_ROUNDS) {
      if (aD === bD) return 'draw';
      return aD > bD ? 'black_wins' : 'white_wins';
    }
    return 'active';
  }

  endReason(): string {
    const s = this.gameStatus();
    if (s === 'peace') return 'Peace achieved through negotiation';
    if (s === 'draw') return 'A STRANGE GAME. THE ONLY WINNING MOVE IS NOT TO PLAY.';
    if (s === 'white_wins') return 'Side A achieves strategic dominance';
    if (s === 'black_wins') return 'Side B achieves strategic dominance';
    return 'Maximum rounds reached';
  }

  getLog(): string[] { return this.state.log; }

  pieceCounts(): { white: number; black: number } {
    return {
      white: this.state.sideA.filter((s) => s !== 'destroyed').length,
      black: this.state.sideB.filter((s) => s !== 'destroyed').length,
    };
  }
}
