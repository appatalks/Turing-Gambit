/**
 * Maze Race — Procedurally generated maze that both players must navigate.
 * Same maze for both, but neither can see the other. First to reach the exit wins.
 * Tests spatial reasoning, pathfinding, and memory of dead ends.
 */

export type MazeColor = 'w' | 'b';
export type MazeStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';
type Cell = 0 | 1; // 0 = wall, 1 = path

const MAZE_W = 21; // odd for proper maze gen
const MAZE_H = 21;
const MAX_TURNS = 200;

function generateMaze(seed: number): Cell[][] {
  const grid: Cell[][] = Array.from({ length: MAZE_H }, () => Array<Cell>(MAZE_W).fill(0));
  const rng = createRng(seed);

  // Recursive backtracker
  function carve(x: number, y: number) {
    grid[y][x] = 1;
    const dirs: [number, number][] = [[0, -2], [0, 2], [-2, 0], [2, 0]];
    shuffle(dirs, rng);
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && nx < MAZE_W - 1 && ny > 0 && ny < MAZE_H - 1 && grid[ny][nx] === 0) {
        grid[y + dy / 2][x + dx / 2] = 1;
        carve(nx, ny);
      }
    }
  }

  carve(1, 1);

  // Ensure start and end are clear
  grid[1][1] = 1;
  grid[MAZE_H - 2][MAZE_W - 2] = 1;

  return grid;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

interface PlayerPos {
  x: number;
  y: number;
  visited: Set<string>;
  moves: number;
}

const VISION = 3; // How far player can see

export class MazeEngine {
  private maze: Cell[][];
  private white: PlayerPos;
  private black: PlayerPos;
  private currentTurn: MazeColor = 'w';
  private status: MazeStatus = 'active';
  private totalMoves = 0;
  private goalX = MAZE_W - 2;
  private goalY = MAZE_H - 2;

  constructor() {
    const seed = Date.now() ^ 0xDEADBEEF;
    this.maze = generateMaze(seed);
    this.white = { x: 1, y: 1, visited: new Set(['1,1']), moves: 0 };
    this.black = { x: 1, y: 1, visited: new Set(['1,1']), moves: 0 };
  }

  reset(): void {
    const seed = Date.now() ^ 0xCAFEBABE;
    this.maze = generateMaze(seed);
    this.white = { x: 1, y: 1, visited: new Set(['1,1']), moves: 0 };
    this.black = { x: 1, y: 1, visited: new Set(['1,1']), moves: 0 };
    this.currentTurn = 'w';
    this.status = 'active';
    this.totalMoves = 0;
  }

  turn(): MazeColor { return this.currentTurn; }

  boardState(): string {
    // Encode maze compactly + player positions
    const mazeStr = this.maze.map((row) => row.join('')).join('/');
    return [
      `turn=${this.currentTurn}`,
      `moves=${this.totalMoves}`,
      `w_pos=${this.white.x},${this.white.y}`,
      `b_pos=${this.black.x},${this.black.y}`,
      `w_moves=${this.white.moves}`,
      `b_moves=${this.black.moves}`,
      `goal=${this.goalX},${this.goalY}`,
      `maze=${mazeStr}`,
    ].join('|');
  }

  boardForPrompt(side: MazeColor): string {
    const p = side === 'w' ? this.white : this.black;
    const opp = side === 'w' ? this.black : this.white;

    // Show limited vision around player
    const lines: string[] = [
      `=== MAZE RACE ===`,
      `Position: (${p.x}, ${p.y}) | Goal: (${this.goalX}, ${this.goalY}) | Steps: ${p.moves} | Opponent steps: ${opp.moves}`,
      `Manhattan distance to goal: ${Math.abs(this.goalX - p.x) + Math.abs(this.goalY - p.y)}`,
      '',
      'Your visible area (@ = you, G = goal, # = wall, . = path, * = visited):',
    ];

    for (let dy = -VISION; dy <= VISION; dy++) {
      const row: string[] = [];
      for (let dx = -VISION; dx <= VISION; dx++) {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (nx < 0 || nx >= MAZE_W || ny < 0 || ny >= MAZE_H) {
          row.push('#');
        } else if (dx === 0 && dy === 0) {
          row.push('@');
        } else if (nx === this.goalX && ny === this.goalY) {
          row.push('G');
        } else if (this.maze[ny][nx] === 0) {
          row.push('#');
        } else if (p.visited.has(`${nx},${ny}`)) {
          row.push('*');
        } else {
          row.push('.');
        }
      }
      lines.push('  ' + row.join(' '));
    }

    lines.push('');
    lines.push('Directions you can move:');
    const available: string[] = [];
    if (p.y > 0 && this.maze[p.y - 1][p.x] === 1) available.push('NORTH');
    if (p.y < MAZE_H - 1 && this.maze[p.y + 1][p.x] === 1) available.push('SOUTH');
    if (p.x > 0 && this.maze[p.y][p.x - 1] === 1) available.push('WEST');
    if (p.x < MAZE_W - 1 && this.maze[p.y][p.x + 1] === 1) available.push('EAST');
    lines.push(`  ${available.join(', ')}`);

    return lines.join('\n');
  }

  legalMoves(): string[] {
    const p = this.currentTurn === 'w' ? this.white : this.black;
    const moves: string[] = [];
    if (p.y > 0 && this.maze[p.y - 1][p.x] === 1) moves.push('NORTH');
    if (p.y < MAZE_H - 1 && this.maze[p.y + 1][p.x] === 1) moves.push('SOUTH');
    if (p.x > 0 && this.maze[p.y][p.x - 1] === 1) moves.push('WEST');
    if (p.x < MAZE_W - 1 && this.maze[p.y][p.x + 1] === 1) moves.push('EAST');
    return moves;
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    if (this.status !== 'active') return null;
    const dir = notation.trim().toUpperCase();
    const p = this.currentTurn === 'w' ? this.white : this.black;

    let dx = 0, dy = 0;
    switch (dir) {
      case 'N': case 'NORTH': dy = -1; break;
      case 'S': case 'SOUTH': dy = 1; break;
      case 'W': case 'WEST': dx = -1; break;
      case 'E': case 'EAST': dx = 1; break;
      default: return null;
    }

    const nx = p.x + dx;
    const ny = p.y + dy;
    if (nx < 0 || nx >= MAZE_W || ny < 0 || ny >= MAZE_H || this.maze[ny][nx] === 0) {
      return null;
    }

    p.x = nx;
    p.y = ny;
    p.visited.add(`${nx},${ny}`);
    p.moves++;
    this.totalMoves++;

    // Check win
    if (nx === this.goalX && ny === this.goalY) {
      this.status = this.currentTurn === 'w' ? 'white_wins' : 'black_wins';
    } else if (this.totalMoves >= MAX_TURNS * 2) {
      // Closer to goal wins
      const wDist = Math.abs(this.goalX - this.white.x) + Math.abs(this.goalY - this.white.y);
      const bDist = Math.abs(this.goalX - this.black.x) + Math.abs(this.goalY - this.black.y);
      if (wDist < bDist) this.status = 'white_wins';
      else if (bDist < wDist) this.status = 'black_wins';
      else this.status = 'draw';
    }

    if (this.status === 'active') this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';

    const label = this.currentTurn === 'w' ? 'Runner 2' : 'Runner 1';
    return { san: `${label}: ${dir} → (${nx},${ny})` };
  }

  isGameOver(): boolean { return this.status !== 'active'; }
  gameStatus(): MazeStatus { return this.status; }
}
