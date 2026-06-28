// ─── Dots and Boxes Engine ──────────────────────────────
// 6×6 boxes (7×7 dots). Draw edges; complete a box to score
// and earn another turn. Most boxes wins.

export type DBColor = 'w' | 'b';
export type DBStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';

const SIZE = 6; // boxes per side
const DOTS = SIZE + 1;

export class DotsAndBoxesEngine {
  // Horizontal edges: rows 0..SIZE, cols 0..SIZE-1
  private hEdges: boolean[][] = [];
  // Vertical edges: rows 0..SIZE-1, cols 0..SIZE
  private vEdges: boolean[][] = [];
  // Box owners: SIZE×SIZE, '' | 'w' | 'b'
  private boxes: string[][] = [];
  private currentTurn: DBColor = 'w';
  private scores = { w: 0, b: 0 };

  constructor() { this.reset(); }

  reset(): void {
    this.hEdges = Array.from({ length: DOTS }, () => Array(SIZE).fill(false));
    this.vEdges = Array.from({ length: SIZE }, () => Array(DOTS).fill(false));
    this.boxes = Array.from({ length: SIZE }, () => Array(SIZE).fill(''));
    this.currentTurn = 'w';
    this.scores = { w: 0, b: 0 };
  }

  turn(): DBColor { return this.currentTurn; }
  getScores() { return { ...this.scores }; }

  boardState(): string {
    const h = this.hEdges.map((row) => row.map((e) => e ? '1' : '0').join('')).join('');
    const v = this.vEdges.map((row) => row.map((e) => e ? '1' : '0').join('')).join('');
    const bx = this.boxes.map((row) => row.map((o) => o || '.').join('')).join('');
    return `${h} ${v} ${bx} ${this.scores.w} ${this.scores.b} ${this.currentTurn}`;
  }

  boardForPrompt(): string {
    const lines: string[] = [];
    for (let r = 0; r < DOTS; r++) {
      // Dot + horizontal edges
      let line = '';
      for (let c = 0; c < SIZE; c++) {
        line += '•';
        line += this.hEdges[r][c] ? '───' : '   ';
      }
      line += '•';
      lines.push(line);
      // Vertical edges + box owners
      if (r < SIZE) {
        let vline = '';
        for (let c = 0; c < DOTS; c++) {
          vline += this.vEdges[r][c] ? '│' : ' ';
          if (c < SIZE) {
            const owner = this.boxes[r][c];
            vline += owner ? ` ${owner.toUpperCase()} ` : '   ';
          }
        }
        lines.push(vline);
      }
    }
    return lines.join('\n');
  }

  legalMoves(): string[] {
    const moves: string[] = [];
    for (let r = 0; r < DOTS; r++)
      for (let c = 0; c < SIZE; c++)
        if (!this.hEdges[r][c]) moves.push(`H${r}${c}`);
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < DOTS; c++)
        if (!this.vEdges[r][c]) moves.push(`V${r}${c}`);
    return moves;
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const m = notation.trim().toUpperCase().match(/^([HV])(\d)(\d)$/);
    if (!m) return null;
    const [, type, rs, cs] = m;
    const r = parseInt(rs), c = parseInt(cs);

    if (type === 'H') {
      if (r < 0 || r >= DOTS || c < 0 || c >= SIZE || this.hEdges[r][c]) return null;
      this.hEdges[r][c] = true;
    } else {
      if (r < 0 || r >= SIZE || c < 0 || c >= DOTS || this.vEdges[r][c]) return null;
      this.vEdges[r][c] = true;
    }

    // Check for completed boxes adjacent to this edge
    const completed = this.checkNewBoxes();
    let san = `${notation.toUpperCase()}`;
    let captured: string | undefined;
    if (completed > 0) {
      this.scores[this.currentTurn] += completed;
      san += ` (+${completed} box${completed > 1 ? 'es' : ''})`;
      captured = 'box';
      // Extra turn: do NOT flip turn
    } else {
      this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';
    }
    return { san, captured };
  }

  private checkNewBoxes(): number {
    let count = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (this.boxes[r][c]) continue;
        if (this.hEdges[r][c] && this.hEdges[r + 1][c] && this.vEdges[r][c] && this.vEdges[r][c + 1]) {
          this.boxes[r][c] = this.currentTurn;
          count++;
        }
      }
    }
    return count;
  }

  isGameOver(): boolean {
    return this.boxes.every((row) => row.every((o) => o !== ''));
  }

  gameStatus(): DBStatus {
    if (!this.isGameOver()) return 'active';
    if (this.scores.w > this.scores.b) return 'white_wins';
    if (this.scores.b > this.scores.w) return 'black_wins';
    return 'draw';
  }
}
