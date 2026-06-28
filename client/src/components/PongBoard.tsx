import { useEffect, useRef, useState } from 'react';
import type { StrategyBurst, StrategyCountdown, ArcadeRunEvent } from '../hooks/useSocket';
import { ArcadeRunner, compileStrategy, type GameState } from '../lib/arcade-runner';

interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
  burst?: StrategyBurst | null;
  onBurstComplete?: () => void;
  countdown?: StrategyCountdown | null;
  executing?: boolean;
  arcadeRun?: ArcadeRunEvent | null;
  onArcadeResult?: (result: { winner: string; reason: string; ticks: number; feedback?: string }) => void;
}

const COLS = 14;
const ROWS = 14;
const CELL = 40;
const W = COLS * CELL;
const H = ROWS * CELL;
const CYAN = '#22d3ee';
const ORANGE = '#fb923c';

interface Frame {
  ballX: number; ballY: number;
  whiteP: number; blackP: number;
}

function parse(state: string) {
  const p = state.split('|');
  return {
    ballX: +p[0] || 7, ballY: +p[1] || 7,
    velX: +p[2] || 1, velY: +p[3] || 0,
    whiteP: +p[4] || 7, blackP: +p[5] || 7,
    scoreW: +p[6] || 0, scoreB: +p[7] || 0,
    round: +p[8] || 1, turn: p[9] || 'w',
    event: p[10] || '',
    speed: +p[11] || 1,
  };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function PongBoard({ boardState, interactive = false, onHumanMove, legalMoves = [], burst, onBurstComplete, countdown, executing, arcadeRun, onArcadeResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dispRef = useRef<Frame>({ ballX: 7, ballY: 7, whiteP: 7, blackP: 7 });
  const prevRef = useRef<Frame>({ ballX: 7, ballY: 7, whiteP: 7, blackP: 7 });
  const targetRef = useRef(parse(boardState));
  const startRef = useRef(0);
  const snapRef = useRef(false);
  const runnerRef = useRef<ArcadeRunner | null>(null);
  const [replayIdx, setReplayIdx] = useState(-1);
  const [countdownSec, setCountdownSec] = useState(0);
  const [liveState, setLiveState] = useState<GameState | null>(null);
  const [statusText, setStatusText] = useState('');

  // ── Client-side 60fps arcade execution ──
  useEffect(() => {
    if (!arcadeRun || arcadeRun.game !== 'pong') return;

    const dummyFn = () => 'STAY';
    const wFn = arcadeRun.humanSide === 'w' ? dummyFn : compileStrategy(arcadeRun.whiteCode, 'pong').fn;
    const bFn = arcadeRun.humanSide === 'b' ? dummyFn : compileStrategy(arcadeRun.blackCode, 'pong').fn;

    if (!wFn || !bFn) {
      onArcadeResult?.({ winner: 'draw', reason: 'Strategy compile error', ticks: 0 });
      return;
    }

    setStatusText(arcadeRun.humanSide ? '▶ Use ↑↓ keys to move your paddle' : '▶ Playing...');
    const runner = new ArcadeRunner('pong', wFn, bFn, {
      onFrame: (state) => {
        setLiveState(state);
      },
      onScore: (_side, state) => {
        setStatusText(`Score! ${state.scoreW} - ${state.scoreB}`);
      },
      onGameOver: (result) => {
        setStatusText(`Game Over: ${result.reason}`);
        setTimeout(() => {
          onArcadeResult?.({ winner: result.winner, reason: result.reason, ticks: result.ticks });
        }, 1500);
      },
    }, { humanSide: arcadeRun.humanSide || undefined });

    runnerRef.current = runner;
    runner.start();

    return () => { runner.stop(); runnerRef.current = null; };
  }, [arcadeRun]);

  // Feed live game state into the renderer
  useEffect(() => {
    if (!liveState || liveState.game !== 'pong') return;
    const next: typeof targetRef.current = {
      ballX: liveState.ballX ?? 7,
      ballY: liveState.ballY ?? 7,
      velX: liveState.ballVx ?? 1,
      velY: liveState.ballVy ?? 0,
      whiteP: liveState.paddleW ?? 7,
      blackP: liveState.paddleB ?? 7,
      scoreW: liveState.scoreW ?? 0,
      scoreB: liveState.scoreB ?? 0,
      round: liveState.tick ?? 0,
      turn: 'w',
      event: statusText,
      speed: liveState.speed ?? 1,
    };
    prevRef.current = { ...dispRef.current };
    snapRef.current = false; // smooth interpolation for live play
    targetRef.current = next;
    startRef.current = performance.now();
  }, [liveState]);

  // Burst replay: step through frames at ~80ms each
  useEffect(() => {
    if (!burst || burst.frames.length === 0) { setReplayIdx(-1); return; }
    setReplayIdx(0);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i >= burst.frames.length) {
        clearInterval(iv);
        setReplayIdx(-1);
        onBurstComplete?.();
        return;
      }
      setReplayIdx(i);
    }, 80);
    return () => clearInterval(iv);
  }, [burst]);

  // Feed replay frames into the render target
  useEffect(() => {
    if (replayIdx >= 0 && burst && burst.frames[replayIdx]) {
      const frame = burst.frames[replayIdx];
      const next = parse(frame.boardState);
      prevRef.current = { ...dispRef.current };
      snapRef.current = Math.abs(next.ballX - prevRef.current.ballX) > 3;
      targetRef.current = next;
      startRef.current = performance.now();
    }
  }, [replayIdx]);

  // Countdown timer for human strategy submission
  useEffect(() => {
    if (!countdown) { setCountdownSec(0); return; }
    const end = Date.now() + countdown.durationMs;
    setCountdownSec(Math.ceil(countdown.durationMs / 1000));
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setCountdownSec(remaining);
      if (remaining <= 0) clearInterval(iv);
    }, 200);
    return () => clearInterval(iv);
  }, [countdown]);

  useEffect(() => {
    const next = parse(boardState);
    if (replayIdx >= 0) return; // don't overwrite during replay
    prevRef.current = { ...dispRef.current };
    snapRef.current = Math.abs(next.ballX - prevRef.current.ballX) > 3;
    targetRef.current = next;
    startRef.current = performance.now();
  }, [boardState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const draw = (now: number) => {
      const t = snapRef.current ? 1 : Math.min(1, (now - startRef.current) / 160);
      const prev = prevRef.current;
      const tg = targetRef.current;
      const d: Frame = {
        ballX: lerp(prev.ballX, tg.ballX, t),
        ballY: lerp(prev.ballY, tg.ballY, t),
        whiteP: lerp(prev.whiteP, tg.whiteP, t),
        blackP: lerp(prev.blackP, tg.blackP, t),
      };
      dispRef.current = d;

      // Court
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 16]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);

      // Scores
      ctx.font = '700 56px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(34,211,238,0.25)';
      ctx.fillText(String(tg.scoreW), W * 0.32, H * 0.30);
      ctx.fillStyle = 'rgba(251,146,60,0.25)';
      ctx.fillText(String(tg.scoreB), W * 0.68, H * 0.30);

      // Paddles
      const paddleH = 3 * CELL - 10;
      const paddleW = 12;
      drawPaddle(ctx, CELL * 0.5 - paddleW / 2, (d.whiteP + 0.5) * CELL - paddleH / 2, paddleW, paddleH, CYAN);
      drawPaddle(ctx, W - CELL * 0.5 - paddleW / 2, (d.blackP + 0.5) * CELL - paddleH / 2, paddleW, paddleH, ORANGE);

      // Ball with glow + motion trail
      const bx = (d.ballX + 0.5) * CELL;
      const by = (d.ballY + 0.5) * CELL;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bx, by, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const tg = targetRef.current;

  function play(action: string) {
    if (!interactive || !onHumanMove || !legalMoves.includes(action)) return;
    onHumanMove(action);
  }

  return (
    <div className="arcade-wrap">
      <div className="arcade-hud">
        <span className="arcade-tag" style={{ color: CYAN }}>● LEFT {tg.scoreW}</span>
        <span className="arcade-round">Rally {tg.round}{tg.speed > 1 ? ` · ⚡×${tg.speed}` : ''}</span>
        <span className="arcade-tag" style={{ color: ORANGE }}>RIGHT {tg.scoreB} ●</span>
      </div>
      <div className="arcade-stage">
        <canvas ref={canvasRef} width={W} height={H} className="arcade-canvas" />
      </div>
      <div className="arcade-caption">
        {replayIdx >= 0 && burst
          ? `▶ Replaying tick ${replayIdx + 1}/${burst.frames.length}`
          : executing
            ? '⚡ Executing strategies...'
            : countdownSec > 0
              ? `⏱ Submit strategy in ${countdownSec}s`
              : tg.event}
      </div>
      {interactive && (
        <div className="arcade-buttons">
          <button className="arcade-btn" onClick={() => play('UP')}>▲ Up</button>
          <button className="arcade-btn" onClick={() => play('STAY')}>● Hold</button>
          <button className="arcade-btn" onClick={() => play('DOWN')}>▼ Down</button>
        </div>
      )}
    </div>
  );
}

function drawPaddle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, 5);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
