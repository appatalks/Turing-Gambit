import type { MatchState } from '../types';
import { playerLabel, playerIcon } from '../lib/games';

interface Props {
  state: MatchState;
}

export function MetricsPanel({ state }: Props) {
  const { metrics, winner, endReason, pgn, moveHistory } = state;

  return (
    <div className="glass metrics-panel">
      <h3>Match Metrics</h3>

      {winner && (
        <div className="result-banner animate-in">
          <span className="result-icon">
            {winner === 'draw' ? '½—½' : playerIcon(state.game, winner === 'white' ? 'w' : 'b')}
          </span>
          <div>
            <div className="result-text">
              {winner === 'draw'
                ? 'Draw'
                : `${playerLabel(state.game, winner === 'white' ? 'w' : 'b')} wins`}
            </div>
            {endReason && <div className="result-reason text-secondary">{endReason}</div>}
          </div>
        </div>
      )}

      <div className="metrics-grid">
        <MetricCard label="Total Moves" value={metrics.totalMoves} />
        <MetricCard
          label={`${playerLabel(state.game, 'w')} Avg Latency`}
          value={metrics.whiteAvgLatency > 0 ? `${(metrics.whiteAvgLatency / 1000).toFixed(1)}s` : '—'}
        />
        <MetricCard
          label={`${playerLabel(state.game, 'b')} Avg Latency`}
          value={metrics.blackAvgLatency > 0 ? `${(metrics.blackAvgLatency / 1000).toFixed(1)}s` : '—'}
        />
        <MetricCard label={`${playerLabel(state.game, 'w')} Tokens`} value={metrics.whiteTotalTokens || '—'} />
        <MetricCard label={`${playerLabel(state.game, 'b')} Tokens`} value={metrics.blackTotalTokens || '—'} />
        <MetricCard label={`${playerLabel(state.game, 'w')} Errors`} value={metrics.whiteInvalidMoves} warn={metrics.whiteInvalidMoves > 0} />
        <MetricCard label={`${playerLabel(state.game, 'b')} Errors`} value={metrics.blackInvalidMoves} warn={metrics.blackInvalidMoves > 0} />
      </div>

      {state.status === 'completed' && (
        <div className="export-section">
          <h4>Export</h4>
          <div className="export-buttons">
            <button
              className="btn btn-secondary"
              onClick={() => downloadText('match.pgn', pgn)}
            >
              ⬇ PGN
            </button>
            <button
              className="btn btn-secondary"
              onClick={() =>
                downloadText(
                  'match.json',
                  JSON.stringify(
                    { ...state, moveHistory },
                    null,
                    2,
                  ),
                )
              }
            >
              ⬇ JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div className="metric-card">
      <div className={`metric-value mono ${warn ? 'text-warn' : ''}`}>
        {value}
      </div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
