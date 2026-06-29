import { useRef, useEffect } from 'react';

interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

export function HitchhikerBoard({ boardState, interactive = false, onHumanMove }: Props) {
  const fields: Record<string, string> = {};
  for (const token of boardState.split('|')) {
    const sep = token.indexOf('=');
    if (sep > 0) fields[token.slice(0, sep)] = token.slice(sep + 1);
  }

  const turn = fields['turn'] || 'w';
  const moves = fields['moves'] || '0';
  const wScore = fields['w_score'] || '0';
  const bScore = fields['b_score'] || '0';
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
    if (cmd) { onHumanMove(cmd); inputRef.current.value = ''; }
  }

  return (
    <div className="hh-board">
      <div className="hh-header">
        <span className="hh-title">🚀 THE HITCHHIKER'S GUIDE TO THE GALAXY</span>
        <span className="hh-subtitle">DON'T PANIC • Turn {moves}</span>
      </div>
      <div className="hh-scores">
        <div className={`hh-score ${turn === 'w' ? 'hh-score-active' : ''}`}>
          <span>🧑‍🚀 Player 1</span><span>{wScore}/50</span>
        </div>
        <div className={`hh-score ${turn === 'b' ? 'hh-score-active' : ''}`}>
          <span>🧑‍🚀 Player 2</span><span>{bScore}/50</span>
        </div>
      </div>
      <div className="hh-terminals">
        <div className={`hh-terminal ${turn === 'w' ? 'hh-term-active' : ''}`}>
          <div className="hh-term-label">🧑‍🚀 Player 1</div>
          <div className="hh-term-output" ref={wRef}><pre className="hh-text">{wOutput}</pre></div>
        </div>
        <div className={`hh-terminal ${turn === 'b' ? 'hh-term-active' : ''}`}>
          <div className="hh-term-label">🧑‍🚀 Player 2</div>
          <div className="hh-term-output" ref={bRef}><pre className="hh-text">{bOutput}</pre></div>
        </div>
      </div>
      {interactive && (
        <form className="hh-input" onSubmit={handleSubmit}>
          <span className="hh-prompt">&gt;</span>
          <input ref={inputRef} className="hh-input-field" placeholder="Enter command..." autoFocus />
          <button type="submit" className="hh-submit">⏎</button>
        </form>
      )}
    </div>
  );
}
