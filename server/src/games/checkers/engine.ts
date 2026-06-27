// ─── American Checkers (English Draughts) Engine ────────
// 8x8 board, 12 pieces per side, forced captures, multi-jumps.
// Squares numbered 1-32 (playable dark squares only).
//
// Board layout:
//   Row 0:  .  1  .  2  .  3  .  4
//   Row 1:  5  .  6  .  7  .  8  .
//   Row 2:  .  9  . 10  . 11  . 12
//   Row 3: 13  . 14  . 15  . 16  .
//   Row 4:  . 17  . 18  . 19  . 20
//   Row 5: 21  . 22  . 23  . 24  .
//   Row 6:  . 25  . 26  . 27  . 28
//   Row 7: 29  . 30  . 31  . 32  .

export type Piece = '.' | 'b' | 'w' | 'B' | 'W';
export type Color = 'b' | 'w';
export type CheckersStatus = 'active' | 'black_wins' | 'white_wins' | 'draw';

export interface CheckersMove {
  path: number[];      // [from, ...to] — length 2 for simple, 3+ for multi-jump
  captured: number[];  // squares of captured pieces
}

export class CheckersEngine {
  private board: Piece[] = new Array(33).fill('.'); // index 0 unused, 1-32
  private currentTurn: Color = 'b'; // black moves first
  private moveCount = 0;
  private noCaptureMoves = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.board.fill('.');
    // Black pieces on squares 1-12
    for (let i = 1; i <= 12; i++) this.board[i] = 'b';
    // White pieces on squares 21-32
    for (let i = 21; i <= 32; i++) this.board[i] = 'w';
    this.currentTurn = 'b';
    this.moveCount = 0;
    this.noCaptureMoves = 0;
  }

  turn(): Color {
    return this.currentTurn;
  }

  boardState(): string {
    // Compact notation: 32 chars + turn
    return this.board.slice(1).join('') + ' ' + this.currentTurn;
  }

  getMoveCount(): number {
    return this.moveCount;
  }

  // ── Coordinate helpers ────────────────────────────

  private static sqToRC(sq: number): [number, number] {
    const row = Math.floor((sq - 1) / 4);
    const col = row % 2 === 0
      ? ((sq - 1) % 4) * 2 + 1
      : ((sq - 1) % 4) * 2;
    return [row, col];
  }

  private static rcToSq(row: number, col: number): number | null {
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    if (row % 2 === 0 && col % 2 === 0) return null; // light square
    if (row % 2 === 1 && col % 2 === 1) return null; // light square
    return row * 4 + Math.floor(col / 2) + 1;
  }

  // ── Legal moves ───────────────────────────────────

  legalMoves(): CheckersMove[] {
    const jumps = this.allJumps(this.currentTurn);
    if (jumps.length > 0) return jumps; // forced capture
    return this.allSimpleMoves(this.currentTurn);
  }

  legalMovesNotation(): string[] {
    return this.legalMoves().map((m) => m.path.join('-'));
  }

  private allSimpleMoves(color: Color): CheckersMove[] {
    const moves: CheckersMove[] = [];
    for (let sq = 1; sq <= 32; sq++) {
      if (!this.isOwnPiece(sq, color)) continue;
      const dirs = this.getDirs(sq);
      const [r, c] = CheckersEngine.sqToRC(sq);
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        const dest = CheckersEngine.rcToSq(nr, nc);
        if (dest && this.board[dest] === '.') {
          moves.push({ path: [sq, dest], captured: [] });
        }
      }
    }
    return moves;
  }

  private allJumps(color: Color): CheckersMove[] {
    const allPaths: CheckersMove[] = [];
    for (let sq = 1; sq <= 32; sq++) {
      if (!this.isOwnPiece(sq, color)) continue;
      this.findJumpChains(sq, [], [], new Set(), allPaths);
    }
    // If there are multi-jumps, keep only the longest chains (optional rule — we'll keep all)
    return allPaths;
  }

  private findJumpChains(
    sq: number,
    pathSoFar: number[],
    capturedSoFar: number[],
    visited: Set<number>,
    results: CheckersMove[],
  ): void {
    const [r, c] = CheckersEngine.sqToRC(sq);
    const dirs = this.getDirs(sq);
    let foundJump = false;

    for (const [dr, dc] of dirs) {
      const midR = r + dr;
      const midC = c + dc;
      const midSq = CheckersEngine.rcToSq(midR, midC);
      if (!midSq || visited.has(midSq)) continue;

      const destR = r + 2 * dr;
      const destC = c + 2 * dc;
      const destSq = CheckersEngine.rcToSq(destR, destC);
      if (!destSq) continue;

      if (this.isOpponentPiece(midSq, this.currentTurn) && this.board[destSq] === '.') {
        foundJump = true;
        const newVisited = new Set(visited);
        newVisited.add(midSq);

        // Temporarily move piece to check for further jumps
        const origPiece = this.board[sq];
        const capturedPiece = this.board[midSq];
        this.board[sq] = '.';
        this.board[midSq] = '.';
        this.board[destSq] = origPiece;

        this.findJumpChains(
          destSq,
          [...pathSoFar, ...(pathSoFar.length === 0 ? [sq] : []), destSq],
          [...capturedSoFar, midSq],
          newVisited,
          results,
        );

        // Restore
        this.board[sq] = origPiece;
        this.board[midSq] = capturedPiece;
        this.board[destSq] = '.';
      }
    }

    if (!foundJump && pathSoFar.length > 0) {
      results.push({
        path: pathSoFar,
        captured: capturedSoFar,
      });
    }
  }

  private getDirs(sq: number): [number, number][] {
    const piece = this.board[sq];
    if (piece === 'b') return [[1, -1], [1, 1]]; // black moves down
    if (piece === 'w') return [[-1, -1], [-1, 1]]; // white moves up
    // Kings move all 4 directions
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  }

  private isOwnPiece(sq: number, color: Color): boolean {
    const p = this.board[sq];
    return color === 'b' ? (p === 'b' || p === 'B') : (p === 'w' || p === 'W');
  }

  private isOpponentPiece(sq: number, color: Color): boolean {
    const p = this.board[sq];
    return color === 'b' ? (p === 'w' || p === 'W') : (p === 'b' || p === 'B');
  }

  // ── Make move ─────────────────────────────────────

  makeMove(notation: string): { san: string; captured: string | undefined } | null {
    const parts = notation.split('-').map(Number);
    if (parts.some(isNaN) || parts.length < 2) return null;

    const legal = this.legalMoves();
    const match = legal.find(
      (m) => m.path.length === parts.length && m.path.every((v, i) => v === parts[i]),
    );
    if (!match) return null;

    // Apply the move
    const from = match.path[0];
    const to = match.path[match.path.length - 1];
    const piece = this.board[from];
    this.board[from] = '.';

    // Remove captured pieces
    for (const cap of match.captured) {
      this.board[cap] = '.';
    }

    // Check for promotion (reaching the king row)
    const [destRow] = CheckersEngine.sqToRC(to);
    let promoted = false;
    if (piece === 'b' && destRow === 7) {
      this.board[to] = 'B';
      promoted = true;
    } else if (piece === 'w' && destRow === 0) {
      this.board[to] = 'W';
      promoted = true;
    } else {
      this.board[to] = piece;
    }

    const san = notation + (promoted ? '♚' : '');
    // Store 'c' for each piece captured (supports multi-jumps capturing multiple)
    const capturedStr = match.captured.length > 0 ? 'c' : undefined;

    this.moveCount++;
    if (match.captured.length > 0) {
      this.noCaptureMoves = 0;
    } else {
      this.noCaptureMoves++;
    }

    this.currentTurn = this.currentTurn === 'b' ? 'w' : 'b';

    return { san, captured: capturedStr };
  }

  // ── Game state ────────────────────────────────────

  isGameOver(): boolean {
    if (this.noCaptureMoves >= 80) return true; // 40-move rule (80 half-moves)
    return this.legalMoves().length === 0;
  }

  gameStatus(): CheckersStatus {
    if (this.noCaptureMoves >= 80) return 'draw';
    if (this.legalMoves().length === 0) {
      // Current player has no moves — they lose
      return this.currentTurn === 'b' ? 'white_wins' : 'black_wins';
    }
    return 'active';
  }

  // ── Display ───────────────────────────────────────

  ascii(): string {
    const lines: string[] = ['  1 2 3 4 5 6 7 8'];
    for (let row = 0; row < 8; row++) {
      let line = (row + 1) + ' ';
      for (let col = 0; col < 8; col++) {
        const sq = CheckersEngine.rcToSq(row, col);
        if (!sq) {
          line += '· ';
        } else {
          const p = this.board[sq];
          line += (p === '.' ? '_ ' : p + ' ');
        }
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  boardForPrompt(): string {
    const lines: string[] = [];
    for (let row = 0; row < 8; row++) {
      let line = '';
      for (let col = 0; col < 8; col++) {
        const sq = CheckersEngine.rcToSq(row, col);
        if (!sq) {
          line += ' . ';
        } else {
          const p = this.board[sq];
          line += p === '.' ? ' _ ' : ` ${p} `;
        }
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  // ── Piece counts ──────────────────────────────────

  pieceCounts(): { black: number; white: number; blackKings: number; whiteKings: number } {
    let black = 0, white = 0, blackKings = 0, whiteKings = 0;
    for (let i = 1; i <= 32; i++) {
      switch (this.board[i]) {
        case 'b': black++; break;
        case 'w': white++; break;
        case 'B': blackKings++; break;
        case 'W': whiteKings++; break;
      }
    }
    return { black, white, blackKings, whiteKings };
  }
}
