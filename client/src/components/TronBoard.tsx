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

const CYAN = '#22d3ee';
const ORANGE = '#fb923c';

interface Parsed {
  grid: number; round: number; event: string;
  wHead: [number, number]; bHead: [number, number];
  wCrash: boolean; bCrash: boolean;
  wTrail: [number, number][]; bTrail: [number, number][];
}

function cells(s: string): [number, number][] {
  if (!s) return [];
  return s.split(' ').filter(Boolean).map((c) => {
    const [x, y] = c.split(',').map(Number);
    return [x, y] as [number, number];
  });
}

function parse(state: string): Parsed {
  const p = state.split(';');
  const head = (s: string): [number, number] => {
    const [x, y] = (s || '0,0').split(',').map(Number);
    return [x || 0, y || 0];
  };
  return {
    grid: +p[0] || 18,
    round: +p[2] || 1,
    event: p[3] || '',
    wHead: head(p[4]), bHead: head(p[5]),
    wCrash: p[8] === '1', bCrash: p[9] === '1',
    wTrail: cells(p[10]), bTrail: cells(p[11]),
  };
}

export function TronBoard({ boardState, interactive = false, onHumanMove, legalMoves = [], burst, onBurstComplete, countdown, executing, arcadeRun, onArcadeResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(parse(boardState));
  const runnerRef = useRef<ArcadeRunner | null>(null);
  const [replayIdx, setReplayIdx] = useState(-1);
  const [countdownSec, setCountdownSec] = useState(0);
  const [statusText, setStatusText] = useState('');

  // ── Client-side 60fps arcade execution ──
  useEffect(() => {
    if (!arcadeRun || arcadeRun.game !== 'tron') return;
    const dummyFn = () => '';
    const wFn = arcadeRun.humanSide === 'w' ? dummyFn : compileStrategy(arcadeRun.whiteCode, 'tron').fn;
    const bFn = arcadeRun.humanSide === 'b' ? dummyFn : compileStrategy(arcadeRun.blackCode, 'tron').fn;
    if (!wFn || !bFn) { onArcadeResult?.({ winner: 'draw', reason: 'Compile error', ticks: 0 }); return; }

    setStatusText(arcadeRun.humanSide ? '▶ Use ↑↓←→ keys to steer' : '▶ Playing...');
    const runner = new ArcadeRunner('tron', wFn, bFn, {
      onFrame: (state) => {
        stateRef.current = {
          grid: state.grid ?? 18, round: state.tick ?? 0, event: statusText,
          wHead: state.wHead ? [state.wHead.x, state.wHead.y] as [number, number] : [3, 9],
          bHead: state.bHead ? [state.bHead.x, state.bHead.y] as [number, number] : [14, 9],
          wCrash: state.wCrashed ?? false, bCrash: state.bCrashed ?? false,
          wTrail: (state.wTrail || []).map(p => [p.x, p.y] as [number, number]),
          bTrail: (state.bTrail || []).map(p => [p.x, p.y] as [number, number]),
        };
      },
      onScore: () => {},
      onGameOver: (result) => {
        setStatusText(`Game Over: ${result.reason}`);
        setTimeout(() => { onArcadeResult?.({ winner: result.winner, reason: result.reason, ticks: result.ticks }); }, 1500);
      },
    }, { humanSide: arcadeRun.humanSide || undefined });
    runnerRef.current = runner;
    runner.start();
    return () => { runner.stop(); runnerRef.current = null; };
  }, [arcadeRun]);

  // Burst replay
  useEffect(() => {
    if (!burst || burst.frames.length === 0) { setReplayIdx(-1); return; }
    setReplayIdx(0);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i >= burst.frames.length) { clearInterval(iv); setReplayIdx(-1); onBurstComplete?.(); return; }
      setReplayIdx(i);
    }, 100);
    return () => clearInterval(iv);
  }, [burst]);

  useEffect(() => {
    if (replayIdx >= 0 && burst && burst.frames[replayIdx]) {
      stateRef.current = parse(burst.frames[replayIdx].boardState);
    }
  }, [replayIdx]);

  useEffect(() => {
    if (!countdown) { setCountdownSec(0); return; }
    const end = Date.now() + countdown.durationMs;
    setCountdownSec(Math.ceil(countdown.durationMs / 1000));
    const iv = setInterval(() => {
      const r = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setCountdownSec(r);
      if (r <= 0) clearInterval(iv);
    }, 200);
    return () => clearInterval(iv);
  }, [countdown]);

  useEffect(() => { if (replayIdx < 0) stateRef.current = parse(boardState); }, [boardState]);

  const grid = stateRef.current.grid;
  const CELL = Math.floor(468 / grid);
  const SIZE = CELL * grid;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const draw = (now: number) => {
      const s = stateRef.current;
      const pulse = 0.6 + 0.4 * Math.sin(now / 260);

      // Arena
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.strokeStyle = 'rgba(80,120,200,0.10)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= grid; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(120,160,255,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2);

      drawTrail(ctx, s.wTrail, CYAN, CELL);
      drawTrail(ctx, s.bTrail, ORANGE, CELL);
      drawHead(ctx, s.wHead, CYAN, CELL, pulse, s.wCrash);
      drawHead(ctx, s.bHead, ORANGE, CELL, pulse, s.bCrash);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [grid, CELL, SIZE]);

  const s = stateRef.current;

  function play(dir: string) {
    if (!interactive || !onHumanMove || !legalMoves.includes(dir)) return;
    onHumanMove(dir);
  }

  return (
    <div className="arcade-wrap">
      <div className="arcade-hud">
        <span className="arcade-tag" style={{ color: CYAN }}>● CYAN</span>
        <span className="arcade-round">Tick {s.round}</span>
        <span className="arcade-tag" style={{ color: ORANGE }}>ORANGE ●</span>
      </div>
      <div className="arcade-stage">
        <canvas ref={canvasRef} width={SIZE} height={SIZE} className="arcade-canvas" />
      </div>
      <div className="arcade-caption">
        {replayIdx >= 0 && burst
          ? `▶ Replaying tick ${replayIdx + 1}/${burst.frames.length}`
          : executing
            ? '⚡ Executing strategies...'
            : countdownSec > 0
              ? `⏱ Submit strategy in ${countdownSec}s`
              : s.event}
      </div>
      {interactive && (
        <div className="arcade-buttons arcade-dpad">
          <button className="arcade-btn" onClick={() => play('UP')}>▲</button>
          <div>
            <button className="arcade-btn" onClick={() => play('LEFT')}>◀</button>
            <button className="arcade-btn" onClick={() => play('RIGHT')}>▶</button>
          </div>
          <button className="arcade-btn" onClick={() => play('DOWN')}>▼</button>
        </div>
      )}
    </div>
  );
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: [number, number][], color: string, CELL: number) {
  if (trail.length === 0) return;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  const pad = Math.max(2, CELL * 0.16);
  for (const [x, y] of trail) {
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x * CELL + pad / 2, y * CELL + pad / 2, CELL - pad, CELL - pad);
  }
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, head: [number, number], color: string, CELL: number, pulse: number, crashed: boolean) {
  const [x, y] = head;
  ctx.save();
  ctx.shadowColor = crashed ? '#ff3b3b' : color;
  ctx.shadowBlur = 22 * pulse;
  ctx.fillStyle = crashed ? '#ff5555' : '#ffffff';
  const pad = CELL * 0.08;
  ctx.fillRect(x * CELL + pad, y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
  ctx.restore();
}
