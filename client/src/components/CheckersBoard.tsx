import { useState, useRef, useEffect } from 'react';

interface Props {
  boardState: string; // 32 chars + ' ' + turn
  lastMove?: { from: number; to: number };
  interactive?: boolean;
  boardOrientation?: 'black' | 'white';
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

type Piece = '.' | 'b' | 'w' | 'B' | 'W';

function sqToRC(sq: number): [number, number] {
  const row = Math.floor((sq - 1) / 4);
  const col = row % 2 === 0
    ? ((sq - 1) % 4) * 2 + 1
    : ((sq - 1) % 4) * 2;
  return [row, col];
}

function rcToSq(row: number, col: number): number | null {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  if ((row + col) % 2 === 0) return null; // light square
  return row * 4 + Math.floor(col / 2) + 1;
}

function parseBoardState(state: string): Piece[] {
  const board = new Array<Piece>(33).fill('.');
  const chars = state.split(' ')[0];
  for (let i = 0; i < 32 && i < chars.length; i++) {
    board[i + 1] = chars[i] as Piece;
  }
  return board;
}

export function CheckersBoardView({
  boardState,
  lastMove,
  interactive = false,
  boardOrientation = 'white',
  onHumanMove,
  legalMoves = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(480);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        const s = Math.min(e.contentRect.width, e.contentRect.height, 640);
        setBoardSize(Math.floor(s));
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const board = parseBoardState(boardState);
  const turn = boardState.split(' ')[1] as 'b' | 'w';
  const cellSize = boardSize / 8;
  const flip = boardOrientation === 'black';

  // Which destination squares are reachable from selected?
  const destinations = new Set<number>();
  const moveMap = new Map<number, string>(); // dest → full notation
  if (selected && interactive) {
    for (const m of legalMoves) {
      const parts = m.split('-').map(Number);
      if (parts[0] === selected) {
        const dest = parts[parts.length - 1];
        destinations.add(dest);
        moveMap.set(dest, m);
      }
    }
  }

  // Which squares have pieces that can move?
  const movablePieces = new Set<number>();
  if (interactive) {
    for (const m of legalMoves) {
      movablePieces.add(parseInt(m.split('-')[0]));
    }
  }

  function handleSquareClick(sq: number) {
    if (!interactive || !onHumanMove) return;

    if (destinations.has(sq) && selected) {
      // Execute move
      const notation = moveMap.get(sq);
      if (notation) {
        onHumanMove(notation);
        setSelected(null);
      }
    } else if (movablePieces.has(sq)) {
      setSelected(sq);
    } else {
      setSelected(null);
    }
  }

  const squares: JSX.Element[] = [];
  for (let displayRow = 0; displayRow < 8; displayRow++) {
    for (let displayCol = 0; displayCol < 8; displayCol++) {
      const row = flip ? 7 - displayRow : displayRow;
      const col = flip ? 7 - displayCol : displayCol;
      const isDark = (row + col) % 2 === 1;
      const sq = rcToSq(row, col);
      const piece = sq ? board[sq] : null;

      const isLastFrom = lastMove && sq === lastMove.from;
      const isLastTo = lastMove && sq === lastMove.to;
      const isSelected = sq === selected;
      const isDest = sq !== null && destinations.has(sq);
      const isMovable = sq !== null && movablePieces.has(sq) && interactive;

      let bgColor = isDark ? 'var(--sq-dark)' : 'var(--sq-light)';
      if (isLastFrom || isLastTo) bgColor = isDark ? 'rgba(0,212,255,0.25)' : bgColor;
      if (isSelected) bgColor = 'rgba(0,255,136,0.3)';
      if (isDest) bgColor = 'rgba(255,255,0,0.25)';

      squares.push(
        <div
          key={`${displayRow}-${displayCol}`}
          style={{
            width: cellSize,
            height: cellSize,
            backgroundColor: bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: (isMovable || isDest) ? 'pointer' : 'default',
            position: 'relative',
          }}
          onClick={() => sq && handleSquareClick(sq)}
        >
          {piece && piece !== '.' && (
            <div
              style={{
                width: cellSize * 0.72,
                height: cellSize * 0.72,
                borderRadius: '50%',
                background:
                  piece === 'b' || piece === 'B'
                    ? 'radial-gradient(circle at 35% 35%, #555, #1a1a1a)'
                    : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                border: `2px solid ${piece === 'b' || piece === 'B' ? '#333' : '#aaa'}`,
                boxShadow: isMovable
                  ? '0 0 12px rgba(0,255,136,0.4)'
                  : '0 2px 6px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'box-shadow 0.2s',
              }}
            >
              {(piece === 'B' || piece === 'W') && (
                <span
                  style={{
                    fontSize: cellSize * 0.35,
                    color: piece === 'B' ? '#ffd700' : '#b8860b',
                    fontWeight: 'bold',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  ♛
                </span>
              )}
            </div>
          )}
          {isDest && !piece && (
            <div
              style={{
                width: cellSize * 0.25,
                height: cellSize * 0.25,
                borderRadius: '50%',
                background: 'rgba(255,255,0,0.5)',
              }}
            />
          )}
        </div>,
      );
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: 300,
      }}
    >
      <div
        className={`board-wrapper ${interactive ? 'board-interactive' : ''}`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(8, ${cellSize}px)`,
          gridTemplateRows: `repeat(8, ${cellSize}px)`,
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 60px rgba(0,212,255,0.06)',
        }}
      >
        {squares}
      </div>
    </div>
  );
}
