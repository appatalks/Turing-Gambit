import { useRef, useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';

interface Props {
  fen: string;
  lastMove?: { from: string; to: string };
  interactive?: boolean;
  boardOrientation?: 'white' | 'black';
  onHumanMove?: (uci: string) => void;
  gameStatus?: string;
}

export function ChessBoardView({
  fen,
  lastMove,
  interactive = false,
  boardOrientation = 'white',
  onHumanMove,
  gameStatus,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(480);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setBoardWidth(Math.floor(Math.min(width, height, 640)));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const highlightStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    highlightStyles[lastMove.from] = {
      background: 'radial-gradient(circle, rgba(0,212,255,0.25) 40%, transparent 70%)',
    };
    highlightStyles[lastMove.to] = {
      background: 'radial-gradient(circle, rgba(0,212,255,0.4) 40%, transparent 70%)',
    };
  }

  // Highlight the king square when in check
  if (gameStatus === 'check') {
    const parts = fen.split(' ');
    const activeColor = parts[1]; // 'w' or 'b' — side to move is the one in check
    const kingChar = activeColor === 'w' ? 'K' : 'k';
    const ranks = parts[0].split('/');
    for (let r = 0; r < ranks.length; r++) {
      let col = 0;
      for (const ch of ranks[r]) {
        if (ch >= '1' && ch <= '8') { col += parseInt(ch); }
        else {
          if (ch === kingChar) {
            const sq = String.fromCharCode(97 + col) + (8 - r);
            highlightStyles[sq] = {
              background: 'radial-gradient(circle, rgba(255,0,0,0.6) 30%, rgba(255,0,0,0.2) 70%, transparent 90%)',
              boxShadow: 'inset 0 0 12px rgba(255,0,0,0.8)',
            };
          }
          col++;
        }
      }
    }
  }

  function handleDrop(from: string, to: string, piece: string): boolean {
    if (!interactive || !onHumanMove) return false;
    // Auto-promote to queen; UCI promotion suffix only when a pawn reaches the last rank
    const isPromotion =
      piece[1]?.toLowerCase() === 'p' && (to[1] === '8' || to[1] === '1');
    const uci = from + to + (isPromotion ? 'q' : '');
    onHumanMove(uci);
    return true;
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
      <div className={`board-wrapper ${interactive ? 'board-interactive' : ''}`}>
        <Chessboard
          position={fen}
          boardWidth={boardWidth}
          animationDuration={280}
          boardOrientation={boardOrientation}
          arePiecesDraggable={interactive}
          onPieceDrop={handleDrop}
          customBoardStyle={{
            borderRadius: '8px',
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(0, 212, 255, 0.06)',
          }}
          customDarkSquareStyle={{ backgroundColor: 'var(--sq-dark, #364060)' }}
          customLightSquareStyle={{ backgroundColor: 'var(--sq-light, #5c6b8a)' }}
          customSquareStyles={highlightStyles}
        />
      </div>
    </div>
  );
}
