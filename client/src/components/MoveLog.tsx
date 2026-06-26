import { useRef, useEffect, useState } from 'react';
import type { MoveRecord } from '../types';

interface Props {
  moves: MoveRecord[];
  collapsed: boolean;
  onToggle: () => void;
}

export function MoveLog({ moves, collapsed, onToggle }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moves.length]);

  const pairs: { num: number; white?: MoveRecord; black?: MoveRecord }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className={`glass move-log ${collapsed ? 'move-log-collapsed' : ''}`}>
      <div className="move-log-header" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <span>{collapsed ? '▸' : '▾'} Move Log</span>
        <span className="text-secondary mono">{moves.length} moves</span>
      </div>
      {!collapsed && (
      <div className="move-log-body" ref={bodyRef}>
        {pairs.length === 0 && (
          <div className="move-log-empty text-muted">Waiting for first move...</div>
        )}
        {pairs.map((pair) => (
          <div key={pair.num} className="move-pair animate-in">
            <span className="move-num mono">{pair.num}.</span>
            {pair.white && (
              <MoveCell
                move={pair.white}
                isExpanded={expanded === pair.white.moveNumber * 10 + 1}
                onToggle={() =>
                  setExpanded(
                    expanded === pair.white!.moveNumber * 10 + 1
                      ? null
                      : pair.white!.moveNumber * 10 + 1,
                  )
                }
              />
            )}
            {pair.black && (
              <MoveCell
                move={pair.black}
                isExpanded={expanded === pair.black.moveNumber * 10 + 2}
                onToggle={() =>
                  setExpanded(
                    expanded === pair.black!.moveNumber * 10 + 2
                      ? null
                      : pair.black!.moveNumber * 10 + 2,
                  )
                }
              />
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

function MoveCell({
  move,
  isExpanded,
  onToggle,
}: {
  move: MoveRecord;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasIssue = move.retryCount > 0;
  return (
    <div className={`move-cell ${hasIssue ? 'move-cell-warn' : ''}`}>
      <button className="move-cell-btn" onClick={onToggle} title="Show model response">
        <span className="move-san mono">{move.san}</span>
        <span className="move-latency text-secondary">
          {(move.latencyMs / 1000).toFixed(1)}s
        </span>
        {hasIssue && <span className="move-retry-badge">↻{move.retryCount}</span>}
      </button>
      {isExpanded && (
        <div className="move-detail glass animate-in">
          <div className="detail-row">
            <label>UCI</label>
            <span className="mono">{move.uci}</span>
          </div>
          <div className="detail-row">
            <label>Latency</label>
            <span>{move.latencyMs}ms</span>
          </div>
          {move.tokensUsed && (
            <div className="detail-row">
              <label>Tokens</label>
              <span>{move.tokensUsed}</span>
            </div>
          )}
          {move.invalidAttempts.length > 0 && (
            <div className="detail-section">
              <label>Invalid attempts</label>
              {move.invalidAttempts.map((a, i) => (
                <div key={i} className="invalid-attempt mono">{a}</div>
              ))}
            </div>
          )}
          <div className="detail-section">
            <label>Raw response</label>
            <pre className="raw-response mono">{move.rawResponse}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
