interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

const COLS = 'ABCDEFGHJ';
const SIZE = 9;

export function GoBoard({ boardState, interactive = false, onHumanMove, legalMoves = [] }: Props) {
  // Parse: turn=b moves=5 board=.B..W.... captures_w=0 captures_b=2 passes=0
  const fields: Record<string, string> = {};
  for (const token of boardState.split(' ')) {
    const sep = token.indexOf('=');
    if (sep > 0) fields[token.slice(0, sep)] = token.slice(sep + 1);
  }

  const turn = fields['turn'] || 'b';
  const moves = fields['moves'] || '0';
  const boardStr = fields['board'] || '.'.repeat(81);
  const capW = fields['captures_w'] || '0';
  const capB = fields['captures_b'] || '0';

  function getStone(x: number, y: number): string | null {
    const c = boardStr[y * SIZE + x];
    if (c === 'B') return 'b';
    if (c === 'W') return 'w';
    return null;
  }

  function handleClick(x: number, y: number) {
    if (!interactive || !onHumanMove) return;
    const coord = `${COLS[x]}${y + 1}`;
    if (legalMoves.includes(coord)) onHumanMove(coord);
  }

  function handlePass() {
    if (!interactive || !onHumanMove) return;
    if (legalMoves.includes('PASS')) onHumanMove('PASS');
  }

  // Star points for 9x9
  const starPoints = [[2,2],[6,2],[4,4],[2,6],[6,6]];
  const isStarPoint = (x: number, y: number) => starPoints.some(([sx, sy]) => sx === x && sy === y);

  return (
    <div className="go-board">
      <div className="go-header">
        <span className="go-title">⚫ GO (9×9)</span>
        <span className="go-info">Move {moves} • {turn === 'b' ? 'Black ●' : 'White ○'} to play</span>
      </div>
      <div className="go-captures">
        <span className="go-cap">● Black captured: {capB}</span>
        <span className="go-cap">○ White captured: {capW}</span>
      </div>
      <div className="go-grid-wrap">
        <div className="go-grid">
          {/* Column labels */}
          <div className="go-labels-top">
            {COLS.split('').map((c) => <span key={c} className="go-label">{c}</span>)}
          </div>
          {/* Board rows (top = row 9, bottom = row 1) */}
          {Array.from({ length: SIZE }, (_, ri) => {
            const y = SIZE - 1 - ri;
            return (
              <div key={y} className="go-row">
                <span className="go-label go-label-row">{y + 1}</span>
                {Array.from({ length: SIZE }, (_, x) => {
                  const stone = getStone(x, y);
                  const star = isStarPoint(x, y);
                  const coord = `${COLS[x]}${y + 1}`;
                  const isLegal = legalMoves.includes(coord);
                  return (
                    <div
                      key={x}
                      className={`go-cell ${interactive && isLegal ? 'go-cell-legal' : ''}`}
                      onClick={() => handleClick(x, y)}
                      title={coord}
                    >
                      <div className="go-intersection">
                        {star && !stone && <div className="go-star" />}
                      </div>
                      {stone && (
                        <div className={`go-stone go-stone-${stone}`} />
                      )}
                    </div>
                  );
                })}
                <span className="go-label go-label-row">{y + 1}</span>
              </div>
            );
          })}
          <div className="go-labels-top">
            {COLS.split('').map((c) => <span key={c} className="go-label">{c}</span>)}
          </div>
        </div>
      </div>
      {interactive && (
        <div className="go-actions">
          <button className="go-pass-btn" onClick={handlePass}>PASS</button>
        </div>
      )}
    </div>
  );
}
