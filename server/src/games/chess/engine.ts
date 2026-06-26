import { Chess, type Move } from 'chess.js';
import type { CapturedPieces, GameStatus, MoveRecord } from '../../types.js';

export class ChessEngine {
  private game: Chess;

  constructor(fen?: string) {
    this.game = fen ? new Chess(fen) : new Chess();
  }

  fen(): string {
    return this.game.fen();
  }

  turn(): 'w' | 'b' {
    return this.game.turn();
  }

  pgn(): string {
    return this.game.pgn();
  }

  isGameOver(): boolean {
    return this.game.isGameOver();
  }

  legalMovesVerbose(): Move[] {
    return this.game.moves({ verbose: true });
  }

  legalMovesUci(): string[] {
    return this.legalMovesVerbose().map(
      (m) => m.from + m.to + (m.promotion || ''),
    );
  }

  legalMovesSan(): string[] {
    return this.game.moves();
  }

  makeMove(uci: string): Move | null {
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    try {
      return this.game.move({ from, to, promotion });
    } catch {
      return null;
    }
  }

  gameStatus(): GameStatus {
    if (this.game.isCheckmate()) return 'checkmate';
    if (this.game.isStalemate()) return 'stalemate';
    if (this.game.isDraw()) return 'draw';
    if (this.game.isCheck()) return 'check';
    return 'active';
  }

  drawReason(): string {
    if (this.game.isStalemate()) return 'Stalemate';
    if (this.game.isThreefoldRepetition()) return 'Threefold repetition';
    if (this.game.isInsufficientMaterial()) return 'Insufficient material';
    return 'Draw (50-move rule)';
  }

  /** Try to interpret a SAN string (e.g. "Nf3", "e4", "O-O") and return its UCI equivalent */
  trySanToUci(san: string): string | null {
    try {
      const test = new Chess(this.game.fen());
      const result = test.move(san);
      if (result) return result.from + result.to + (result.promotion || '');
    } catch {}
    return null;
  }

  historyVerbose(): Move[] {
    return this.game.history({ verbose: true });
  }

  reset(): void {
    this.game.reset();
  }

  ascii(): string {
    return this.game.ascii();
  }
}

export function computeCapturedPieces(moveHistory: MoveRecord[]): CapturedPieces {
  const white: string[] = [];
  const black: string[] = [];

  for (const move of moveHistory) {
    if (move.captured) {
      if (move.color === 'w') {
        white.push(move.captured);
      } else {
        black.push(move.captured);
      }
    }
  }

  return { white, black };
}
