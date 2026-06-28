// ─── Battleship Engine ──────────────────────────────────
// 8×8 grids. Ships auto-placed randomly per side (hidden).
// Players alternate firing at coordinates A1-H8. Sink all to win.
// Each player only sees their own shot results (hit/miss).

export type BSColor = 'w' | 'b';
export type BSStatus = 'active' | 'white_wins' | 'black_wins';

const SIZE = 8;
const FLEET = [4, 3, 3, 2]; // ship lengths

type Cell = 'empty' | 'ship' | 'hit' | 'miss';

interface Grid {
  ships: number[][];  // ship cells (linear indices) per ship
  shots: Set<number>; // cells this side has been fired at
  hits: Set<number>;  // cells that were hits
}

export class BattleshipEngine {
  private gridA: Grid;  // white's grid (being fired at by black)
  private gridB: Grid;  // black's grid (being fired at by white)
  private currentTurn: BSColor = 'w';
  private moveCount = 0;

  constructor() {
    this.gridA = this.placeFleet();
    this.gridB = this.placeFleet();
  }

  reset(): void {
    this.gridA = this.placeFleet();
    this.gridB = this.placeFleet();
    this.currentTurn = 'w';
    this.moveCount = 0;
  }

  turn(): BSColor { return this.currentTurn; }

  private placeFleet(): Grid {
    const ships: number[][] = [];
    const occupied = new Set<number>();
    for (const len of FLEET) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 200) {
        attempts++;
        const horizontal = Math.random() < 0.5;
        const r = Math.floor(Math.random() * SIZE);
        const c = Math.floor(Math.random() * SIZE);
        const cells: number[] = [];
        let ok = true;
        for (let i = 0; i < len; i++) {
          const rr = horizontal ? r : r + i;
          const cc = horizontal ? c + i : c;
          if (rr >= SIZE || cc >= SIZE) { ok = false; break; }
          const idx = rr * SIZE + cc;
          if (occupied.has(idx)) { ok = false; break; }
          cells.push(idx);
        }
        if (ok) {
          cells.forEach((idx) => occupied.add(idx));
          ships.push(cells);
          placed = true;
        }
      }
    }
    return { ships, shots: new Set(), hits: new Set() };
  }

  private coordToIdx(coord: string): number | null {
    const m = coord.trim().toUpperCase().match(/^([A-H])([1-8])$/);
    if (!m) return null;
    const col = m[1].charCodeAt(0) - 65;
    const row = parseInt(m[2]) - 1;
    return row * SIZE + col;
  }

  private idxToCoord(idx: number): string {
    const row = Math.floor(idx / SIZE);
    const col = idx % SIZE;
    return String.fromCharCode(65 + col) + (row + 1);
  }

  boardState(): string {
    // Encode both shot grids for the viewer (hit/miss/unknown), plus ships for reveal
    const enc = (g: Grid, reveal: boolean) => {
      let s = '';
      for (let i = 0; i < SIZE * SIZE; i++) {
        const isShip = g.ships.some((sh) => sh.includes(i));
        if (g.hits.has(i)) s += 'X';        // hit
        else if (g.shots.has(i)) s += 'o';  // miss
        else if (reveal && isShip) s += 's'; // ship (revealed at end)
        else s += '.';
      }
      return s;
    };
    const over = this.isGameOver();
    return `${enc(this.gridA, over)} ${enc(this.gridB, over)} ${this.currentTurn}`;
  }

  boardForPrompt(): string {
    // Show the FIRING player's view of the enemy grid (their shot results only)
    const enemy = this.currentTurn === 'w' ? this.gridB : this.gridA;
    const lines: string[] = ['  A B C D E F G H'];
    for (let r = 0; r < SIZE; r++) {
      let line = (r + 1) + ' ';
      for (let c = 0; c < SIZE; c++) {
        const idx = r * SIZE + c;
        if (enemy.hits.has(idx)) line += 'X ';
        else if (enemy.shots.has(idx)) line += 'o ';
        else line += '. ';
      }
      lines.push(line.trim());
    }
    const remaining = enemy.ships.filter((sh) => !sh.every((i) => enemy.hits.has(i))).length;
    return lines.join('\n') + `\n\nEnemy ships remaining: ${remaining}/${FLEET.length}\nX=hit, o=miss, .=unfired`;
  }

  legalMoves(): string[] {
    const enemy = this.currentTurn === 'w' ? this.gridB : this.gridA;
    const moves: string[] = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (!enemy.shots.has(i)) moves.push(this.idxToCoord(i));
    }
    return moves;
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const idx = this.coordToIdx(notation);
    if (idx === null) return null;
    const enemy = this.currentTurn === 'w' ? this.gridB : this.gridA;
    if (enemy.shots.has(idx)) return null;

    enemy.shots.add(idx);
    const isShip = enemy.ships.some((sh) => sh.includes(idx));
    let san = `${notation.toUpperCase()}: `;
    let captured: string | undefined;

    if (isShip) {
      enemy.hits.add(idx);
      const sunkShip = enemy.ships.find((sh) => sh.includes(idx) && sh.every((i) => enemy.hits.has(i)));
      if (sunkShip) {
        san += `HIT — SHIP SUNK (${sunkShip.length})`;
        captured = 'ship';
      } else {
        san += 'HIT';
        captured = 'hit';
      }
    } else {
      san += 'miss';
    }

    this.moveCount++;
    this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';
    return { san, captured };
  }

  isGameOver(): boolean {
    return this.gameStatus() !== 'active';
  }

  gameStatus(): BSStatus {
    const allSunk = (g: Grid) => g.ships.every((sh) => sh.every((i) => g.hits.has(i)));
    if (allSunk(this.gridB)) return 'white_wins'; // white sank all black ships
    if (allSunk(this.gridA)) return 'black_wins';
    return 'active';
  }
}
