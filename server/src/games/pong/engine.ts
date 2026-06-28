// ─── Pong (tick-based paddle duel) ──────────────────────
// A real-time game expressed as discrete ticks so two LLMs can play it.
//
// Field is a WIDTH×HEIGHT grid. White controls the LEFT paddle (x=0),
// Black controls the RIGHT paddle (x=WIDTH-1). Each paddle spans 3 rows.
//
// Turn model (paired, like Prisoner's Dilemma): White commits a paddle
// action (hidden), then Black commits — and the world advances one physics
// tick using BOTH actions. This keeps the alternating w/b harness intact
// while modelling simultaneous play.

export type PongColor = 'w' | 'b';
export type PongStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';
export type PongAction = 'UP' | 'DOWN' | 'STAY';

export const PONG_WIDTH = 14;   // x: 0 .. 13
export const PONG_HEIGHT = 14;  // y: 0 .. 13
const CENTER_Y = Math.floor(PONG_HEIGHT / 2);
const PADDLE_HALF = 1;          // paddle covers [py-1, py, py+1]
const WIN_SCORE = 3;
const MAX_ROUNDS = 80;
const MAX_SPEED = 4;

export class PongEngine {
  private ballX = 7;
  private ballY = CENTER_Y;
  private velX: 1 | -1 = 1;
  private velY: -1 | 0 | 1 = 1;
  private speed = 1;    // ball sub-steps per tick — grows as a rally lengthens
  private rally = 0;    // consecutive returns since the last point
  private whiteP = CENTER_Y;   // paddle centre row (1 .. PONG_HEIGHT-2)
  private blackP = CENTER_Y;
  private scoreW = 0;
  private scoreB = 0;
  private round = 1;
  private currentTurn: PongColor = 'w';
  private pendingWhite: PongAction | null = null;
  private lastEvent = 'Kickoff — ball in play';

  reset(): void {
    this.ballX = 7; this.ballY = CENTER_Y; this.velX = 1; this.velY = 1;
    this.speed = 1; this.rally = 0;
    this.whiteP = CENTER_Y; this.blackP = CENTER_Y;
    this.scoreW = 0; this.scoreB = 0;
    this.round = 1; this.currentTurn = 'w';
    this.pendingWhite = null; this.lastEvent = 'Kickoff — ball in play';
  }

  turn(): PongColor { return this.currentTurn; }
  getMoveCount(): number { return this.round; }

  boardState(): string {
    // Pipe-delimited so the client can render the full field + scores.
    return [
      this.ballX, this.ballY, this.velX, this.velY,
      this.whiteP, this.blackP, this.scoreW, this.scoreB,
      this.round, this.currentTurn, this.lastEvent, this.speed,
    ].join('|');
  }

  legalMoves(): string[] {
    return ['UP', 'DOWN', 'STAY'];
  }

  /** Project where the ball will cross a side's wall, reflecting off top/bottom. */
  private predictIntercept(side: PongColor): number | null {
    const targetX = side === 'w' ? 0 : PONG_WIDTH - 1;
    // Heading away from this side → no intercept to plan for.
    if (side === 'w' && this.velX > 0) return null;
    if (side === 'b' && this.velX < 0) return null;
    let x = this.ballX, y = this.ballY, vy = this.velY as number;
    for (let i = 0; i < 64; i++) {
      x += this.velX;
      y += vy;
      if (y < 0) { y = 0; vy = 1; }
      if (y > PONG_HEIGHT - 1) { y = PONG_HEIGHT - 1; vy = -1; }
      if (x === targetX) return y;
      if (x < 0 || x > PONG_WIDTH - 1) return y;
    }
    return y;
  }

  boardForPrompt(side: PongColor): string {
    const myP = side === 'w' ? this.whiteP : this.blackP;
    const myWall = side === 'w' ? 0 : PONG_WIDTH - 1;
    const heading = side === 'w'
      ? (this.velX < 0 ? 'TOWARD you' : 'away from you')
      : (this.velX > 0 ? 'TOWARD you' : 'away from you');
    const intercept = this.predictIntercept(side);
    const lines: string[] = [
      `PONG — you control the ${side === 'w' ? 'LEFT' : 'RIGHT'} paddle at column x=${myWall}.`,
      `Field: ${PONG_WIDTH} wide × ${PONG_HEIGHT} tall. Rows 0 (top) .. ${PONG_HEIGHT - 1} (bottom).`,
      `Score — you ${side === 'w' ? this.scoreW : this.scoreB} : ${side === 'w' ? this.scoreB : this.scoreW} opponent. First to ${WIN_SCORE} wins.`,
      '',
      `Ball at (x=${this.ballX}, y=${this.ballY}), moving ${heading} (vx=${this.velX}, vy=${this.velY}).`,
      `Your paddle centre is row ${myP} (it covers rows ${Math.max(1, myP - PADDLE_HALF)}–${Math.min(PONG_HEIGHT - 2, myP + PADDLE_HALF)}).`,
    ];
    if (intercept !== null) {
      lines.push(`Projection: the ball will reach your wall at about row ${intercept}. Line your paddle centre up with row ${intercept}.`);
    } else {
      lines.push('The ball is moving away — recover toward the middle and wait.');
    }
    if (this.speed > 1) {
      lines.push(`Ball speed is ×${this.speed} — it crosses the court fast, so move toward the intercept now.`);
    }
    lines.push('', `Last tick: ${this.lastEvent}`);
    return lines.join('\n');
  }

