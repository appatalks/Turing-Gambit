import { useState } from 'react';
import type { GameType } from '../types';
import { computeRankings, loadResults, clearResults } from '../lib/scoreboard';
import { GAMES, gameLabel } from '../lib/games';

interface Props {
  open: boolean;
  onClose: () => void;
  currentGame?: GameType;
}

const GAME_LABELS: Record<string, string> = {
  all: 'All Games',
  ...Object.fromEntries(GAMES.map((g) => [g.id, gameLabel(g.id)])),
};

export function Scoreboard({ open, onClose, currentGame }: Props) {
  const [filter, setFilter] = useState<GameType | 'all'>(currentGame || 'all');

  if (!open) return null;

  const standings = computeRankings(filter === 'all' ? undefined : filter);
  const recent = loadResults()
    .filter((r) => filter === 'all' || r.game === filter)
    .slice(0, 8);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass glass-glow animate-in scoreboard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📊 Model Rankings</h2>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Game filter */}
        <div className="scoreboard-filters">
          {Object.entries(GAME_LABELS).map(([k, label]) => (
            <button
              key={k}
              className={`game-btn game-btn-sm ${filter === k ? 'game-btn-active' : ''}`}
              onClick={() => setFilter(k as GameType | 'all')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Standings */}
        <div className="modal-body">
          {standings.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', padding: 20 }}>
              No model-vs-model games recorded yet. Pit two models against each other!
            </p>
          ) : (
            <table className="standings-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Model</th>
                  <th>Elo</th>
                  <th>W</th>
                  <th>L</th>
                  <th>D</th>
                  <th>Win %</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => {
                  const pct = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
                  return (
                    <tr key={`${s.provider}:${s.model}`}>
                      <td className="rank">{i + 1}</td>
                      <td>
                        <span className="standings-model mono">{s.model}</span>
                        <span className="standings-provider">{s.provider}</span>
                      </td>
                      <td className="stat-elo mono">{s.rating}</td>
                      <td className="stat-w">{s.wins}</td>
                      <td className="stat-l">{s.losses}</td>
                      <td className="stat-d">{s.draws}</td>
                      <td className="mono">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {recent.length > 0 && (
            <>
              <h3 style={{ marginTop: 18 }}>Recent Matches</h3>
              <div className="recent-matches">
                {recent.map((r, i) => (
                  <div key={i} className="recent-match">
                    <span className="recent-game">{GAME_LABELS[r.game]?.split(' ')[0]}</span>
                    <span className={`recent-side ${r.winner === 'white' ? 'recent-win' : ''}`}>
                      {r.whiteModel}
                    </span>
                    <span className="recent-vs">vs</span>
                    <span className={`recent-side ${r.winner === 'black' ? 'recent-win' : ''}`}>
                      {r.blackModel}
                    </span>
                    <span className="recent-result">
                      {r.winner === 'draw' ? '½' : r.winner === 'white' ? '◀' : '▶'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-danger" onClick={() => { if (confirm('Clear all match history?')) { clearResults(); onClose(); } }}>
            Clear History
          </button>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
