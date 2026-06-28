// ─── Debate ─────────────────────────────────────────────
// Two AIs argue opposing sides of a resolution over N rounds.
// White = PRO (for), Black = CON (against). A judge model then
// scores the debate and declares a winner.

export type DebateColor = 'w' | 'b';
export type DebateStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';

const MAX_ROUNDS = 3; // arguments per side

const DEFAULT_TOPICS = [
  'Artificial general intelligence will be a net benefit to humanity.',
  'Social media has done more harm than good to society.',
  'Space colonization should be humanity\'s top priority.',
  'A universal basic income should be adopted globally.',
  'Privacy is more important than security.',
  'Remote work is better than working in an office.',
  'Nuclear energy is essential to fighting climate change.',
  'Genetic engineering of humans should be permitted.',
];

interface Argument {
  round: number;
  side: 'PRO' | 'CON';
  text: string;
}

export class DebateEngine {
  private topic: string;
  private round = 1;
  private currentTurn: DebateColor = 'w';
  private args: Argument[] = [];
  private verdict: { winner: DebateColor | 'draw'; reasoning: string } | null = null;

  constructor(topic?: string) {
    this.topic = (topic && topic.trim()) || DEFAULT_TOPICS[Math.floor(Math.random() * DEFAULT_TOPICS.length)];
  }

  reset(): void {
    this.round = 1;
    this.currentTurn = 'w';
    this.args = [];
    this.verdict = null;
  }

  turn(): DebateColor { return this.currentTurn; }
  getTopic() { return this.topic; }
  getArgs() { return this.args; }

  boardState(): string {
    // The UI reads the transcript from move history; encode meta here.
    const status = this.verdict ? `judged:${this.verdict.winner}` : 'debating';
    return `${this.round}|${this.currentTurn}|${status}|${this.topic}`;
  }

  boardForPrompt(): string {
    const side = this.currentTurn === 'w' ? 'PRO (arguing FOR)' : 'CON (arguing AGAINST)';
    const transcript = this.args.length > 0
      ? this.args.map((a) => `[${a.side} R${a.round}]: ${a.text}`).join('\n\n')
      : '(No arguments yet — you open the debate.)';
    return `RESOLUTION: "${this.topic}"

You are the ${side} side. Round ${this.round} of ${MAX_ROUNDS}.

Debate so far:
${transcript}`;
  }

  legalMoves(): string[] { return []; } // free text — any non-empty response valid

  makeMove(text: string): { san: string; captured?: string } | null {
    const clean = text.trim();
    if (!clean) return null;
    const side = this.currentTurn === 'w' ? 'PRO' : 'CON';
    this.args.push({ round: this.round, side, text: clean.slice(0, 1200) });
    const san = `[${side} R${this.round}] ${clean.slice(0, 60)}${clean.length > 60 ? '…' : ''}`;
    if (this.currentTurn === 'b') this.round++;
    this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';
    return { san };
  }

  argumentsComplete(): boolean {
    return this.args.length >= MAX_ROUNDS * 2;
  }

  isJudged(): boolean { return this.verdict !== null; }

  buildJudgePrompt(): string {
    const transcript = this.args.map((a) => `[${a.side} Round ${a.round}]:\n${a.text}`).join('\n\n');
    return `You are an impartial debate judge. Evaluate this debate on the resolution and declare a winner based ONLY on argument quality, evidence, logic, and rebuttals — not your own opinion on the topic.

RESOLUTION: "${this.topic}"

PRO = White, CON = Black.

TRANSCRIPT:
${transcript}

Decide the winner. Reply with your one-line reasoning, then on the FINAL line:
VERDICT: PRO
or
VERDICT: CON
or
VERDICT: DRAW`;
  }

  applyVerdict(raw: string): void {
    const m = raw.toUpperCase().match(/VERDICT[:\s]+(PRO|CON|DRAW)/);
    let winner: DebateColor | 'draw' = 'draw';
    if (m) {
      if (m[1] === 'PRO') winner = 'w';
      else if (m[1] === 'CON') winner = 'b';
    } else {
      // Fallback: scan for last mention
      const proIdx = raw.toUpperCase().lastIndexOf('PRO');
      const conIdx = raw.toUpperCase().lastIndexOf('CON');
      if (proIdx > conIdx) winner = 'w';
      else if (conIdx > proIdx) winner = 'b';
    }
    this.verdict = { winner, reasoning: raw.slice(0, 400) };
  }

  getVerdict() { return this.verdict; }

  isGameOver(): boolean {
    return this.verdict !== null;
  }

  gameStatus(): DebateStatus {
    if (!this.verdict) return 'active';
    if (this.verdict.winner === 'w') return 'white_wins';
    if (this.verdict.winner === 'b') return 'black_wins';
    return 'draw';
  }
}
