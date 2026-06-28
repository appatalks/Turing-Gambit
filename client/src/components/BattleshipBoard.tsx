import { Fragment } from 'react';

interface Props {  boardState: string; // "gridA gridB turn"
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

const SIZE = 10;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

function Grid({
  cells,
  title,
  firing,
  interactive,
  legalMoves,
  onPlay,
}: {
  cells: string;
  title: string;
  firing: boolean;
  interactive: boolean;
  legalMoves: string[];
  onPlay: (n: string) => void;
}) {
  return (
    <div className="bs-grid-block">
      <div className={`bs-grid-title ${firing ? 'bs-firing' : ''}`}>{title}</div>
      <div className="bs-grid">
        <div className="bs-corner" />
        {LETTERS.map((l) => <div key={l} className="bs-head">{l}</div>)}
        {Array.from({ length: SIZE }).map((_, r) => (
          <Fragment key={`row${r}`}>
            <div key={`rh${r}`} className="bs-head">{r + 1}</div>
            {Array.from({ length: SIZE }).map((__, c) => {
              const ch = cells[r * SIZE + c] || '.';
              const coord = LETTERS[c] + (r + 1);
              const legal = firing && interactive && legalMoves.includes(coord);
              const cls = ch === 'X' ? 'bs-hit' : ch === 'o' ? 'bs-miss' : ch === 's' ? 'bs-ship' : 'bs-water';
              return (
                <div
                  key={`${r}${c}`}
                  className={`bs-cell ${cls} ${legal ? 'bs-legal' : ''}`}
                  onClick={() => legal && onPlay(coord)}
                >
                  {ch === 'X' ? '✸' : ch === 'o' ? '•' : ''}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function BattleshipBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  const parts = boardState.split(' ');
  const gridA = (parts[0] || '.'.repeat(SIZE * SIZE)).padEnd(SIZE * SIZE, '.');
  const gridB = (parts[1] || '.'.repeat(SIZE * SIZE)).padEnd(SIZE * SIZE, '.');
  const turn = parts[2] || 'w';

  function play(n: string) {
    if (!interactive || !onHumanMove) return;
    onHumanMove(n);
  }

  // White fires at gridB; Black fires at gridA.
  return (
    <div className="bs-wrap">
      <Grid
        cells={gridB}
        title="Side B waters"
        firing={turn === 'w'}
        interactive={interactive}
        legalMoves={legalMoves}
        onPlay={play}
      />
      <Grid
        cells={gridA}
        title="Side A waters"
        firing={turn === 'b'}
        interactive={interactive}
        legalMoves={legalMoves}
        onPlay={play}
      />
    </div>
  );
}
