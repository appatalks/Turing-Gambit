/**
 * Go (9x9) — The ancient strategy game on a small board.
 * Two players place stones, capture groups with no liberties.
 * Scoring: Area scoring (Chinese rules). Komi 5.5 for white.
 * Pass twice to end. Illegal: suicide, ko.
 */

export type GoColor = 'w' | 'b';
export type GoStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';
type Stone = 'w' | 'b' | null;

const SIZE = 9;
const KOMI = 5.5;
const MAX_MOVES = 200;
const PASS = 'PASS';

function idx(x: number, y: number): number { return y * SIZE + x; }
function coordToStr(x: number, y: number): string {
  const col = 'ABCDEFGHJ'[x]; // Skip 'I' per Go convention
  return `${col}${y + 1}`;
}
function strToCoord(s: string): [number, number] | null {
  const match = s.match(/^([A-HJ])(\d+)$/i);
  if (!match) return null;
  const col = 'ABCDEFGHJ'.indexOf(match[1].toUpperCase());
  const row = parseInt(match[2]) - 1;
  if (col < 0 || col >= SIZE || row < 0 || row >= SIZE) return null;
  return [col, row];
}

function neighbors(x: number, y: number): [number, number][] {
  const n: [number, number][] = [];
  if (x > 0) n.push([x - 1, y]);
  if (x < SIZE - 1) n.push([x + 1, y]);
  if (y > 0) n.push([x, y - 1]);
  if (y < SIZE - 1) n.push([x, y + 1]);
  return n;
}

function cloneBoard(board: Stone[]): Stone[] { return [...board]; }

function getGroup(board: Stone[], x: number, y: number): { stones: number[]; liberties: Set<number> } {
  const color = board[idx(x, y)];
  if (!color) return { stones: [], liberties: new Set() };
  const stones: number[] = [];
  const liberties = new Set<number>();
  const visited = new Set<number>();
  const queue: [number, number][] = [[x, y]];
  visited.add(idx(x, y));

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    const ci = idx(cx, cy);
    stones.push(ci);
    for (const [nx, ny] of neighbors(cx, cy)) {
      const ni = idx(nx, ny);
      if (visited.has(ni)) continue;
      visited.add(ni);
      if (board[ni] === null) {
        liberties.add(ni);
      } else if (board[ni] === color) {
        queue.push([nx, ny]);
      }
    }
  }
  return { stones, liberties };
}

function removeGroup(board: Stone[], stones: number[]): number {
  for (const i of stones) board[i] = null;
  return stones.length;
}

function boardHash(board: Stone[]): string {
  return board.map((s) => s === 'b' ? 'B' : s === 'w' ? 'W' : '.').join('');
}

// Area scoring (Chinese rules)
function scoreBoard(board: Stone[]): { black: number; white: number } {
  let black = 0;
  let white = 0;
  const counted = new Set<number>();

  for (let i = 0; i < SIZE * SIZE; i++) {
    if (board[i] === 'b') { black++; counted.add(i); }
    else if (board[i] === 'w') { white++; counted.add(i); }
  }

  // Count empty territory
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (counted.has(i) || board[i] !== null) continue;
    // Flood-fill empty region
    const region: number[] = [];
    const borders = new Set<GoColor>();
    const queue: number[] = [i];
    const visited = new Set<number>();
    visited.add(i);
    while (queue.length > 0) {
      const ci = queue.shift()!;
      region.push(ci);
      const cx = ci % SIZE;
      const cy = Math.floor(ci / SIZE);
      for (const [nx, ny] of neighbors(cx, cy)) {
        const ni = idx(nx, ny);
        if (visited.has(ni)) continue;
        visited.add(ni);
        if (board[ni] === null) queue.push(ni);
        else borders.add(board[ni]!);
      }
    }
    // If surrounded by only one color, it's that color's territory
    if (borders.size === 1) {
      const owner = [...borders][0];
      if (owner === 'b') black += region.length;
      else white += region.length;
    }
    for (const ri of region) counted.add(ri);
  }

  return { black, white: white + KOMI };
}

export class GoEngine {
  private board: Stone[] = Array(SIZE * SIZE).fill(null);
  private currentTurn: GoColor = 'b'; // Black plays first in Go
  private status: GoStatus = 'active';
  private moveCount = 0;
  private passes = 0;
  private koPoint: number | null = null;
  private history = new Set<string>();
  private captures = { w: 0, b: 0 }; // stones captured by each side

  constructor() { this.reset(); }

  reset(): void {
    this.board = Array(SIZE * SIZE).fill(null);
    this.currentTurn = 'b';
    this.status = 'active';
    this.moveCount = 0;
    this.passes = 0;
    this.koPoint = null;
    this.history.clear();
    this.captures = { w: 0, b: 0 };
    this.history.add(boardHash(this.board));
  }

  turn(): GoColor { return this.currentTurn; }

