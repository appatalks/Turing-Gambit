import type { ProviderConfig, MatchMetrics, CapturedPieces, GameType } from '../types';
import { ThinkingIndicator } from './ThinkingIndicator';
import { playerLabel, playerIcon } from '../lib/games';

interface Props {
  color: 'white' | 'black';
  game?: GameType;
  provider: ProviderConfig;
  metrics: MatchMetrics;
  captured: CapturedPieces;
  isThinking: boolean;
  isActive: boolean;
}

// Captured pieces shown on a player's panel are the OPPONENT's pieces they took.
// White panel shows black pieces captured, Black panel shows white pieces captured.
const CAPTURED_SYMBOLS: Record<string, Record<string, string>> = {
  white: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' },  // Black pieces (captured by white)
  black: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },  // White pieces (captured by black)
};

const VALUE_ORDER = ['q', 'r', 'b', 'n', 'p'];
const PIECE_NAMES: Record<string, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };

function sortPieces(pieces: string[]): string[] {
  return [...pieces].sort(
    (a, b) => VALUE_ORDER.indexOf(a) - VALUE_ORDER.indexOf(b),
  );
}

export function PlayerPanel({
  color,
  game,
  provider,
  metrics,
  captured,
  isThinking,
  isActive,
}: Props) {
  const isWhite = color === 'white';
  const name = playerLabel(game, color);
  const icon = playerIcon(game, color);
  const avgLatency = isWhite ? metrics.whiteAvgLatency : metrics.blackAvgLatency;
  const invalidMoves = isWhite ? metrics.whiteInvalidMoves : metrics.blackInvalidMoves;
  const totalTokens = isWhite ? metrics.whiteTotalTokens : metrics.blackTotalTokens;
  const retries = isWhite ? metrics.whiteRetries : metrics.blackRetries;
  const capturedPieces = isWhite ? captured.white : captured.black;

  return (
    <div className={`glass player-panel ${isActive ? 'glass-glow' : ''}`}>
      {/* Header */}
      <div className="panel-header">
        <span className="piece-icon">{icon}</span>
        <div>
          <div className="panel-title">{name}</div>
          <div className="panel-model mono">
            {provider.type === 'human' ? 'You' : provider.model}
          </div>
        </div>
      </div>

      {/* Provider tag */}
      <div className="panel-provider">
        <span className="badge badge-active">
          {provider.type === 'human' ? '🧑 human' : provider.type}
        </span>
      </div>

      {/* Thinking animation — always rendered to hold space */}
      <ThinkingIndicator visible={isThinking} />

      {/* Captured pieces */}
      {capturedPieces.length > 0 && (
        <div className="panel-section">
          <label>Captured ({capturedPieces.length})</label>
          <div className="captured-pieces">
            {sortPieces(capturedPieces).map((p, i) =>
              p === 'c' ? (
                // Checkers piece
                <span key={i} className="captured-piece" title="Checker">
                  {color === 'white' ? '⚫' : '⚪'}
                </span>
              ) : 'pnbrqk'.includes(p) ? (
                // Chess piece
                <span key={i} className="captured-piece" title={PIECE_NAMES[p] || p}>
                  {CAPTURED_SYMBOLS[color][p] || p}
                </span>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="panel-stats">
        <StatRow label="Avg Latency" value={avgLatency > 0 ? `${(avgLatency / 1000).toFixed(1)}s` : '—'} />
        <StatRow label="Invalid Moves" value={invalidMoves} warn={invalidMoves > 0} />
        <StatRow label="Retries" value={retries} warn={retries > 0} />
        {totalTokens > 0 && <StatRow label="Tokens" value={totalTokens.toLocaleString()} />}
      </div>
    </div>
  );
}

function StatRow({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className={`stat-value mono ${warn ? 'text-warn' : ''}`}>{value}</span>
    </div>
  );
}
