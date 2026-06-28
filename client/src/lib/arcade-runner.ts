// ─── Client-side Arcade Game Runner ──────────────────────
// Runs the game simulation locally at 60fps using compiled strategy functions.
// The server sends strategy code strings; we compile and execute them here
// with real physics interpolation for buttery-smooth animation.

export type GameId = 'pong' | 'tron' | 'mario';
export type Side = 'w' | 'b';

export interface RunnerCallbacks {
  onFrame: (state: GameState) => void;
  onScore: (side: Side, state: GameState) => void;
  onGameOver: (result: GameResult) => void;
}

export interface GameState {
  game: GameId;
  tick: number;
  // Pong
  ballX?: number; ballY?: number; ballVx?: number; ballVy?: number;
  paddleW?: number; paddleB?: number;
  scoreW?: number; scoreB?: number;
  speed?: number;
  // Tron
  grid?: number;
  wHead?: { x: number; y: number }; bHead?: { x: number; y: number };
  wTrail?: { x: number; y: number }[]; bTrail?: { x: number; y: number }[];
  wDir?: string; bDir?: string;
  wCrashed?: boolean; bCrashed?: boolean;
  // Mario
  trackLength?: number; track?: string;
  wPos?: number; bPos?: number;
  wVy?: number; bVy?: number;
  wOnGround?: boolean; bOnGround?: boolean;
  wFalls?: number; bFalls?: number;
  wFinished?: boolean; bFinished?: boolean;
  event?: string;
}

export interface GameResult {
  winner: 'white' | 'black' | 'draw';
  reason: string;
  ticks: number;
}

type StrategyFn = (state: Record<string, unknown>) => string;

// ─── Human Keyboard Input ────────────────────────────────
// Tracks which keys are currently held down for real-time human control.

export class HumanInput {
  private keys = new Set<string>();
  private game: GameId;

  constructor(game: GameId) {
    this.game = game;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown(e: KeyboardEvent) {
    this.keys.add(e.code);
  }
  private onKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.code);
  }

  /** Get the current action based on held keys. */
  getAction(): string {
    if (this.game === 'pong') {
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) return 'UP';
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) return 'DOWN';
      return 'STAY';
    }
    if (this.game === 'tron') {
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) return 'UP';
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) return 'DOWN';
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) return 'LEFT';
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) return 'RIGHT';
      return ''; // keep current direction
    }
    // Mario
    if (this.keys.has('Space') || this.keys.has('ArrowUp') || this.keys.has('KeyW')) return 'JUMP';
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) return 'WAIT';
    return 'RUN'; // default: always running forward
  }

  /** Create a strategy function that reads from keyboard state. */
  toStrategyFn(): StrategyFn {
    return () => this.getAction();
  }
}

// ─── Strategy Compiler (client-side) ─────────────────────

const FORBIDDEN = /\b(process|require|import|global|eval|Function|fetch|XMLHttpRequest|setTimeout|setInterval|Promise|async|await|__proto__|constructor)\b/;

export function compileStrategy(code: string, game: GameId): { fn: StrategyFn | null; error?: string } {
  const cleaned = code
    .replace(/^```(?:javascript|js|typescript|ts)?\n?/gm, '')
    .replace(/^```\s*$/gm, '')
    .trim();

  if (FORBIDDEN.test(cleaned)) {
    return { fn: null, error: 'Forbidden keyword in strategy code' };
  }

  try {
    const fn = new Function('state', cleaned) as StrategyFn;
    // Quick syntax check
    fn(Object.freeze({ game, side: 'w', tick: 0 }));
    return { fn };
  } catch (err: any) {
    return { fn: null, error: err.message };
  }
}

// ─── Pong Runner (continuous physics) ────────────────────

const PONG_W = 14;
const PONG_H = 14;
const PADDLE_HALF = 1;
const PONG_WIN = 3;
const PONG_BALL_SPEED = 0.12; // units per frame at base speed
const PONG_PADDLE_SPEED = 0.18; // units per frame
const PONG_SPEEDUP = 0.003; // speed increase per rally hit

