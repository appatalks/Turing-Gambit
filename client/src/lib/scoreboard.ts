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
  const results = loadResults();
  const records = new Map<string, ModelRecord>();

  const ensure = (model: string, provider: string): ModelRecord => {
    const key = `${provider}:${model}`;
    if (!records.has(key)) {
      records.set(key, { model, provider, wins: 0, losses: 0, draws: 0, games: 0 });
    }
    return records.get(key)!;
  };

  for (const r of results) {
    if (game && r.game !== game) continue;
    if (r.whiteModel === 'You' && r.blackModel === 'You') continue;

    const w = ensure(r.whiteModel, r.whiteProvider);
    const b = ensure(r.blackModel, r.blackProvider);
    w.games++; b.games++;

    if (r.winner === 'draw') { w.draws++; b.draws++; }
    else if (r.winner === 'white') { w.wins++; b.losses++; }
    else { b.wins++; w.losses++; }
  }

  return Array.from(records.values())
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || b.wins - a.wins);
}
