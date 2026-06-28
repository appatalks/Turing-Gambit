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

const W = 760;
const LANE_H = 176;
const GAP = 14;
const H = LANE_H * 2 + GAP;
const TILE = 48;
const RED = '#e23b3b';
const GREEN = '#34a853';

interface Side {
  pos: number; check: number; falls: number; fin: boolean; event: string;
}
interface Parsed {
  L: number; round: number; track: string; w: Side; b: Side;
}

function parse(state: string): Parsed {
  const p = state.split(';');
  return {
    L: +p[0] || 48,
    round: +p[2] || 1,
    w: { pos: +p[3] || 0, check: +p[5] || 0, falls: +p[7] || 0, fin: p[9] === '1', event: p[12] || '' },
    b: { pos: +p[4] || 0, check: +p[6] || 0, falls: +p[8] || 0, fin: p[10] === '1', event: p[13] || '' },
    track: p[11] || '',
  };
}

export function MarioBoard({ boardState, interactive = false, onHumanMove, legalMoves = [], burst, onBurstComplete, countdown, executing, arcadeRun, onArcadeResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(parse(boardState));
  const runnerRef = useRef<ArcadeRunner | null>(null);
  const liveRef = useRef(false);
  // Direct position refs for smooth 60fps — no interpolation needed
  const posRef = useRef({ wX: 0, bX: 0, wVy: 0, bVy: 0 });
  const [statusText, setStatusText] = useState('');

  // ── Client-side 60fps arcade execution ──
  useEffect(() => {
    if (!arcadeRun || arcadeRun.game !== 'mario') return;

    // Human side doesn't need compiled code — ArcadeRunner overrides with keyboard
    const dummyFn = () => 'RUN';
    const wFn = arcadeRun.humanSide === 'w' ? dummyFn : compileStrategy(arcadeRun.whiteCode, 'mario').fn;
    const bFn = arcadeRun.humanSide === 'b' ? dummyFn : compileStrategy(arcadeRun.blackCode, 'mario').fn;
    if (!wFn || !bFn) { onArcadeResult?.({ winner: 'draw', reason: 'Compile error', ticks: 0 }); return; }

    liveRef.current = true;
    setStatusText(arcadeRun.humanSide ? '▶ Space/↑ = Jump · auto-runs forward' : '▶ Racing...');
    const runner = new ArcadeRunner('mario', wFn, bFn, {
      onFrame: (state) => {
        const s = stateRef.current;
        stateRef.current = {
          L: state.trackLength ?? s.L,
          round: state.tick ?? 0,
          track: state.track ?? s.track,
          w: { pos: (state.wPos as number) ?? 0, check: 0, falls: state.wFalls ?? 0, fin: state.wFinished ?? false, event: '' },
          b: { pos: (state.bPos as number) ?? 0, check: 0, falls: state.bFalls ?? 0, fin: state.bFinished ?? false, event: '' },
        };
        posRef.current = {
          wX: (state.wPos as number) ?? 0,
          bX: (state.bPos as number) ?? 0,
          wVy: (state.wVy as number) ?? 0,
          bVy: (state.bVy as number) ?? 0,
        };
      },
      onScore: () => {},
      onGameOver: (result) => {
        liveRef.current = false;
        setStatusText(`${result.reason}`);
        setTimeout(() => { onArcadeResult?.({ winner: result.winner, reason: result.reason, ticks: result.ticks }); }, 2000);
      },
    }, { humanSide: arcadeRun.humanSide || undefined });
    runnerRef.current = runner;
    runner.start();
    return () => { runner.stop(); runnerRef.current = null; liveRef.current = false; };
  }, [arcadeRun]);

  // Fallback: parse boardState when not in live mode
  useEffect(() => {
    if (liveRef.current) return;
    const next = parse(boardState);
    stateRef.current = next;
    posRef.current = { wX: next.w.pos, bX: next.b.pos, wVy: 0, bVy: 0 };
  }, [boardState]);

  // ── Canvas render loop — always running at 60fps ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const draw = (now: number) => {
      const s = stateRef.current;
      const p = posRef.current;

      for (const [key, laneY] of [['w', 0], ['b', LANE_H + GAP]] as const) {
        const x = key === 'w' ? p.wX : p.bX;
        const vy = key === 'w' ? p.wVy : p.bVy;
        const side = s[key];
        // Jump offset: vy is negative when ascending, positive when descending
        // Map vy to a visual Y offset (higher when vy is more negative)
        const yOff = vy < 0 ? vy * 160 : 0; // smooth arc

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, laneY, W, LANE_H);
        ctx.clip();
        ctx.translate(0, laneY);
        drawLane(ctx, s, side, x, key === 'w' ? RED : GREEN, yOff, now);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = stateRef.current;

  function play(action: string) {
    if (!interactive || !onHumanMove || !legalMoves.includes(action)) return;
    onHumanMove(action);
  }

  return (
    <div className="arcade-wrap">
      <div className="arcade-hud">
        <span className="arcade-tag" style={{ color: RED }}>● RED {Math.floor(posRef.current.wX)}/{s.L}</span>
        <span className="arcade-round">{statusText || `Tick ${s.round}`}</span>
        <span className="arcade-tag" style={{ color: GREEN }}>GREEN {Math.floor(posRef.current.bX)}/{s.L} ●</span>
      </div>
      <div className="arcade-stage">
        <canvas ref={canvasRef} width={W} height={H} className="arcade-canvas" />
      </div>
      <div className="arcade-caption">
        {statusText || (s.w.fin ? 'RED finished!' : s.b.fin ? 'GREEN finished!' : `Falls: RED ${s.w.falls} · GREEN ${s.b.falls}`)}
      </div>
      {interactive && (
        <div className="arcade-buttons">
          <button className="arcade-btn" onClick={() => play('RUN')}>▶ Run</button>
          <button className="arcade-btn" onClick={() => play('JUMP')}>⤴ Jump</button>
          <button className="arcade-btn" onClick={() => play('WAIT')}>■ Wait</button>
        </div>
      )}
    </div>
  );
}

function drawLane(ctx: CanvasRenderingContext2D, s: Parsed, side: Side, runnerX: number, color: string, yOff: number, now: number) {
  const groundTop = LANE_H - 40;
  const trackPx = (s.L + 1) * TILE;
  const cameraX = Math.max(0, Math.min(runnerX * TILE - W * 0.33, Math.max(0, trackPx - W)));

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, LANE_H);
  sky.addColorStop(0, '#5ec8f2');
  sky.addColorStop(1, '#bfe9ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, LANE_H);

  // Parallax clouds + hills
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 240 - cameraX * 0.25) % (W + 200) + W + 200) % (W + 200) - 100;
    cloud(ctx, cx, 26 + (i % 2) * 16);
  }
  ctx.fillStyle = '#7ec850';
  for (let i = 0; i < 6; i++) {
    const hx = ((i * 220 - cameraX * 0.5) % (W + 240) + W + 240) % (W + 240) - 120;
    ctx.beginPath();
    ctx.arc(hx, groundTop + 10, 70, Math.PI, 0);
    ctx.fill();
  }

  // Terrain
  const startI = Math.max(0, Math.floor(cameraX / TILE) - 1);
  const endI = Math.min(s.L, Math.ceil((cameraX + W) / TILE) + 1);
  for (let i = startI; i <= endI; i++) {
    const cell = s.track[i] || 'G';
    const x = i * TILE - cameraX;
    if (cell !== 'P') {
      ctx.fillStyle = '#7a4a24';
      ctx.fillRect(x, groundTop + 8, TILE + 1, LANE_H - groundTop);
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(x, groundTop, TILE + 1, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(x, groundTop + 8, TILE + 1, 3);
    }
    if (cell === '#') drawPipe(ctx, x, groundTop);
    if (cell === 'F') drawFlag(ctx, x, groundTop);
    if (i === side.check && side.check > 0 && cell !== 'P') drawCheckpoint(ctx, x, groundTop);
  }

  // Runner
  const rx = runnerX * TILE - cameraX + TILE * 0.5;
  const isJumping = yOff < -2;
  const runMode = isJumping ? 'jump' : runnerX > 0.1 ? 'run' : 'idle';
  drawRunner(ctx, rx, groundTop + yOff, color, runMode, now);

  // HUD label
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.font = '700 13px ui-sans-serif, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${color === RED ? 'RED' : 'GREEN'}  cell ${Math.floor(runnerX)}/${s.L}  ⚑${side.falls}`, 12, 20);
  if (side.fin) {
    ctx.fillStyle = '#ffcc00';
    ctx.font = '800 22px ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ FINISH! ★', W / 2, 40);
  }
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.arc(x + 18, y + 4, 20, 0, Math.PI * 2);
  ctx.arc(x + 40, y, 15, 0, Math.PI * 2);
  ctx.fill();
}