interface PongState {
  bx: number; by: number; vx: number; vy: number;
  pw: number; pb: number;
  sw: number; sb: number;
  speed: number; rally: number;
  tick: number;
}

function initPong(): PongState {
  return { bx: 7, by: 7, vx: 1, vy: 0.7, pw: 7, pb: 7, sw: 0, sb: 0, speed: PONG_BALL_SPEED, rally: 0, tick: 0 };
}

function pongStrategyState(s: PongState, side: Side): Record<string, unknown> {
  return {
    game: 'pong', side, tick: s.tick,
    ballX: s.bx, ballY: s.by, velX: s.vx, velY: s.vy,
    myPaddle: side === 'w' ? s.pw : s.pb,
    oppPaddle: side === 'w' ? s.pb : s.pw,
    myScore: side === 'w' ? s.sw : s.sb,
    oppScore: side === 'w' ? s.sb : s.sw,
    courtWidth: PONG_W, courtHeight: PONG_H,
    speed: s.speed, rally: s.rally,
  };
}

function stepPong(s: PongState, wAction: string, bAction: string): { scored: boolean; event: string } {
  // Move paddles
  const move = (p: number, action: string) => {
    if (action === 'UP') return Math.max(1, p - PONG_PADDLE_SPEED);
    if (action === 'DOWN') return Math.min(PONG_H - 2, p + PONG_PADDLE_SPEED);
    return p;
  };
  s.pw = move(s.pw, wAction);
  s.pb = move(s.pb, bAction);

  // Move ball
  s.bx += s.vx * s.speed;
  s.by += s.vy * s.speed;

  // Top/bottom bounce
  if (s.by <= 0) { s.by = 0; s.vy = Math.abs(s.vy); }
  if (s.by >= PONG_H - 1) { s.by = PONG_H - 1; s.vy = -Math.abs(s.vy); }

  // Left paddle (white)
  if (s.bx <= 1) {
    if (Math.abs(s.by - s.pw) <= PADDLE_HALF + 0.3) {
      s.vx = Math.abs(s.vx);
      s.vy += (s.by - s.pw) * 0.3;
      s.bx = 1.1;
      s.rally++;
      s.speed = PONG_BALL_SPEED + s.rally * PONG_SPEEDUP;
      return { scored: false, event: 'LEFT returns' };
    }
    if (s.bx <= 0) {
      s.sb++;
      servePong(s, 'w');
      return { scored: true, event: 'RIGHT scores!' };
    }
  }

  // Right paddle (black)
  if (s.bx >= PONG_W - 2) {
    if (Math.abs(s.by - s.pb) <= PADDLE_HALF + 0.3) {
      s.vx = -Math.abs(s.vx);
      s.vy += (s.by - s.pb) * 0.3;
      s.bx = PONG_W - 2.1;
      s.rally++;
      s.speed = PONG_BALL_SPEED + s.rally * PONG_SPEEDUP;
      return { scored: false, event: 'RIGHT returns' };
    }
    if (s.bx >= PONG_W - 1) {
      s.sw++;
      servePong(s, 'b');
      return { scored: true, event: 'LEFT scores!' };
    }
  }

  s.tick++;
  return { scored: false, event: '' };
}

function servePong(s: PongState, toward: Side) {
  s.bx = 7; s.by = 7;
  s.vx = toward === 'w' ? -1 : 1;
  s.vy = (Math.random() - 0.5) * 1.4;
  s.speed = PONG_BALL_SPEED;
  s.rally = 0;
}

function pongToGameState(s: PongState): GameState {
  return {
    game: 'pong', tick: s.tick,
    ballX: s.bx, ballY: s.by, ballVx: s.vx, ballVy: s.vy,
    paddleW: s.pw, paddleB: s.pb,
    scoreW: s.sw, scoreB: s.sb,
    speed: s.speed,
  };
}

// ─── Tron Runner (discrete grid, smooth head movement) ───

const TRON_GRID = 18;
const TRON_MOVE_INTERVAL = 8; // frames per logical move