  boardState(): string {
    const cells = this.board.map((s) => s === 'b' ? 'B' : s === 'w' ? 'W' : '.').join('');
    return `turn=${this.currentTurn} moves=${this.moveCount} board=${cells} captures_w=${this.captures.w} captures_b=${this.captures.b} passes=${this.passes}`;
  }

  boardForPrompt(side: GoColor = this.currentTurn): string {
    const you = side === 'b' ? 'Black (●)' : 'White (○)';
    const lines: string[] = [
      `=== GO (9×9) — You are ${you} ===`,
      `Move: ${this.moveCount} | Captures: Black took ${this.captures.b}, White took ${this.captures.w} | Komi: ${KOMI} (White)`,
      '',
      '  A B C D E F G H J',
    ];

    for (let y = SIZE - 1; y >= 0; y--) {
      const row: string[] = [];
      for (let x = 0; x < SIZE; x++) {
        const s = this.board[idx(x, y)];
        row.push(s === 'b' ? '●' : s === 'w' ? '○' : '·');
      }
      lines.push(`${y + 1} ${row.join(' ')} ${y + 1}`);
    }
    lines.push('  A B C D E F G H J');
    lines.push('');
    lines.push(`Place a stone at an intersection, or PASS.`);
    lines.push(`Notation: column letter + row number (e.g., E5, A1, J9)`);

    return lines.join('\n');
  }

  legalMoves(): string[] {
    const moves: string[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (this.isLegal(x, y)) {
          moves.push(coordToStr(x, y));
        }
      }
    }
    moves.push(PASS);
    return moves;
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    if (this.status !== 'active') return null;
    const move = notation.trim().toUpperCase();

    if (move === PASS) {
      this.passes++;
      this.koPoint = null;
      this.moveCount++;
      if (this.passes >= 2) this.resolveGame();
      else this.currentTurn = this.currentTurn === 'b' ? 'w' : 'b';
      return { san: `${this.currentTurn === 'b' ? 'White' : 'Black'} passes` };
    }

    const coord = strToCoord(move);
    if (!coord) return null;
    const [x, y] = coord;
    if (!this.isLegal(x, y)) return null;

    this.passes = 0;
    const captured = this.placeStone(x, y);
    this.moveCount++;

    if (this.moveCount >= MAX_MOVES) this.resolveGame();
    else this.currentTurn = this.currentTurn === 'b' ? 'w' : 'b';

    const san = `${this.currentTurn === 'b' ? 'White' : 'Black'}: ${move}${captured > 0 ? ` (captures ${captured})` : ''}`;
    return { san, captured: captured > 0 ? String(captured) : undefined };
  }

  isGameOver(): boolean { return this.status !== 'active'; }
  gameStatus(): GoStatus { return this.status; }

  private isLegal(x: number, y: number): boolean {
    const i = idx(x, y);
    if (this.board[i] !== null) return false;
    if (i === this.koPoint) return false;

    // Try placing
    const test = cloneBoard(this.board);
    test[i] = this.currentTurn;
    const opp = this.currentTurn === 'b' ? 'w' : 'b';

    // Remove opponent captures
    let anyCap = false;
    for (const [nx, ny] of neighbors(x, y)) {
      if (test[idx(nx, ny)] === opp) {
        const group = getGroup(test, nx, ny);
        if (group.liberties.size === 0) {
          removeGroup(test, group.stones);
          anyCap = true;
        }
      }
    }

    // Check suicide
    if (!anyCap) {
      const selfGroup = getGroup(test, x, y);
      if (selfGroup.liberties.size === 0) return false;
    }

    // Check superko
    const hash = boardHash(test);
    if (this.history.has(hash)) return false;

    return true;
  }

  private placeStone(x: number, y: number): number {
    const i = idx(x, y);
    this.board[i] = this.currentTurn;
    const opp = this.currentTurn === 'b' ? 'w' : 'b';
    let totalCaptures = 0;

    for (const [nx, ny] of neighbors(x, y)) {
      if (this.board[idx(nx, ny)] === opp) {
        const group = getGroup(this.board, nx, ny);
        if (group.liberties.size === 0) {
          totalCaptures += removeGroup(this.board, group.stones);
        }
      }
    }

    this.captures[this.currentTurn] += totalCaptures;

    // Set ko point if exactly 1 stone captured and the placed stone has exactly 1 liberty
    if (totalCaptures === 1) {
      const selfGroup = getGroup(this.board, x, y);
      if (selfGroup.stones.length === 1 && selfGroup.liberties.size === 1) {
        this.koPoint = [...selfGroup.liberties][0];
      } else {
        this.koPoint = null;
      }
    } else {
      this.koPoint = null;
    }

    this.history.add(boardHash(this.board));
    return totalCaptures;
  }

  private resolveGame(): void {
    const score = scoreBoard(this.board);
    if (score.black > score.white) this.status = 'black_wins';
    else if (score.white > score.black) this.status = 'white_wins';
    else this.status = 'draw';
  }
}