function drawPipe(ctx: CanvasRenderingContext2D, x: number, groundTop: number) {
  const pw = 34;
  const px = x + (TILE - pw) / 2;
  const top = groundTop - 46;
  ctx.fillStyle = '#1f9b4e';
  ctx.fillRect(px, top + 14, pw, 46);
  ctx.fillRect(px - 4, top, pw + 8, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(px + 4, top + 16, 5, 42);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(px + pw - 8, top + 16, 6, 42);
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, groundTop: number) {
  const fx = x + TILE * 0.4;
  ctx.fillStyle = '#cfd8dc';
  ctx.fillRect(fx, groundTop - 72, 4, 72);
  ctx.fillStyle = '#ffce00';
  ctx.beginPath();
  ctx.moveTo(fx + 4, groundTop - 72);
  ctx.lineTo(fx + 34, groundTop - 62);
  ctx.lineTo(fx + 4, groundTop - 52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(fx - 5, groundTop - 4, 14, 4);
}

function drawCheckpoint(ctx: CanvasRenderingContext2D, x: number, groundTop: number) {
  const fx = x + TILE * 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fx, groundTop); ctx.lineTo(fx, groundTop - 30);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(fx, groundTop - 30, 14, 9);
}

function drawRunner(ctx: CanvasRenderingContext2D, x: number, footY: number, color: string, mode: string, now: number) {
  const bob = mode === 'run' ? Math.sin(now / 70) * 2 : 0;
  const cy = footY - 26 + bob;
  const phase = Math.sin(now / 60);

  // Legs
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 4;
  const legSwing = mode === 'jump' ? 5 : phase * 6;
  ctx.beginPath();
  ctx.moveTo(x - 4, footY - 14); ctx.lineTo(x - 4 - legSwing, footY);
  ctx.moveTo(x + 4, footY - 14); ctx.lineTo(x + 4 + legSwing, footY);
  ctx.stroke();

  // Body
  ctx.fillStyle = color;
  roundRect(ctx, x - 10, cy - 4, 20, 22, 6);
  ctx.fill();

  // Head
  ctx.fillStyle = '#ffd9a8';
  ctx.beginPath();
  ctx.arc(x, cy - 12, 9, 0, Math.PI * 2);
  ctx.fill();

  // Cap
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, cy - 14, 9, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x, cy - 15, 13, 4);

  // Eye
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(x + 4, cy - 12, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Arm
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  const armY = mode === 'jump' ? cy - 6 : cy + 4;
  ctx.moveTo(x + 6, cy + 2); ctx.lineTo(x + 12, armY);
  ctx.stroke();
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
