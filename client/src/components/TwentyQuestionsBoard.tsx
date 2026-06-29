interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

interface HistoryEntry {
  kind: 'ask' | 'guess';
  text: string;
  answer: string;
}

function parseHistory(raw: string): HistoryEntry[] {
  if (!raw || raw === '-') return [];
  return raw.split(',').map((entry) => {
    const [q, a] = entry.split('?');
    if (q.startsWith('GUESS:')) {
      return { kind: 'guess' as const, text: q.slice(6), answer: a || '' };
    }
    return { kind: 'ask' as const, text: q, answer: a || '' };
  });
}

export function TwentyQuestionsBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  // Parse: "secret:WORD questions:18 phase:ask history:... turn:b"
  const fields: Record<string, string> = {};
  for (const token of boardState.split(' ')) {
    const sep = token.indexOf(':');
    if (sep > 0) fields[token.slice(0, sep)] = token.slice(sep + 1);
  }

  const questionsLeft = fields['questions'] || '20';
  const phase = fields['phase'] || 'ask';
  const history = parseHistory(fields['history'] || '-');
  const turn = fields['turn'] || 'b';

  const isQuestioner = turn === 'b';
  const isAnswerer = turn === 'w';

  function submit(value: string) {
    if (!interactive || !onHumanMove) return;
    onHumanMove(value);
  }

  return (
    <div className="tq-wrap">
      <div className="tq-header">
        <span className="tq-title">20 Questions</span>
        <span className="tq-remaining">❓ {questionsLeft} questions remaining</span>
      </div>

      <div className="tq-roles">
        <span className={`tq-role ${isQuestioner ? 'tq-role-active' : ''}`}>🔍 Questioner (Black)</span>
        <span className={`tq-role ${isAnswerer ? 'tq-role-active' : ''}`}>🤫 Answerer (White)</span>
      </div>

      <div className="tq-phase">
        Phase: <strong>{phase === 'ask' ? 'Questioner\'s turn' : 'Answerer\'s turn'}</strong>
      </div>

      <div className="tq-history">
        {history.length === 0 && <div className="tq-empty">No questions asked yet</div>}
        {history.map((entry, i) => (
          <div key={i} className={`tq-entry tq-entry-${entry.kind}`}>
            <span className="tq-num">{i + 1}.</span>
            <span className="tq-text">
              {entry.kind === 'guess' ? `Guess: ${entry.text}` : entry.text}
            </span>
            <span className={`tq-answer tq-answer-${entry.answer.toLowerCase()}`}>
              {entry.answer}
            </span>
          </div>
        ))}
      </div>

      {interactive && isAnswerer && (
        <div className="tq-buttons">
          {['YES', 'NO', 'SOMETIMES'].map((choice) => (
            <button
              key={choice}
              className={`tq-btn tq-btn-${choice.toLowerCase()}`}
              onClick={() => submit(choice)}
              disabled={!legalMoves.includes(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      )}

      {interactive && isQuestioner && (
        <div className="tq-input-area">
          <p className="tq-prompt-text">Type a yes/no question or a guess:</p>
          <div className="tq-buttons">
            <button
              className="tq-btn tq-btn-ask"
              onClick={() => {
                const q = prompt('Enter your yes/no question:');
                if (q) submit(`ASK: ${q}`);
              }}
            >
              Ask Question
            </button>
            <button
              className="tq-btn tq-btn-guess"
              onClick={() => {
                const g = prompt('Enter your guess:');
                if (g) submit(`GUESS: ${g}`);
              }}
            >
              Make a Guess
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
