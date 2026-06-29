import { useMemo } from 'react';

interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

const VISION = 5; // cells visible around each player in their view

function MiniMaze({ maze, px, py, gx, gy, label, steps, isActive, color }: {
  maze: number[][];
  px: number; py: number;
  gx: number; gy: number;
  label: string; steps: string;
  isActive: boolean;
  color: string;
}) {
  const h = maze.length;
  const w = maze[0]?.length || 0;

  return (
    <div className={`maze-view ${isActive ? 'maze-view-active' : ''}`}>
      <div className="maze-view-header">
        <span className="maze-view-label" style={{ color }}>{label}</span>
        <span className="maze-view-steps">{steps} steps</span>
      </div>
      <div className="maze-view-grid" style={{ gridTemplateColumns: `repeat(${w}, 1fr)` }}>
        {maze.map((row, y) =>
          row.map((cell, x) => {
            const isPlayer = x === px && y === py;
            const isGoal = x === gx && y === gy;
            const dist = Math.abs(x - px) + Math.abs(y - py);
            const inVision = dist <= VISION;

            let cls = 'maze-cell';
            if (!inVision) {
              cls += ' maze-fog';
            } else if (cell === 0) {
              cls += ' maze-wall';
            } else {
              cls += ' maze-path';
            }
            if (isGoal && inVision) cls += ' maze-goal';
            if (isPlayer) cls += ` maze-player-${color === '#4488ff' ? 'w' : 'b'}`;

            return <div key={`${x}-${y}`} className={cls} />;
          })
        )}
      </div>
    </div>
  );
}

export function MazeBoard({ boardState, interactive = false, onHumanMove, legalMoves = [] }: Props) {
  const parsed = useMemo(() => {
    const fields: Record<string, string> = {};
    for (const token of boardState.split('|')) {
      const sep = token.indexOf('=');
      if (sep > 0) fields[token.slice(0, sep)] = token.slice(sep + 1);
    }
    const mazeStr = fields['maze'] || '';
    const maze = mazeStr ? mazeStr.split('/').map((row) => row.split('').map(Number)) : [];
    const [wx, wy] = (fields['w_pos'] || '1,1').split(',').map(Number);
    const [bx, by] = (fields['b_pos'] || '1,1').split(',').map(Number);
    const [gx, gy] = (fields['goal'] || '19,19').split(',').map(Number);
    return {
      turn: fields['turn'] || 'w',
      moves: fields['moves'] || '0',
      wMoves: fields['w_moves'] || '0',
      bMoves: fields['b_moves'] || '0',
      maze, wx, wy, bx, by, gx, gy,
    };
  }, [boardState]);

  const { turn, moves, wMoves, bMoves, maze, wx, wy, bx, by, gx, gy } = parsed;

  function move(dir: string) {
    if (!interactive || !onHumanMove) return;
    if (!legalMoves.includes(dir)) return;
    onHumanMove(dir);
  }

  return (
    <div className="maze-board">
      <div className="maze-header">
        <span className="maze-title">🏁 MAZE RACE</span>
        <span className="maze-info">Turn {moves} • {turn === 'w' ? 'Runner 1' : 'Runner 2'} moving</span>
      </div>

      <div className="maze-dual">
        <MiniMaze
          maze={maze} px={wx} py={wy} gx={gx} gy={gy}
          label="🔵 Runner 1" steps={wMoves}
          isActive={turn === 'w'} color="#4488ff"
        />
        <MiniMaze
          maze={maze} px={bx} py={by} gx={gx} gy={gy}
          label="🔴 Runner 2" steps={bMoves}
          isActive={turn === 'b'} color="#ff4444"
        />
      </div>

      {interactive && (
        <div className="maze-controls">
          <button className="maze-btn" onClick={() => move('NORTH')} disabled={!legalMoves.includes('NORTH')}>⬆ N</button>
          <div className="maze-btn-row">
            <button className="maze-btn" onClick={() => move('WEST')} disabled={!legalMoves.includes('WEST')}>⬅ W</button>
            <button className="maze-btn" onClick={() => move('EAST')} disabled={!legalMoves.includes('EAST')}>E ➡</button>
          </div>
          <button className="maze-btn" onClick={() => move('SOUTH')} disabled={!legalMoves.includes('SOUTH')}>⬇ S</button>
        </div>
      )}
    </div>
  );
}
