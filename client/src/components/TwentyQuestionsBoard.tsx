import { useRef, useEffect } from 'react';

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
    // Split on the LAST '?' since questions themselves contain '?'
    const lastQ = entry.lastIndexOf('?');
    const q = lastQ > 0 ? entry.slice(0, lastQ) : entry;
    const a = lastQ > 0 ? entry.slice(lastQ + 1) : '';
    if (q.startsWith('GUESS:')) {
      return { kind: 'guess' as const, text: q.slice(6), answer: a || '' };
    }
    return { kind: 'ask' as const, text: q, answer: a || '' };
  });
}

const ANSWER_ICONS: Record<string, { icon: string; color: string }> = {
  yes: { icon: '✅', color: '#44ff88' },
  no: { icon: '❌', color: '#ff4466' },
  sometimes: { icon: '🔶', color: '#ffaa33' },
  correct: { icon: '🎉', color: '#ffd700' },
  wrong: { icon: '💀', color: '#ff4466' },
};

export function TwentyQuestionsBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  // Parse boardState — values can contain spaces (e.g. questions in history),
  // so we match known field names at word boundaries instead of naive split.
  const KNOWN_FIELDS = ['secret', 'questions', 'phase', 'history', 'turn'];
  const fields: Record<string, string> = {};
  const fieldPattern = new RegExp(`\\b(${KNOWN_FIELDS.join('|')}):`, 'g');
  const matches: { key: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = fieldPattern.exec(boardState)) !== null) {
    matches.push({ key: m[1], start: m.index + m[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const end = i + 1 < matches.length ? matches[i + 1].start - matches[i + 1].key.length - 1 : boardState.length;
    fields[matches[i].key] = boardState.slice(matches[i].start, end).trim();
  }

  const questionsLeft = parseInt(fields['questions'] || '20');
  const questionsUsed = 20 - questionsLeft;
  const phase = fields['phase'] || 'ask';
  const history = parseHistory(fields['history'] || '-');
  const turn = fields['turn'] || 'b';

  const isQuestioner = turn === 'b';
  const isAnswerer = turn === 'w';
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history.length]);

  function submit(value: string) {
    if (!interactive || !onHumanMove) return;
    onHumanMove(value);
  }

  // Progress ring
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = questionsUsed / 20;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="tq-board">
      {/* Header */}
      <div className="tq-title-bar">
        <span className="tq-game-title">❓ 20 QUESTIONS</span>
        <span className="tq-subtitle">Guess the secret word</span>
      </div>

      <div className="tq-layout">
        {/* Left panel - roles & progress */}
        <div className="tq-side-panel">
          {/* Progress ring */}
          <div className="tq-progress">
            <svg width="90" height="90" viewBox="0 0 90 90">
              <circle cx="45" cy="45" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle cx="45" cy="45" r={radius} fill="none"
                stroke={questionsLeft <= 5 ? '#ff4466' : questionsLeft <= 10 ? '#ffaa33' : '#44ff88'}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                transform="rotate(-90 45 45)"
                style={{ transition: 'stroke-dashoffset 0.5s, stroke 0.3s' }}
              />
              <text x="45" y="40" textAnchor="middle" fill="var(--text-primary)" fontSize="22" fontWeight="800">{questionsLeft}</text>
              <text x="45" y="56" textAnchor="middle" fill="var(--text-muted)" fontSize="9">remaining</text>
            </svg>
          </div>

          {/* Roles */}
          <div className="tq-roles">
            <div className={`tq-role-card ${isQuestioner ? 'tq-role-active' : ''}`}>
              <span className="tq-role-icon">🔍</span>
              <div className="tq-role-info">
                <span className="tq-role-name">Questioner</span>
                <span className="tq-role-side">Questioner</span>
              </div>
              {isQuestioner && <span className="tq-role-turn">TURN</span>}
            </div>
            <div className="tq-role-vs">VS</div>
            <div className={`tq-role-card ${isAnswerer ? 'tq-role-active' : ''}`}>
              <span className="tq-role-icon">🤫</span>
              <div className="tq-role-info">
                <span className="tq-role-name">Answerer</span>
                <span className="tq-role-side">Answerer</span>
              </div>
              {isAnswerer && <span className="tq-role-turn">TURN</span>}
            </div>
          </div>

          {/* Stats */}
          <div className="tq-stats">
            <div className="tq-stat">
              <span className="tq-stat-val">{history.filter((e) => e.answer === 'YES').length}</span>
              <span className="tq-stat-label">Yes</span>
            </div>
            <div className="tq-stat">
              <span className="tq-stat-val">{history.filter((e) => e.answer === 'NO').length}</span>
              <span className="tq-stat-label">No</span>
            </div>
            <div className="tq-stat">
              <span className="tq-stat-val">{history.filter((e) => e.kind === 'guess').length}</span>
              <span className="tq-stat-label">Guesses</span>
            </div>
          </div>
        </div>

        {/* Main area - Q&A conversation */}
        <div className="tq-main">
          <div className="tq-conversation" ref={scrollRef}>
            {history.length === 0 && (
              <div className="tq-empty-state">
                <span className="tq-empty-icon">🎯</span>
                <span className="tq-empty-text">The Questioner will begin asking questions...</span>
                <span className="tq-empty-hint">The secret word has been chosen. 20 questions to figure it out!</span>
              </div>
            )}
            {history.map((entry, i) => {
              const answerInfo = ANSWER_ICONS[entry.answer.toLowerCase()] || { icon: '❔', color: '#888' };
              return (
                <div key={i} className={`tq-qa-pair ${entry.kind === 'guess' ? 'tq-qa-guess' : ''}`}>
                  <div className="tq-question-bubble">
                    <span className="tq-q-num">Q{i + 1}</span>
                    <span className="tq-q-icon">{entry.kind === 'guess' ? '🎲' : '🔍'}</span>
                    <span className="tq-q-text">
                      {entry.kind === 'guess' ? (
                        <><strong>Guess:</strong> {entry.text}</>
                      ) : entry.text}
                    </span>
                  </div>
                  <div className="tq-answer-bubble" style={{ '--answer-color': answerInfo.color } as React.CSSProperties}>
                    <span className="tq-a-icon">{answerInfo.icon}</span>
                    <span className="tq-a-text">{entry.answer}</span>
                  </div>
                </div>
              );
            })}

            {/* Pending question indicator */}
            {phase === 'answer' && history.length > 0 && (
              <div className="tq-pending">
                <span className="tq-pending-dot" />
                <span className="tq-pending-dot" />
                <span className="tq-pending-dot" />
                <span className="tq-pending-text">Answerer is thinking...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Human interaction */}
      {interactive && isAnswerer && (
        <div className="tq-action-bar">
          {['YES', 'NO', 'SOMETIMES'].map((choice) => {
            const info = ANSWER_ICONS[choice.toLowerCase()] || { icon: '❔', color: '#888' };
            return (
              <button
                key={choice}
                className="tq-action-btn"
                style={{ '--answer-color': info.color } as React.CSSProperties}
                onClick={() => submit(choice)}
                disabled={!legalMoves.includes(choice)}
              >
                <span className="tq-action-icon">{info.icon}</span>
                <span>{choice}</span>
              </button>
            );
          })}
        </div>
      )}

      {interactive && isQuestioner && (
        <div className="tq-action-bar">
          <button className="tq-action-btn tq-action-ask" onClick={() => {
            const q = prompt('Enter your yes/no question:');
            if (q) submit(`ASK: ${q}`);
          }}>
            <span className="tq-action-icon">🔍</span>
            <span>Ask Question</span>
          </button>
          <button className="tq-action-btn tq-action-guess" onClick={() => {
            const g = prompt('Enter your guess:');
            if (g) submit(`GUESS: ${g}`);
          }}>
            <span className="tq-action-icon">🎲</span>
            <span>Make a Guess</span>
          </button>
        </div>
      )}
    </div>
  );
}
