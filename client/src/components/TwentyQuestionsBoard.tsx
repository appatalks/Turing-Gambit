interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

export function TwentyQuestionsBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  // Format: phase|questionCount|history|turn|guessResult
  const parts = boardState.split('|');
  const phase = parts[0] || 'pick_secret';
  const questionCount = parseInt(parts[1] || '0');
  const histStr = parts[2] || '';
  const turn = parts[3] || 'w';
  const guessResult = parts[4] || '';

  const history: { question: string; answer: string }[] = [];
  if (histStr) {
    for (const entry of histStr.split(';')) {
      const [q, a] = entry.split('=');
      if (q) history.push({ question: q, answer: a || '' });
    }
  }

  function handleAction(action: string) {
    if (!interactive || !onHumanMove) return;
    const input = window.prompt(
      action === 'SECRET' ? 'Enter your secret (animal, object, person, or place):' :
      action === 'ASK' ? 'Enter your yes/no question:' :
      action === 'GUESS' ? 'Enter your guess:' : ''
    );
    if (!input) return;
    if (action === 'SECRET') onHumanMove(`SECRET: ${input}`);
    else if (action === 'ASK') onHumanMove(`ASK: ${input}`);
    else if (action === 'GUESS') onHumanMove(`GUESS: ${input}`);
  }

  function handleAnswer(answer: string) {
    if (!interactive || !onHumanMove) return;
    onHumanMove(answer);
  }

  return (
    <div className="pd-wrap">
      <div className="pd-header">
        20 Questions — {questionCount}/20 asked
        {guessResult && <span style={{ marginLeft: 8 }}>{guessResult === 'correct' ? '🎉 Guessed!' : '❌ Not guessed'}</span>}
      </div>

      <div className="pd-explain">
        <b>White</b> picks a secret thing. <b>Black</b> asks up to 20 yes/no questions to guess it.
        {phase === 'pick_secret' && ' Waiting for White to pick a secret...'}
      </div>

      <div className="pd-history">
        {history.length === 0 && phase !== 'pick_secret' && (
          <div className="pd-empty">No questions asked yet</div>
        )}
        {history.map((h, i) => (
          <div key={i} className="pd-round">
            <span className="pd-rn">Q{i + 1}</span>
            <span style={{ flex: 1 }}>{h.question}</span>
            <span className={`pd-choice ${h.answer === 'YES' || h.answer === 'CORRECT!' ? 'pd-coop-c' : 'pd-defect-c'}`}>
              {h.answer}
            </span>
          </div>
        ))}
      </div>

      {interactive && phase === 'pick_secret' && turn === 'w' && (
        <div className="pd-buttons">
          <button className="pd-btn pd-btn-coop" onClick={() => handleAction('SECRET')}>Pick Secret</button>
        </div>
      )}

      {interactive && phase === 'question' && turn === 'b' && (
        <div className="pd-buttons">
          <button className="pd-btn pd-btn-coop" onClick={() => handleAction('ASK')}>Ask Question</button>
          <button className="pd-btn pd-btn-defect" onClick={() => handleAction('GUESS')}>Make Guess</button>
        </div>
      )}

      {interactive && phase === 'answer' && turn === 'w' && (
        <div className="pd-buttons">
          {legalMoves.includes('YES') && <button className="pd-btn pd-btn-coop" onClick={() => handleAnswer('YES')}>YES</button>}
          {legalMoves.includes('NO') && <button className="pd-btn pd-btn-defect" onClick={() => handleAnswer('NO')}>NO</button>}
          {legalMoves.includes('CORRECT') && <button className="pd-btn pd-btn-coop" onClick={() => handleAnswer('CORRECT')}>CORRECT</button>}
          {legalMoves.includes('WRONG') && <button className="pd-btn pd-btn-defect" onClick={() => handleAnswer('WRONG')}>WRONG</button>}
        </div>
      )}
    </div>
  );
}
