import type { MoveRecord } from '../types';

interface Props {
  boardState: string; // "round|turn|status|topic"
  moveHistory: MoveRecord[];
}

export function DebateBoard({ boardState, moveHistory }: Props) {
  const parts = boardState.split('|');
  const turn = parts[1] || 'w';
  const status = parts[2] || 'debating';
  const topic = parts.slice(3).join('|') || '...';

  const judged = status.startsWith('judged');
  const winner = judged ? status.split(':')[1] : '';

  const proArgs = moveHistory.filter((m) => m.color === 'w');
  const conArgs = moveHistory.filter((m) => m.color === 'b');

  return (
    <div className="debate-wrap">
      <div className="debate-topic">
        <span className="debate-label">RESOLUTION</span>
        <span className="debate-topic-text">{topic}</span>
      </div>

      {judged && (
        <div className={`debate-verdict debate-verdict-${winner}`}>
          {winner === 'w' ? '⚖️ PRO wins the debate' : winner === 'b' ? '⚖️ CON wins the debate' : '⚖️ The debate is a draw'}
        </div>
      )}

      <div className="debate-columns">
        <div className={`debate-col debate-pro ${turn === 'w' && !judged ? 'debate-active' : ''}`}>
          <div className="debate-col-head">PRO — For</div>
          {proArgs.length === 0 && <div className="debate-empty">Awaiting opening…</div>}
          {proArgs.map((m, i) => (
            <div key={i} className="debate-bubble">
              <div className="debate-round">Round {i + 1}</div>
              <div className="debate-text">{m.uci || m.rawResponse}</div>
            </div>
          ))}
        </div>

        <div className={`debate-col debate-con ${turn === 'b' && !judged ? 'debate-active' : ''}`}>
          <div className="debate-col-head">CON — Against</div>
          {conArgs.length === 0 && <div className="debate-empty">Awaiting rebuttal…</div>}
          {conArgs.map((m, i) => (
            <div key={i} className="debate-bubble">
              <div className="debate-round">Round {i + 1}</div>
              <div className="debate-text">{m.uci || m.rawResponse}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
