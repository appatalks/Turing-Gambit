// ─── Iterated Prisoner's Dilemma ────────────────────────
// Both players secretly choose COOPERATE or DEFECT each round.
// Payoffs (years saved — higher is better):
//   Both cooperate:  3 / 3
//   Both defect:     1 / 1
//   C vs D:          0 / 5  (sucker / temptation)
// Highest total score after N rounds wins.
//
// Within the alternating harness: White chooses first (hidden),
// then Black chooses (without seeing White's current pick),
// then the round resolves.

export type PDColor = 'w' | 'b';
export type PDStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';

const MAX_ROUNDS = 10;
const PAYOFF: Record<string, [number, number]> = {
  CC: [3, 3], CD: [0, 5], DC: [5, 0], DD: [1, 1],
};

interface RoundResult {
  round: number;
  white: 'C' | 'D';
  black: 'C' | 'D';
  whitePoints: number;
  blackPoints: number;
}

export class PrisonersDilemmaEngine {
  private round = 1;
  private scores = { w: 0, b: 0 };
  private history: RoundResult[] = [];
  private pendingWhite: 'C' | 'D' | null = null;
  private currentTurn: PDColor = 'w';

  reset(): void {
    this.round = 1;
    this.scores = { w: 0, b: 0 };
    this.history = [];
    this.pendingWhite = null;
    this.currentTurn = 'w';
  }

  turn(): PDColor { return this.currentTurn; }
  getScores() { return { ...this.scores }; }
  getHistory() { return this.history; }
  getRound() { return this.round; }

  boardState(): string {
    // Encode history (revealed past rounds) + scores + round + turn.
    // pendingWhite is NOT encoded — keeps Black's prompt blind.
    const hist = this.history.map((r) => `${r.white}${r.black}`).join('');
    return `${hist} ${this.scores.w} ${this.scores.b} ${this.round} ${this.currentTurn}`;
  }

  boardForPrompt(): string {
    const lines: string[] = [
      `Round ${this.round}/${MAX_ROUNDS}`,
      `Your total: ${this.currentTurn === 'w' ? this.scores.w : this.scores.b} | Opponent total: ${this.currentTurn === 'w' ? this.scores.b : this.scores.w}`,
      '',
      'Payoffs (points this round):',
      '  You COOPERATE, they COOPERATE → you get 3',
      '  You COOPERATE, they DEFECT    → you get 0',
      '  You DEFECT,    they COOPERATE → you get 5',
      '  You DEFECT,    they DEFECT    → you get 1',
    ];
    if (this.history.length > 0) {
      lines.push('', 'History (you = ' + (this.currentTurn === 'w' ? 'first' : 'second') + ' column):');
      for (const r of this.history.slice(-8)) {
        const you = this.currentTurn === 'w' ? r.white : r.black;
        const them = this.currentTurn === 'w' ? r.black : r.white;
        lines.push(`  R${r.round}: you ${you === 'C' ? 'COOPERATE' : 'DEFECT'}, they ${them === 'C' ? 'COOPERATE' : 'DEFECT'}`);
      }
    } else {
      lines.push('', 'This is the first round.');
    }
    return lines.join('\n');
  }

  legalMoves(): string[] {
    return ['COOPERATE', 'DEFECT'];
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const choice = this.parseChoice(notation);
    if (!choice) return null;

    if (this.currentTurn === 'w') {
      this.pendingWhite = choice;
      this.currentTurn = 'b';
      return { san: `R${this.round}: White → ${choice === 'C' ? 'COOPERATE' : 'DEFECT'}` };
    } else {
      const white = this.pendingWhite!;
      const black = choice;
      const key = white + black;
      const [wp, bp] = PAYOFF[key];
      this.scores.w += wp;
      this.scores.b += bp;
      this.history.push({ round: this.round, white, black, whitePoints: wp, blackPoints: bp });
      const san = `R${this.round}: W ${white} / B ${black} → +${wp}/+${bp}`;
      this.pendingWhite = null;
      this.round++;
      this.currentTurn = 'w';
      return { san };
    }
  }

  private parseChoice(s: string): 'C' | 'D' | null {
    const u = s.trim().toUpperCase();
    if (u === 'COOPERATE' || u === 'C') return 'C';
    if (u === 'DEFECT' || u === 'D') return 'D';
    return null;
  }

  isGameOver(): boolean {
    return this.round > MAX_ROUNDS;
  }

  gameStatus(): PDStatus {
    if (!this.isGameOver()) return 'active';
    if (this.scores.w > this.scores.b) return 'white_wins';
    if (this.scores.b > this.scores.w) return 'black_wins';
    return 'draw';
  }
}