const DIRS: Record<string, { dx: number; dy: number }> = {
  UP: { dx: 0, dy: -1 }, DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 }, RIGHT: { dx: 1, dy: 0 },
};
const REVERSE: Record<string, string> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

interface TronState {
  wHead: { x: number; y: number }; bHead: { x: number; y: number };
  wDir: string; bDir: string;
  wTrail: { x: number; y: number }[]; bTrail: { x: number; y: number }[];
  occupied: Set<string>;
  wCrashed: boolean; bCrashed: boolean;
  tick: number; moveTick: number;
}

function initTron(): TronState {
  const wh = { x: 3, y: 9 }, bh = { x: TRON_GRID - 4, y: 9 };
  return {
    wHead: { ...wh }, bHead: { ...bh },
    wDir: 'RIGHT', bDir: 'LEFT',
    wTrail: [{ ...wh }], bTrail: [{ ...bh }],
    occupied: new Set([`3,9`, `${TRON_GRID - 4},9`]),
    wCrashed: false, bCrashed: false,
    tick: 0, moveTick: 0,
  };
}

function tronStrategyState(s: TronState, side: Side): Record<string, unknown> {
  const myHead = side === 'w' ? s.wHead : s.bHead;
  const oppHead = side === 'w' ? s.bHead : s.wHead;
  return {
    game: 'tron', side, tick: s.tick, grid: TRON_GRID,
    myHead: { ...myHead }, oppHead: { ...oppHead },
    myDir: side === 'w' ? s.wDir : s.bDir,
    oppDir: side === 'w' ? s.bDir : s.wDir,
    occupied: [...s.occupied],
    round: s.moveTick,
  };
}

function stepTron(s: TronState, wAction: string, bAction: string): string {
  s.tick++;
  if (s.tick % TRON_MOVE_INTERVAL !== 0) return '';
  s.moveTick++;

  // Validate directions
  if (wAction && wAction !== REVERSE[s.wDir] && DIRS[wAction]) s.wDir = wAction;
  if (bAction && bAction !== REVERSE[s.bDir] && DIRS[bAction]) s.bDir = bAction;

  const wNext = { x: s.wHead.x + DIRS[s.wDir].dx, y: s.wHead.y + DIRS[s.wDir].dy };
  const bNext = { x: s.bHead.x + DIRS[s.bDir].dx, y: s.bHead.y + DIRS[s.bDir].dy };

  const wHits = hits(wNext, s.occupied);
  const bHits = hits(bNext, s.occupied);
  const headOn = wNext.x === bNext.x && wNext.y === bNext.y;

  s.wCrashed = wHits || headOn;
  s.bCrashed = bHits || headOn;

  if (!s.wCrashed) {
    s.wHead = wNext;
    s.wTrail.push({ ...wNext });
    s.occupied.add(`${wNext.x},${wNext.y}`);
  }
  if (!s.bCrashed) {
    s.bHead = bNext;
    s.bTrail.push({ ...bNext });
    s.occupied.add(`${bNext.x},${bNext.y}`);
  }

  if (s.wCrashed && s.bCrashed) return 'Both crashed!';
  if (s.wCrashed) return 'Cyan crashed!';
  if (s.bCrashed) return 'Orange crashed!';
  return '';
}

function hits(p: { x: number; y: number }, occupied: Set<string>): boolean {
  if (p.x < 0 || p.y < 0 || p.x >= TRON_GRID || p.y >= TRON_GRID) return true;
  return occupied.has(`${p.x},${p.y}`);
}

function tronToGameState(s: TronState): GameState {
  return {
    game: 'tron', tick: s.tick, grid: TRON_GRID,
    wHead: { ...s.wHead }, bHead: { ...s.bHead },
    wTrail: [...s.wTrail], bTrail: [...s.bTrail],
    wDir: s.wDir, bDir: s.bDir,
    wCrashed: s.wCrashed, bCrashed: s.bCrashed,
  };
}

// ─── Mario Runner (continuous physics with gravity) ──────

