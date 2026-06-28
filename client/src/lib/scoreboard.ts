import type { GameType, MatchState } from '../types';

export interface MatchResult {
  game: GameType;
  whiteModel: string;
  whiteProvider: string;
  blackModel: string;
  blackProvider: string;
  winner: 'white' | 'black' | 'draw';
  endReason: string;
  moves: number;
  timestamp: number;
}

export interface ModelRecord {
  model: string;
  provider: string;
  wins: number;
  losses: number;
  draws: number;
  games: number;
  rating: number;
}

const STORAGE_KEY = 'tg-scoreboard';
const MAX_RESULTS = 500;

export function loadResults(): MatchResult[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function recordResult(state: MatchState): void {
  if (state.status !== 'completed' || !state.winner) return;

  const result: MatchResult = {
    game: state.game,
    whiteModel: state.white.type === 'human' ? 'You' : state.white.model,
    whiteProvider: state.white.type,
    blackModel: state.black.type === 'human' ? 'You' : state.black.model,
    blackProvider: state.black.type,
    winner: state.winner,
    endReason: state.endReason || '',
    moves: state.metrics.totalMoves,
    timestamp: Date.now(),
  };

  const results = loadResults();
  results.unshift(result);
  if (results.length > MAX_RESULTS) results.length = MAX_RESULTS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
}

export function clearResults(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Aggregate per-model win/loss records, optionally filtered by game */
export function computeStandings(game?: GameType): ModelRecord[] {
  return computeRankings(game);
}

/**
 * Rank models against each other using an Elo rating computed over the full
 * chronological history of model-vs-model games. This is the primary
 * benchmarking signal — stronger models float to the top regardless of how
 * many games each has played. Games involving a human ("You") are excluded.
 */
export function computeRankings(game?: GameType): ModelRecord[] {
  const BASE = 1000;
  const K = 32;

  const all = loadResults().filter(
    (r) =>
      (!game || r.game === game) &&
      r.whiteModel !== 'You' &&
      r.blackModel !== 'You',
  );
  // Replay oldest → newest so Elo updates in the order games were played.
  const chrono = [...all].reverse();

  const records = new Map<string, ModelRecord>();
  const ensure = (model: string, provider: string): ModelRecord => {
    const key = `${provider}:${model}`;
    if (!records.has(key)) {
      records.set(key, { model, provider, wins: 0, losses: 0, draws: 0, games: 0, rating: BASE });
    }
    return records.get(key)!;
  };

  for (const r of chrono) {
    const w = ensure(r.whiteModel, r.whiteProvider);
    const b = ensure(r.blackModel, r.blackProvider);
    w.games++; b.games++;

    let scoreW: number;
    if (r.winner === 'draw') { w.draws++; b.draws++; scoreW = 0.5; }
    else if (r.winner === 'white') { w.wins++; b.losses++; scoreW = 1; }
    else { b.wins++; w.losses++; scoreW = 0; }

    // Skip rating updates for self-play (same model both sides) — no signal.
    if (w !== b) {
      const expW = 1 / (1 + Math.pow(10, (b.rating - w.rating) / 400));
      const expB = 1 - expW;
      w.rating += K * (scoreW - expW);
      b.rating += K * ((1 - scoreW) - expB);
    }
  }

  return Array.from(records.values())
    .map((r) => ({ ...r, rating: Math.round(r.rating) }))
    .sort((a, b) => b.rating - a.rating || (b.wins - b.losses) - (a.wins - a.losses));
}
