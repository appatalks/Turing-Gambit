interface Props {
  boardState: string; // "h v bx scoreW scoreB turn"
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

const SIZE = 8;
const DOTS = 9;

export function DotsAndBoxesBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  const parts = boardState.split(' ');
  const h = (parts[0] || '0'.repeat(DOTS * SIZE)).padEnd(DOTS * SIZE, '0');
  const v = (parts[1] || '0'.repeat(SIZE * DOTS)).padEnd(SIZE * DOTS, '0');
  const bx = (parts[2] || '.'.repeat(SIZE * SIZE)).padEnd(SIZE * SIZE, '.');
  const scoreW = parts[3] || '0';
  const scoreB = parts[4] || '0';

  const hEdge = (r: number, c: number) => h[r * SIZE + c] === '1';
  const vEdge = (r: number, c: number) => v[r * DOTS + c] === '1';
  const box = (r: number, c: number) => bx[r * SIZE + c];

  function play(notation: string) {
    if (!interactive || !onHumanMove) return;
    if (!legalMoves.includes(notation)) return;
    onHumanMove(notation);
  }

  // Build grid rows: alternating dot-rows and box-rows
  const rows: JSX.Element[] = [];
  for (let r = 0; r < DOTS; r++) {
    // Dot row with horizontal edges
    const dotRow: JSX.Element[] = [];
    for (let c = 0; c < DOTS; c++) {
      dotRow.push(<div key={`d${r}${c}`} className="dab-dot" />);
      if (c < SIZE) {
        const n = `H${r}${c}`;
        const on = hEdge(r, c);
        const legal = interactive && legalMoves.includes(n);
        dotRow.push(
          <div
            key={`h${r}${c}`}
            className={`dab-hedge ${on ? 'dab-on' : ''} ${legal ? 'dab-legal' : ''}`}
            onClick={() => play(n)}
          />,
        );
      }
    }
    rows.push(<div key={`dr${r}`} className="dab-dotrow">{dotRow}</div>);

    // Box row with vertical edges (skip after last dot row)
    if (r < SIZE) {
      const boxRow: JSX.Element[] = [];
      for (let c = 0; c < DOTS; c++) {
        const n = `V${r}${c}`;
        const on = vEdge(r, c);
        const legal = interactive && legalMoves.includes(n);
        boxRow.push(
          <div
            key={`v${r}${c}`}
            className={`dab-vedge ${on ? 'dab-on' : ''} ${legal ? 'dab-legal' : ''}`}
            onClick={() => play(n)}
          />,
        );
        if (c < SIZE) {
          const owner = box(r, c);
          boxRow.push(
            <div key={`b${r}${c}`} className={`dab-box ${owner === 'w' ? 'dab-bw' : owner === 'b' ? 'dab-bb' : ''}`}>
              {owner === 'w' ? 'A' : owner === 'b' ? 'B' : ''}
            </div>,
          );
        }
      }
      rows.push(<div key={`br${r}`} className="dab-boxrow">{boxRow}</div>);
    }
  }

  return (
    <div className="dab-wrap">
      <div className="dab-scores">
        <span className="dab-sa">A: {scoreW}</span>
        <span className="dab-sb">B: {scoreB}</span>
      </div>
      <div className="dab-grid">{rows}</div>
    </div>
  );
}