const MARIO_LENGTH = 48;
const MARIO_RUN_SPEED = 0.10;  // cells per frame (faster pace)
const MARIO_JUMP_VY = -0.32;   // stronger jump
const MARIO_GRAVITY = 0.014;
const MARIO_DECISION_INTERVAL = 6; // check strategy more often (every 6 frames = ~10 decisions/sec)

interface MarioRunner {
  x: number; vy: number; onGround: boolean; checkpoint: number; falls: number; finished: boolean;
  stuckFrames: number; lastPos: number;
}
interface MarioState {
  track: string;
  w: MarioRunner; b: MarioRunner;
  tick: number; decisionTick: number;
}

function initMario(seed?: number): MarioState {
  const track = generateTrack(seed ?? Math.floor(Math.random() * 2 ** 31));
  return {
    track,
    w: { x: 0, vy: 0, onGround: true, checkpoint: 0, falls: 0, finished: false, stuckFrames: 0, lastPos: 0 },
    b: { x: 0, vy: 0, onGround: true, checkpoint: 0, falls: 0, finished: false, stuckFrames: 0, lastPos: 0 },
    tick: 0, decisionTick: 0,
  };
}

function generateTrack(seed: number): string {
  let a = seed >>> 0;
  const rng = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const cells = new Array(MARIO_LENGTH + 1).fill('G');
  let i = 5; // safe starting runway
  while (i < MARIO_LENGTH - 4) {
    if (rng() < 0.40) { // slightly less frequent hazards
      cells[i] = rng() < 0.5 ? 'P' : '#';
      cells[i + 1] = 'G'; // guaranteed safe landing
      cells[i + 2] = 'G'; // extra run-up after hazard
      i += 3 + Math.floor(rng() * 3); // wider spacing between hazards
    } else { i++; }
  }
  cells[MARIO_LENGTH] = 'F';
  return cells.join('');
}

function marioStrategyState(s: MarioState, side: Side): Record<string, unknown> {
  const me = side === 'w' ? s.w : s.b;
  const opp = side === 'w' ? s.b : s.w;
  const pos = Math.floor(me.x);
  return {
    game: 'mario', side, tick: s.tick, trackLength: MARIO_LENGTH,
    myPos: pos, oppPos: Math.floor(opp.x),
    track: s.track,
    nextCell: s.track[pos + 1] || 'F',
    cellAfter: s.track[pos + 2] || 'F',
    myFalls: me.falls, oppFalls: opp.falls,
    onGround: me.onGround,
    round: s.decisionTick,
    stuckFrames: me.stuckFrames, // how many frames with no progress
  };
}

function stepMario(s: MarioState, wAction: string, bAction: string): string {
  s.tick++;
  const isDecision = s.tick % MARIO_DECISION_INTERVAL === 0;
  if (isDecision) s.decisionTick++;

  let event = '';
  event += stepRunner(s.w, wAction, s.track, isDecision, 'RED');
  event += stepRunner(s.b, bAction, s.track, isDecision, 'GREEN');
  return event;
}

