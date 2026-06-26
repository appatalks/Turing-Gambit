import { useState } from 'react';
import type { MatchState } from '../types';

interface Props {
  state: MatchState;
  onNewMatch: () => void;
}

export function VictorySplash({ state, onNewMatch }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (state.status !== 'completed' || dismissed) return null;

  const { winner, endReason, metrics, white, black } = state;

  const isDraw = winner === 'draw';
  const winnerLabel = isDraw
    ? 'Draw'
    : winner === 'white'
      ? 'White wins'
      : 'Black wins';
  const winnerModel = isDraw
    ? null
    : winner === 'white'
      ? white
      : black;
  const loserModel = isDraw
    ? null
    : winner === 'white'
      ? black
      : white;

  const icon = isDraw ? '½–½' : winner === 'white' ? '♔' : '♚';
  const accentClass = isDraw
    ? 'splash-draw'
    : winner === 'white'
      ? 'splash-white'
      : 'splash-black';

  return (
    <div className="splash-overlay" onClick={() => setDismissed(true)}>
      <div className={`splash-card glass ${accentClass} animate-in`} onClick={(e) => e.stopPropagation()}>
        <div className="splash-icon">{icon}</div>
        <h1 className="splash-title">{winnerLabel}</h1>

        {winnerModel && (
          <div className="splash-models">
            <span className="splash-winner-model">
              {winnerModel.type === 'human' ? '🧑 You' : winnerModel.model}
            </span>
            <span className="splash-vs">defeated</span>
            <span className="splash-loser-model">
              {loserModel?.type === 'human' ? '🧑 You' : loserModel?.model}
            </span>
          </div>
        )}

        {endReason && (
          <p className="splash-reason text-secondary">{endReason}</p>
        )}

        <div className="splash-stats">
          <StatPill label="Moves" value={metrics.totalMoves} />
          <StatPill
            label="White time"
            value={formatTime(metrics.whiteAvgLatency * Math.max(1, Math.ceil(metrics.totalMoves / 2)))}
          />
          <StatPill
            label="Black time"
            value={formatTime(metrics.blackAvgLatency * Math.max(1, Math.floor(metrics.totalMoves / 2)))}
          />
          {(metrics.whiteInvalidMoves > 0 || metrics.blackInvalidMoves > 0) && (
            <StatPill
              label="Errors"
              value={metrics.whiteInvalidMoves + metrics.blackInvalidMoves}
              warn
            />
          )}
        </div>

        <div className="splash-actions">
          <button className="btn btn-primary" onClick={onNewMatch}>
            New Match
          </button>
          <button className="btn btn-secondary" onClick={() => downloadPgn(state.pgn)}>
            ⬇ PGN
          </button>
          <button className="btn btn-secondary" onClick={() => downloadJson(state)}>
            ⬇ JSON
          </button>
          <button className="btn btn-secondary" onClick={() => setDismissed(true)}>
            View Board
          </button>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={`splash-pill ${warn ? 'splash-pill-warn' : ''}`}>
      <span className="splash-pill-value mono">{value}</span>
      <span className="splash-pill-label">{label}</span>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function downloadPgn(pgn: string) {
  const blob = new Blob([pgn], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `turing-gambit-${Date.now()}.pgn`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(state: MatchState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `turing-gambit-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
