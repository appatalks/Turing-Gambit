// ─── Tic-Tac-Toe Engine ─────────────────────────────────

export type TTTCell = '.' | 'X' | 'O';
export type TTTColor = 'w' | 'b'; // w = X (first), b = O
export type TTTStatus = 'active' | 'x_wins' | 'o_wins' | 'draw';

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

export class TicTacToeEngine {
  private board: TTTCell[] = Array(9).fill('.');
  private currentTurn: TTTColor = 'w';
  private moveCount = 0;

  reset(): void {
    this.board = Array(9).fill('.');
    this.currentTurn = 'w';
    this.moveCount = 0;
  }

  turn(): TTTColor {
    return this.currentTurn;
  }

  boardState(): string {
    return this.board.join('') + ' ' + this.currentTurn;
  }

  boardForPrompt(): string {
    const r = (i: number) => this.board[i] === '.' ? String(i + 1) : this.board[i];
    return ` ${r(0)} | ${r(1)} | ${r(2)}\n-----------\n ${r(3)} | ${r(4)} | ${r(5)}\n-----------\n ${r(6)} | ${r(7)} | ${r(8)}`;
  }

  legalMoves(): string[] {
    const moves: string[] = [];
    for (let i = 0; i < 9; i++) {
      if (this.board[i] === '.') moves.push(String(i + 1));
    }
    return moves;
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const pos = parseInt(notation) - 1;
    if (isNaN(pos) || pos < 0 || pos > 8 || this.board[pos] !== '.') return null;

    const mark = this.currentTurn === 'w' ? 'X' : 'O';
    this.board[pos] = mark;
    this.moveCount++;

    const san = `${mark}→${pos + 1}`;
    this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';

    return { san };
  }

  isGameOver(): boolean {
    return this.gameStatus() !== 'active';
  }

  gameStatus(): TTTStatus {
    for (const [a, b, c] of WIN_LINES) {
      if (this.board[a] !== '.' && this.board[a] === this.board[b] && this.board[b] === this.board[c]) {
        return this.board[a] === 'X' ? 'x_wins' : 'o_wins';
      }
    }
    if (this.board.every((c) => c !== '.')) return 'draw';
    return 'active';
  }

  getMoveCount(): number {
    return this.moveCount;
  }
}