function stepRunner(r: MarioRunner, action: string, track: string, isDecision: boolean, name: string): string {
  if (r.finished) return '';

  const prevCell = Math.floor(r.x);

  // Apply action on decision frames
  if (isDecision && r.onGround) {
    if (action === 'JUMP') {
      r.vy = MARIO_JUMP_VY;
      r.onGround = false;
    }
    if (action === 'WAIT') {
      if (Math.floor(r.x) === r.lastPos) r.stuckFrames++;
      else { r.stuckFrames = 0; r.lastPos = Math.floor(r.x); }
      return '';
    }
  }

  // Forward motion — always moves forward
  const speed = r.onGround ? MARIO_RUN_SPEED : MARIO_RUN_SPEED * 1.2; // slightly faster in air
  const aheadIdx = Math.floor(r.x + speed + 0.01);
  const aheadCell = track[aheadIdx] || 'G';

  // Pipes only block on ground; in the air you sail over them
  const blocked = r.onGround && aheadCell === '#' && aheadIdx > Math.floor(r.x);

  if (!blocked) {
    r.x += speed;
  }

  // Gravity / jump arc
  if (!r.onGround) {
    r.vy += MARIO_GRAVITY;
    if (r.vy >= 0) {
      r.onGround = true;
      r.vy = 0;
    }
  }

  // Check landing cell
  const cellIdx = Math.floor(r.x);
  if (cellIdx >= MARIO_LENGTH) {
    r.x = MARIO_LENGTH;
    r.finished = true;
    r.checkpoint = MARIO_LENGTH;
    r.stuckFrames = 0;
    return `${name} finished! `;
  }

  const cell = track[cellIdx];
  // Only pits matter when on ground (in the air you fly over them)
  if (cell === 'P' && r.onGround) {
    r.x = r.checkpoint;
    r.falls++;
    r.vy = 0;
    r.onGround = true;
    r.stuckFrames = 0;
    return `${name} fell! `;
  }

  // Update checkpoint on safe ground
  if (r.onGround && cell === 'G' && cellIdx > r.checkpoint) {
    r.checkpoint = cellIdx;
  }

  // Track stuck state
  if (Math.floor(r.x) === r.lastPos) {
    r.stuckFrames++;
  } else {
    r.stuckFrames = 0;
    r.lastPos = Math.floor(r.x);
  }

  // Auto-unstick: if stuck for ~1.5 sec, force a jump
  if (r.stuckFrames > 90 && r.onGround) {
    r.vy = MARIO_JUMP_VY;
    r.onGround = false;
    r.stuckFrames = 0;
    return `${name} auto-jumped! `;
  }

  return '';
}

function marioToGameState(s: MarioState): GameState {
  return {
    game: 'mario', tick: s.tick, trackLength: MARIO_LENGTH,
    track: s.track,
    wPos: s.w.x, bPos: s.b.x,
    wVy: s.w.vy, bVy: s.b.vy,
    wOnGround: s.w.onGround, bOnGround: s.b.onGround,
    wFalls: s.w.falls, bFalls: s.b.falls,
    wFinished: s.w.finished, bFinished: s.b.finished,
  };
}

// ─── Unified Game Runner ─────────────────────────────────

export class ArcadeRunner {
  private game: GameId;
  private pong: PongState | null = null;
  private tron: TronState | null = null;
  private mario: MarioState | null = null;
  private whiteFn: StrategyFn;
  private blackFn: StrategyFn;
  private callbacks: RunnerCallbacks;
  private raf = 0;
  private running = false;
  private maxTicks: number;
  private wAction = 'STAY';
  private bAction = 'STAY';
  private humanInput: HumanInput | null = null;
  private humanSide: Side | null;

  constructor(game: GameId, whiteFn: StrategyFn, blackFn: StrategyFn, callbacks: RunnerCallbacks, options?: { maxTicks?: number; humanSide?: Side }) {
    this.game = game;
    this.whiteFn = whiteFn;
    this.blackFn = blackFn;
    this.callbacks = callbacks;
    this.maxTicks = options?.maxTicks ?? 5000;
    this.humanSide = options?.humanSide ?? null;

    if (this.humanSide) {
      this.humanInput = new HumanInput(game);
      // Replace the human side's strategy with keyboard input
      if (this.humanSide === 'w') this.whiteFn = this.humanInput.toStrategyFn();
      else this.blackFn = this.humanInput.toStrategyFn();
    }

    if (game === 'pong') this.pong = initPong();
    else if (game === 'tron') this.tron = initTron();
    else this.mario = initMario();
  }

  start() {
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.humanInput?.destroy();
    this.humanInput = null;
  }

