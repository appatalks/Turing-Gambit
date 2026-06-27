import type { MatchStatus, GameStatus } from '../types';

interface Props {
  status: MatchStatus;
  gameStatus: GameStatus;
  fen: string;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
}

const STATUS_LABELS: Record<GameStatus, { text: string; cls: string }> = {
  active: { text: 'Active', cls: 'badge-active' },
  check: { text: 'Check', cls: 'badge-check' },
  checkmate: { text: 'Checkmate', cls: 'badge-completed' },
  stalemate: { text: 'Stalemate', cls: 'badge-paused' },
  draw: { text: 'Draw', cls: 'badge-paused' },
  resigned: { text: 'Resigned', cls: 'badge-error' },
  invalid_move_failure: { text: 'Forfeit', cls: 'badge-error' },
  max_moves_reached: { text: 'Max Moves', cls: 'badge-paused' },
  black_wins: { text: 'Black Wins', cls: 'badge-completed' },
  white_wins: { text: 'White Wins', cls: 'badge-completed' },
};

export function ControlPanel({
  status,
  gameStatus,
  fen,
  onPause,
  onResume,
  onStep,
  onReset,
}: Props) {
  const isRunning = status === 'active';
  const isPaused = status === 'paused';
  const isCompleted = status === 'completed';
  const statusInfo = STATUS_LABELS[gameStatus];

  return (
    <div className="glass control-panel">
      <div className="control-top">
        {/* Game status badge */}
        <span className={`badge ${statusInfo.cls}`}>
          {gameStatus === 'check' && '⚠ '}
          {statusInfo.text}
        </span>

        {/* Control buttons */}
        <div className="control-buttons">
          {isRunning && (
            <button className="btn btn-secondary btn-icon" onClick={onPause} title="Pause">
              ⏸
            </button>
          )}
          {isPaused && (
            <button className="btn btn-primary btn-icon" onClick={onResume} title="Resume">
              ▶
            </button>
          )}
          <button
            className="btn btn-secondary btn-icon"
            onClick={onStep}
            disabled={isCompleted}
            title="Step one move"
          >
            ⏭
          </button>
          <button className="btn btn-danger btn-icon" onClick={onReset} title="Reset">
            ↺
          </button>
        </div>
      </div>

      {/* FEN display */}
      <div className="fen-display">
        <label>FEN</label>
        <code className="fen-text mono">{fen}</code>
      </div>
    </div>
  );
}
