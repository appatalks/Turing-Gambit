// ─── Connect Four Engine ────────────────────────────────
// 7 columns × 6 rows. Drop discs, connect 4 in a row.

export type C4Cell = '.' | 'R' | 'Y';
export type C4Color = 'w' | 'b'; // w = Red (first), b = Yellow
export type C4Status = 'active' | 'red_wins' | 'yellow_wins' | 'draw';

const COLS = 7;
const ROWS = 6;

export class ConnectFourEngine {
  private board: C4Cell[] = Array(COLS * ROWS).fill('.'); // row-major, row 0 = top
  private currentTurn: C4Color = 'w';
  private moveCount = 0;

  reset(): void {
    this.board = Array(COLS * ROWS).fill('.');
    this.currentTurn = 'w';
    this.moveCount = 0;
  }

  turn(): C4Color { return this.currentTurn; }

  private idx(r: number, c: number): number { return r * COLS + c; }

  boardState(): string {
    return this.board.join('') + ' ' + this.currentTurn;
  }

  boardForPrompt(): string {
    const lines: string[] = [];
    for (let r = 0; r < ROWS; r++) {
      let line = '|';
      for (let c = 0; c < COLS; c++) {
        const cell = this.board[this.idx(r, c)];
        line += (cell === '.' ? ' . ' : ` ${cell} `) + '|';
      }
      lines.push(line);
    }
    lines.push('  ' + Array.from({ length: COLS }, (_, i) => ` ${i + 1} `).join(' '));
    return lines.join('\n');
  }

  legalMoves(): string[] {
    const moves: string[] = [];
    for (let c = 0; c < COLS; c++) {
      if (this.board[this.idx(0, c)] === '.') moves.push(String(c + 1));
    }
    return moves;
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const col = parseInt(notation) - 1;
    if (isNaN(col) || col < 0 || col >= COLS) return null;
    // Find lowest empty row in column
    let landRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[this.idx(r, col)] === '.') { landRow = r; break; }
    }
    if (landRow === -1) return null; // column full

    const disc = this.currentTurn === 'w' ? 'R' : 'Y';
    this.board[this.idx(landRow, col)] = disc;
    this.moveCount++;
    const san = `${disc}→col${col + 1}`;
    this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';
    return { san };
  }

  isGameOver(): boolean { return this.gameStatus() !== 'active'; }

  gameStatus(): C4Status {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.board[this.idx(r, c)];
        if (cell === '.') continue;
        for (const [dr, dc] of dirs) {
          let k = 1;
          while (k < 4) {
            const nr = r + dr * k, nc = c + dc * k;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
            if (this.board[this.idx(nr, nc)] !== cell) break;
            k++;
          }
          if (k === 4) return cell === 'R' ? 'red_wins' : 'yellow_wins';
        }
      }
    }
    if (this.board.every((c) => c !== '.')) return 'draw';
    return 'active';
  }

  getMoveCount(): number { return this.moveCount; }
}
