// ─── Strategy Burst Runner ───────────────────────────────
// Runs N ticks of an arcade game using compiled strategy functions for both
// sides, collecting frame snapshots for smooth client-side replay.
//
// After the burst, the match-manager can send frames to the client and then
// ask models to revise their strategies based on what happened.

import type { StrategyState } from './strategy-sandbox.js';
import { executeStrategy } from './strategy-sandbox.js';
import type { PongEngine } from './games/pong/engine.js';
import type { TronEngine } from './games/tron/engine.js';
import type { MarioEngine } from './games/mario/engine.js';

export interface BurstFrame {
  tick: number;
  boardState: string;
  actions: { w: string; b: string };
  events: string[];
}

export interface BurstResult {
  frames: BurstFrame[];
  finalState: string;
  gameOver: boolean;
  status: string;
  errors: { w: string[]; b: string[] };
  summary: string; // human-readable summary for the model
}

export type ArcadeEngine = PongEngine | TronEngine | MarioEngine;

type StrategyFn = (state: StrategyState) => string;

/**
 * Run a burst of ticks using both strategy functions.
 * @param engine - The arcade game engine (mutated in place)
 * @param game - 'pong' | 'tron' | 'mario'
 * @param whiteFn - Compiled strategy for white/left/cyan/red
 * @param blackFn - Compiled strategy for black/right/orange/green
 * @param maxTicks - Maximum ticks in this burst (default 30)
 */
export function runBurst(
  engine: ArcadeEngine,
  game: string,
  whiteFn: StrategyFn,
  blackFn: StrategyFn,
  maxTicks = 30,
): BurstResult {
  const frames: BurstFrame[] = [];
  const errors: { w: string[]; b: string[] } = { w: [], b: [] };
  let scored = false;

  for (let t = 0; t < maxTicks; t++) {
    if (engine.isGameOver()) break;

    // Build state for white
    const wState = buildState(engine, game, 'w');
    const wResult = executeStrategy(whiteFn, wState, game);
    if (wResult.error) errors.w.push(`tick ${t}: ${wResult.error}`);

    // White commits (turn → b)
    const wApply = engine.makeMove(wResult.action);
    if (!wApply) {
      // Shouldn't happen with valid actions; use fallback
      const fallback = engine.legalMoves()[0];
      engine.makeMove(fallback);
    }

    if (engine.isGameOver()) {
      frames.push({
        tick: t,
        boardState: engine.boardState(),
        actions: { w: wResult.action, b: '-' },
        events: [wApply?.san || 'white moved'],
      });
      break;
    }

    // Build state for black
    const bState = buildState(engine, game, 'b');
    const bResult = executeStrategy(blackFn, bState, game);
    if (bResult.error) errors.b.push(`tick ${t}: ${bResult.error}`);

    // Black commits (resolves the tick)
    const bApply = engine.makeMove(bResult.action);
    if (!bApply) {
      const fallback = engine.legalMoves()[0];
      engine.makeMove(fallback);
    }

    const events: string[] = [];
    if (wApply?.san) events.push(wApply.san);
    if (bApply?.san) events.push(bApply.san);
    if (bApply?.captured) scored = true;

    frames.push({
      tick: t,
      boardState: engine.boardState(),
      actions: { w: wResult.action, b: bResult.action },
      events,
    });

    // Stop burst early on a scoring event (point, crash, finish)
    if (scored) break;
  }

  const status = engine.isGameOver() ? engine.gameStatus() : 'active';
  const summary = buildSummary(frames, errors, game, status);

  return {
    frames,
    finalState: engine.boardState(),
    gameOver: engine.isGameOver(),
    status,
    errors,
    summary,
  };
}

/** Build a state object that the strategy function receives. */
function buildState(engine: ArcadeEngine, game: string, side: 'w' | 'b'): StrategyState {
  const raw = engine.boardState();

  if (game === 'pong') {
    const p = raw.split('|');
    const myPaddle = side === 'w' ? +p[4] : +p[5];
    const oppPaddle = side === 'w' ? +p[5] : +p[4];
    return {
      game: 'pong',
      side,
      ballX: +p[0], ballY: +p[1],
      velX: +p[2], velY: +p[3],
      myPaddle, oppPaddle,
      myScore: side === 'w' ? +p[6] : +p[7],
      oppScore: side === 'w' ? +p[7] : +p[6],
      round: +p[8],
      speed: +p[11] || 1,
      courtWidth: 14, courtHeight: 14,
    };
  }

  if (game === 'tron') {
    const p = raw.split(';');
    const grid = +p[0];
    const wHead = p[4].split(',').map(Number);
    const bHead = p[5].split(',').map(Number);
    const myHead = side === 'w' ? wHead : bHead;
    const oppHead = side === 'w' ? bHead : wHead;
    const myDir = side === 'w' ? p[6] : p[7];
    const oppDir = side === 'w' ? p[7] : p[6];
    // Build occupied set from trails
    const wTrail = (p[10] || '').split(' ').filter(Boolean);
    const bTrail = (p[11] || '').split(' ').filter(Boolean);
    const occupied = [...wTrail, ...bTrail];
    return {
      game: 'tron', side, grid,
      myHead: { x: myHead[0], y: myHead[1] },
      oppHead: { x: oppHead[0], y: oppHead[1] },
      myDir, oppDir,
      occupied, // array of "x,y" strings
      round: +p[2],
    };
  }

  if (game === 'mario') {
    const p = raw.split(';');
    const L = +p[0];
    const myPos = side === 'w' ? +p[3] : +p[4];
    const oppPos = side === 'w' ? +p[4] : +p[3];
    const track = p[11] || '';
    return {
      game: 'mario', side, trackLength: L,
      myPos, oppPos,
      track, // string of G/P/#/F characters
      nextCell: track[myPos + 1] || 'F',
      cellAfter: track[myPos + 2] || 'F',
      myFalls: side === 'w' ? +p[7] : +p[8],
      oppFalls: side === 'w' ? +p[8] : +p[7],
      round: +p[2],
    };
  }

  return { game, side, raw };
}

function buildSummary(frames: BurstFrame[], errors: { w: string[]; b: string[] }, game: string, status: string): string {
  const lines: string[] = [];
  lines.push(`Burst completed: ${frames.length} ticks.`);
  if (status !== 'active') lines.push(`Game ended: ${status}`);

  if (frames.length > 0) {
    const last = frames[frames.length - 1];
    lines.push(`Final state: ${last.boardState}`);
    if (last.events.length > 0) lines.push(`Last event: ${last.events.join(' | ')}`);
  }

  if (errors.w.length > 0) lines.push(`Your strategy errors (${errors.w.length}): ${errors.w.slice(0, 3).join('; ')}`);
  if (errors.b.length > 0) lines.push(`Opponent strategy errors (${errors.b.length}): ${errors.b.slice(0, 3).join('; ')}`);

  return lines.join('\n');
}
