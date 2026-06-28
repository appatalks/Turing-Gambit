interface Props {
  boardState: string; // "......... w"
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

type Cell = '.' | 'X' | 'O';

export function TicTacToeBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  const chars = boardState.split(' ')[0] || '.........';
  const cells: Cell[] = Array.from(chars).slice(0, 9) as Cell[];

  function handleClick(i: number) {
    if (!interactive || !onHumanMove) return;
    const pos = String(i + 1);
    if (!legalMoves.includes(pos)) return;
    onHumanMove(pos);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: 300 }}>
      <div className="ttt-board">
        {cells.map((cell, i) => {
          const isLegal = legalMoves.includes(String(i + 1));
          return (
            <div
              key={i}
              className={`ttt-cell ${cell !== '.' ? 'ttt-filled' : ''} ${interactive && isLegal ? 'ttt-clickable' : ''}`}
              onClick={() => handleClick(i)}
            >
              {cell === 'X' && <span className="ttt-x">✕</span>}
              {cell === 'O' && <span className="ttt-o">○</span>}
              {cell === '.' && interactive && isLegal && (
                <span className="ttt-hint">{i + 1}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
