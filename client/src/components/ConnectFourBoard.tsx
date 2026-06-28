interface Props {
  boardState: string; // 42 chars (R/Y/.) + ' ' + turn
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

const COLS = 7;
const ROWS = 6;

export function ConnectFourBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  const chars = boardState.split(' ')[0] || '.'.repeat(COLS * ROWS);
  const cells = Array.from(chars.padEnd(COLS * ROWS, '.')).slice(0, COLS * ROWS);

  function handleColumn(c: number) {
    if (!interactive || !onHumanMove) return;
    const col = String(c + 1);
    if (!legalMoves.includes(col)) return;
    onHumanMove(col);
  }

  return (
    <div className="c4-wrap">
      <div className="c4-board">
        {Array.from({ length: COLS }).map((_, c) => {
          const isLegal = legalMoves.includes(String(c + 1));
          return (
            <div
              key={c}
              className={`c4-col ${interactive && isLegal ? 'c4-clickable' : ''}`}
              onClick={() => handleColumn(c)}
            >
              {interactive && isLegal && <div className="c4-drop">▼</div>}
              {Array.from({ length: ROWS }).map((__, r) => {
                const cell = cells[r * COLS + c];
                return (
                  <div key={r} className="c4-slot">
                    <div className={`c4-disc ${cell === 'R' ? 'c4-red' : cell === 'Y' ? 'c4-yellow' : 'c4-empty'}`} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