  private loop = () => {
    if (!this.running) return;

    this.step();
    const state = this.getState();
    this.callbacks.onFrame(state);

    // Check game over
    const result = this.checkGameOver();
    if (result) {
      this.running = false;
      this.callbacks.onGameOver(result);
      return;
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private step() {
    if (this.game === 'pong' && this.pong) {
      // Query strategies every frame (they're local, instant)
      this.wAction = this.safeCall(this.whiteFn, pongStrategyState(this.pong, 'w'));
      this.bAction = this.safeCall(this.blackFn, pongStrategyState(this.pong, 'b'));
      const { scored, event } = stepPong(this.pong, this.wAction, this.bAction);
      if (scored) this.callbacks.onScore(event.includes('LEFT') ? 'w' : 'b', this.getState());
    } else if (this.game === 'tron' && this.tron) {
      // Query every move interval
      if (this.tron.tick % TRON_MOVE_INTERVAL === 0) {
        this.wAction = this.safeCall(this.whiteFn, tronStrategyState(this.tron, 'w'));
        this.bAction = this.safeCall(this.blackFn, tronStrategyState(this.tron, 'b'));
      }
      stepTron(this.tron, this.wAction, this.bAction);
      this.tron.tick++;
    } else if (this.game === 'mario' && this.mario) {
      if (this.mario.tick % MARIO_DECISION_INTERVAL === 0) {
        this.wAction = this.safeCall(this.whiteFn, marioStrategyState(this.mario, 'w'));
        this.bAction = this.safeCall(this.blackFn, marioStrategyState(this.mario, 'b'));
      }
      stepMario(this.mario, this.wAction, this.bAction);
    }
  }

  private safeCall(fn: StrategyFn, state: Record<string, unknown>): string {
    try {
      const result = fn(Object.freeze({ ...state }));
      return String(result || '').trim().toUpperCase();
    } catch {
      return 'STAY'; // safe fallback
    }
  }

  private getState(): GameState {
    if (this.pong) return pongToGameState(this.pong);
    if (this.tron) return tronToGameState(this.tron);
    if (this.mario) return marioToGameState(this.mario);
    return { game: this.game, tick: 0 };
  }

  private checkGameOver(): GameResult | null {
    if (this.pong) {
      if (this.pong.sw >= PONG_WIN) return { winner: 'white', reason: 'Left paddle wins!', ticks: this.pong.tick };
      if (this.pong.sb >= PONG_WIN) return { winner: 'black', reason: 'Right paddle wins!', ticks: this.pong.tick };
      if (this.pong.tick > this.maxTicks) {
        if (this.pong.sw > this.pong.sb) return { winner: 'white', reason: 'Time — Left leads', ticks: this.pong.tick };
        if (this.pong.sb > this.pong.sw) return { winner: 'black', reason: 'Time — Right leads', ticks: this.pong.tick };
        return { winner: 'draw', reason: 'Time limit — tied', ticks: this.pong.tick };
      }
    }
    if (this.tron) {
      if (this.tron.wCrashed && this.tron.bCrashed) return { winner: 'draw', reason: 'Both crashed!', ticks: this.tron.tick };
      if (this.tron.wCrashed) return { winner: 'black', reason: 'Cyan crashed!', ticks: this.tron.tick };
      if (this.tron.bCrashed) return { winner: 'white', reason: 'Orange crashed!', ticks: this.tron.tick };
      if (this.tron.moveTick > 300) return { winner: 'draw', reason: 'Time limit', ticks: this.tron.tick };
    }
    if (this.mario) {
      const { w, b } = this.mario;
      if (w.finished && b.finished) {
        return { winner: 'draw', reason: 'Dead heat!', ticks: this.mario.tick };
      }
      if (w.finished) return { winner: 'white', reason: 'Red reaches the flag!', ticks: this.mario.tick };
      if (b.finished) return { winner: 'black', reason: 'Green reaches the flag!', ticks: this.mario.tick };
      if (this.mario.tick > this.maxTicks) {
        if (w.x > b.x) return { winner: 'white', reason: 'Time — Red leads', ticks: this.mario.tick };
        if (b.x > w.x) return { winner: 'black', reason: 'Time — Green leads', ticks: this.mario.tick };
        return { winner: 'draw', reason: 'Time — tied', ticks: this.mario.tick };
      }
    }
    return null;
  }
}
