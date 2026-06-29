import { useRef, useEffect } from 'react';

interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

export function ZorkBoard({
  boardState,
  interactive = false,
  onHumanMove,
}: Props) {
  const fields: Record<string, string> = {};
  for (const token of boardState.split('|')) {
    const sep = token.indexOf('=');
    if (sep > 0) fields[token.slice(0, sep)] = token.slice(sep + 1);
  }

  const turn = fields['turn'] || 'w';
  const moves = fields['moves'] || '0';
  const wScore = fields['w_score'] || '0';
  const bScore = fields['b_score'] || '0';
  const wAlive = fields['w_alive'] !== 'false';
  const bAlive = fields['b_alive'] !== 'false';
  const wOutput = decodeURIComponent(fields['w_output'] || '');
  const bOutput = decodeURIComponent(fields['b_output'] || '');

  const wRef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    wRef.current?.scrollTo({ top: wRef.current.scrollHeight, behavior: 'smooth' });
    bRef.current?.scrollTo({ top: bRef.current.scrollHeight, behavior: 'smooth' });
  }, [wOutput, bOutput]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!interactive || !onHumanMove || !inputRef.current) return;
    const cmd = inputRef.current.value.trim();
    if (cmd) {
      onHumanMove(cmd);
      inputRef.current.value = '';
    }
  }

  const wScoreNum = parseInt(wScore);
  const bScoreNum = parseInt(bScore);
  const wPct = Math.min(100, (wScoreNum / 65) * 100);
  const bPct = Math.min(100, (bScoreNum / 65) * 100);

  return (
    <div className="zork-board">
      {/* Header */}
      <div className="zork-header">
        <span className="zork-title">⚔️ ZORK I — SPEEDRUN RACE</span>
        <span className="zork-moves">Turn {moves}</span>
      </div>

      {/* Score bars */}
      <div className="zork-scores">
        <div className={`zork-score-row ${turn === 'w' ? 'zork-score-active' : ''}`}>
          <span className="zork-player-label">🧭 Adventurer 1</span>
          <div className="zork-progress-bar">
            <div className="zork-progress-fill zork-fill-w" style={{ width: `${wPct}%` }} />
          </div>
          <span className="zork-score-val">{wScore}/65</span>
        </div>
        <div className={`zork-score-row ${turn === 'b' ? 'zork-score-active' : ''}`}>
          <span className="zork-player-label">🗺️ Adventurer 2</span>
          <div className="zork-progress-bar">
            <div className="zork-progress-fill zork-fill-b" style={{ width: `${bPct}%` }} />
          </div>
          <span className="zork-score-val">{bScore}/65</span>
        </div>
      </div>

      {/* Terminals */}
      <div className="zork-terminals">
        <div className={`zork-terminal ${turn === 'w' ? 'zork-terminal-active' : ''} ${!wAlive ? 'zork-terminal-dead' : ''}`}>
          <div className="zork-term-header">
            <span>🧭 Adventurer 1</span>
            {!wAlive && <span className="zork-dead-badge">DEAD</span>}
          </div>
          <div className="zork-term-output" ref={wRef}>
            <pre className="zork-text">{wOutput}</pre>
          </div>
        </div>

        <div className={`zork-terminal ${turn === 'b' ? 'zork-terminal-active' : ''} ${!bAlive ? 'zork-terminal-dead' : ''}`}>
          <div className="zork-term-header">
            <span>🗺️ Adventurer 2</span>
            {!bAlive && <span className="zork-dead-badge">DEAD</span>}
          </div>
          <div className="zork-term-output" ref={bRef}>
            <pre className="zork-text">{bOutput}</pre>
          </div>
        </div>
      </div>

      {/* Human input */}
      {interactive && (
        <form className="zork-input" onSubmit={handleSubmit}>
          <span className="zork-prompt-char">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            className="zork-input-field"
            placeholder="Enter command (e.g. GO NORTH, TAKE SWORD)..."
            autoFocus
          />
          <button type="submit" className="zork-submit">⏎</button>
        </form>
      )}
    </div>
  );
}