  private parseAction(s: string): PongAction | null {
    const u = s.trim().toUpperCase();
    if (u === 'UP' || u === 'U') return 'UP';
    if (u === 'DOWN' || u === 'D') return 'DOWN';
    if (u === 'STAY' || u === 'S' || u === 'HOLD' || u === 'NONE') return 'STAY';
    return null;
  }

  private movePaddle(p: number, action: PongAction): number {
    const next = action === 'UP' ? p - 1 : action === 'DOWN' ? p + 1 : p;
    return Math.max(1, Math.min(PONG_HEIGHT - 2, next));
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const action = this.parseAction(notation);
    if (!action) return null;
    const arrow = action === 'UP' ? '↑' : action === 'DOWN' ? '↓' : '·';

    if (this.currentTurn === 'w') {
      this.pendingWhite = action;
      this.currentTurn = 'b';
      return { san: `R${this.round} L${arrow}` };
    }

    // Black commits → resolve the tick using both paddle actions.
    this.whiteP = this.movePaddle(this.whiteP, this.pendingWhite ?? 'STAY');
    this.blackP = this.movePaddle(this.blackP, action);
    this.pendingWhite = null;

    const scored = this.advanceBall();
    const san = `R${this.round} R${arrow} → ${this.lastEvent}`;
    this.round++;
    this.currentTurn = 'w';
    return { san, captured: scored ? 'point' : undefined };
  }

  /** Advance the ball `speed` sub-steps. Faster rallies give paddles less time to react. */
  private advanceBall(): boolean {
    for (let s = 0; s < this.speed; s++) {
      if (this.stepOnce()) return true; // a point ended the tick
    }
    return false;
  }

  /** One unit ball step with wall + paddle collisions. Returns true on a point. */
  private stepOnce(): boolean {
    let y = this.ballY + this.velY;
    if (y < 0) { y = 0; this.velY = 1; }
    if (y > PONG_HEIGHT - 1) { y = PONG_HEIGHT - 1; this.velY = -1; }
    const x = this.ballX + this.velX;

    // Left wall / white paddle
    if (x <= 0) {
      if (Math.abs(y - this.whiteP) <= PADDLE_HALF) {
        this.velX = 1;
        this.velY = clampVy(y - this.whiteP);
        this.ballX = 1; this.ballY = y;
        this.onReturn('LEFT');
        return false;
      }
      this.scoreB++;
      this.lastEvent = 'RIGHT scores! (left paddle missed)';
      this.serve('w');
      return true;
    }

    // Right wall / black paddle
    if (x >= PONG_WIDTH - 1) {
      if (Math.abs(y - this.blackP) <= PADDLE_HALF) {
        this.velX = -1;
        this.velY = clampVy(y - this.blackP);
        this.ballX = PONG_WIDTH - 2; this.ballY = y;
        this.onReturn('RIGHT');
        return false;
      }
      this.scoreW++;
      this.lastEvent = 'LEFT scores! (right paddle missed)';
      this.serve('b');
      return true;
    }

    this.ballX = x; this.ballY = y;
    this.lastEvent = 'rally continues';
    return false;
  }

  /** A paddle returned the ball — lengthen the rally and speed the ball up. */
  private onReturn(side: 'LEFT' | 'RIGHT'): void {
    this.rally++;
    this.speed = Math.min(MAX_SPEED, 1 + Math.floor(this.rally / 3));
    this.lastEvent = this.speed > 1
      ? `${side} paddle returns (ball speed ×${this.speed})`
      : `${side} paddle returns the ball`;
  }

  /** Reset the ball to centre, serving toward the side that was just scored on. */
  private serve(toward: PongColor): void {
    this.ballX = 7; this.ballY = CENTER_Y;
    this.velX = toward === 'w' ? -1 : 1;
    this.velY = ([-1, 0, 1] as const)[Math.floor(Math.random() * 3)];
    this.speed = 1; this.rally = 0;
  }

  isGameOver(): boolean {
    return this.gameStatus() !== 'active';
  }

  gameStatus(): PongStatus {
    if (this.scoreW >= WIN_SCORE) return 'white_wins';
    if (this.scoreB >= WIN_SCORE) return 'black_wins';
    if (this.round > MAX_ROUNDS) {
      if (this.scoreW > this.scoreB) return 'white_wins';
      if (this.scoreB > this.scoreW) return 'black_wins';
      return 'draw';
    }
    return 'active';
  }
}

function clampVy(offset: number): -1 | 0 | 1 {
  if (offset < 0) return -1;
  if (offset > 0) return 1;
  return 0;
}
