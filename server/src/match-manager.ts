import { v4 as uuid } from 'uuid';
import type { Socket } from 'socket.io';
import {
  MatchConfig,
  MatchState,
  MatchStatus,
  MatchMetrics,
  MoveRecord,
  GameStatus,
  CapturedPieces,
} from './types.js';
import type { AIProvider } from './types.js';
import { ChessEngine, computeCapturedPieces } from './games/chess/engine.js';
import {
  buildChessPrompt,
  buildRetryPrompt,
  parseMoveFromResponse,
  extractMoveCandidates,
} from './games/chess/prompt.js';
import { CheckersEngine } from './games/checkers/engine.js';
import {
  buildCheckersPrompt,
  buildCheckersRetryPrompt,
  parseCheckersMoveFromResponse,
} from './games/checkers/prompt.js';
import { WargamesEngine } from './games/wargames/engine.js';
import {
  buildWargamesPrompt,
  buildWargamesRetryPrompt,
  parseWargamesMoveFromResponse,
} from './games/wargames/prompt.js';
import { TicTacToeEngine } from './games/tictactoe/engine.js';
import {
  buildTTTPrompt,
  buildTTTRetryPrompt,
  parseTTTMoveFromResponse,
} from './games/tictactoe/prompt.js';
import { createProvider } from './providers/registry.js';

export class MatchManager {
  private matches = new Map<string, Match>();

  startMatch(socket: Socket, config: MatchConfig): void {
    // Stop any existing match for this socket
    this.stopMatchForSocket(socket.id);

    const match = new Match(config, socket);
    this.matches.set(socket.id, match);
    match.start();
  }

  pauseMatch(socketId: string): void {
    this.matches.get(socketId)?.pause();
  }

  resumeMatch(socketId: string): void {
    this.matches.get(socketId)?.resume();
  }

  stepMatch(socketId: string): void {
    this.matches.get(socketId)?.step();
  }

  submitHumanMove(socketId: string, uci: string): void {
    this.matches.get(socketId)?.submitHumanMove(uci);
  }

  resetMatch(socketId: string): void {
    this.stopMatchForSocket(socketId);
  }

  stopMatchForSocket(socketId: string): void {
    const match = this.matches.get(socketId);
    if (match) {
      match.stop();
      this.matches.delete(socketId);
    }
  }

  exportMatch(socketId: string): { pgn: string; json: object } | null {
    const match = this.matches.get(socketId);
    if (!match) return null;
    return match.export();
  }
}

class Match {
  readonly id: string;
  private config: MatchConfig;
  private chessEngine: ChessEngine | null = null;
  private checkersEngine: CheckersEngine | null = null;
  private wargamesEngine: WargamesEngine | null = null;
  private tttEngine: TicTacToeEngine | null = null;
  private socket: Socket;
  private status: MatchStatus = 'active';
  private moveHistory: MoveRecord[] = [];
  private running = false;
  private paused = false;
  private gameStatus: GameStatus = 'active';
  private winner: 'white' | 'black' | 'draw' | null = null;
  private endReason: string | null = null;
  private thinking = false;
  private thinkingPlayer: 'w' | 'b' | null = null;
  private awaitingHuman = false;
  private humanMoveResolver: ((uci: string) => void) | null = null;
  private lastMove: { from: string; to: string } | undefined;
  private pauseResolver: (() => void) | null = null;
  private stepResolver: (() => void) | null = null;
  private stepMode = false;
  private whiteProvider: AIProvider | null = null;
  private blackProvider: AIProvider | null = null;

  private get isCheckers(): boolean { return this.config.game === 'checkers'; }
  private get isWargames(): boolean { return this.config.game === 'wargames'; }
  private get isTTT(): boolean { return this.config.game === 'tictactoe'; }

  constructor(config: MatchConfig, socket: Socket) {
    this.id = uuid();
    this.config = config;
    switch (config.game) {
      case 'checkers': this.checkersEngine = new CheckersEngine(); break;
      case 'wargames': this.wargamesEngine = new WargamesEngine(); break;
      case 'tictactoe': this.tttEngine = new TicTacToeEngine(); break;
      default: this.chessEngine = new ChessEngine(); break;
    }
    this.socket = socket;
    if (config.white.type !== 'human') {
      this.whiteProvider = createProvider(config.white);
    }
    if (config.black.type !== 'human') {
      this.blackProvider = createProvider(config.black);
    }
  }

  // ── Game-agnostic engine helpers ───────────────────

  private getTurn(): 'w' | 'b' {
    if (this.isCheckers) return this.checkersEngine!.turn();
    if (this.isWargames) return this.wargamesEngine!.turn();
    if (this.isTTT) return this.tttEngine!.turn();
    return this.chessEngine!.turn();
  }

  private getFen(): string {
    if (this.isCheckers) return this.checkersEngine!.boardState();
    if (this.isWargames) return this.wargamesEngine!.boardState();
    if (this.isTTT) return this.tttEngine!.boardState();
    return this.chessEngine!.fen();
  }

  private getPgn(): string {
    if (this.isCheckers) return this.moveHistory.map((m) => m.san).join(', ');
    if (this.isWargames) return this.moveHistory.map((m) => m.san).join('\n');
    if (this.isTTT) return this.moveHistory.map((m) => m.san).join(', ');
    return this.chessEngine!.pgn();
  }

  private getLegalMoves(): string[] {
    if (this.isCheckers) return this.checkersEngine!.legalMovesNotation();
    if (this.isWargames) return this.wargamesEngine!.legalMoves();
    if (this.isTTT) return this.tttEngine!.legalMoves();
    return this.chessEngine!.legalMovesUci();
  }

  private isOver(): boolean {
    if (this.isCheckers) return this.checkersEngine!.isGameOver();
    if (this.isWargames) return this.wargamesEngine!.isGameOver();
    if (this.isTTT) return this.tttEngine!.isGameOver();
    return this.chessEngine!.isGameOver();
  }

  private buildPrompt(turn: 'w' | 'b', legalMoves: string[]): string {
    if (this.isCheckers) {
      return buildCheckersPrompt({
        color: turn === 'w' ? 'White' : 'Black',
        board: this.checkersEngine!.boardForPrompt(),
        legalMoves,
        moveHistory: this.moveHistory,
      });
    }
    if (this.isWargames) {
      return buildWargamesPrompt({
        color: turn === 'w' ? 'Side A' : 'Side B',
        board: this.wargamesEngine!.boardForPrompt(),
        legalMoves,
        moveHistory: this.moveHistory,
      });
    }
    if (this.isTTT) {
      return buildTTTPrompt(
        turn === 'w' ? 'X' : 'O',
        this.tttEngine!.boardForPrompt(),
        legalMoves,
      );
    }
    return buildChessPrompt({
      color: turn === 'w' ? 'White' : 'Black',
      fen: this.chessEngine!.fen(),
      legalMoves,
      moveHistory: this.moveHistory,
      gameStatus: this.chessEngine!.gameStatus(),
    });
  }

  private buildRetry(invalidMove: string, legalMoves: string[]): string {
    if (this.isCheckers) return buildCheckersRetryPrompt(invalidMove, legalMoves);
    if (this.isWargames) return buildWargamesRetryPrompt(invalidMove, legalMoves);
    if (this.isTTT) return buildTTTRetryPrompt(invalidMove, legalMoves);
    return buildRetryPrompt({ invalidMove, legalMoves, fen: this.chessEngine!.fen() });
  }

  private parseResponse(raw: string, legalMoves: string[]): string | null {
    if (this.isCheckers) {
      const p = parseCheckersMoveFromResponse(raw);
      return p && legalMoves.includes(p) ? p : null;
    }
    if (this.isWargames) {
      const p = parseWargamesMoveFromResponse(raw);
      return p && legalMoves.includes(p) ? p : null;
    }
    if (this.isTTT) {
      const p = parseTTTMoveFromResponse(raw);
      return p && legalMoves.includes(p) ? p : null;
    }
    // Chess: UCI primary + SAN fallback
    const parsed = parseMoveFromResponse(raw);
    if (parsed && legalMoves.includes(parsed)) return parsed;
    const candidates = extractMoveCandidates(raw);
    for (const c of candidates) {
      if (legalMoves.includes(c)) return c;
      const fromSan = this.chessEngine!.trySanToUci(c);
      if (fromSan && legalMoves.includes(fromSan)) return fromSan;
    }
    return null;
  }

  private applyMove(move: string): { san: string; captured?: string; from: string; to: string } | null {
    if (this.isCheckers) {
      const r = this.checkersEngine!.makeMove(move);
      if (!r) return null;
      const parts = move.split('-');
      return { san: r.san, captured: r.captured, from: parts[0], to: parts[parts.length - 1] };
    }
    if (this.isWargames) {
      const r = this.wargamesEngine!.makeMove(move);
      if (!r) return null;
      return { san: r.san, captured: r.captured, from: move, to: move };
    }
    if (this.isTTT) {
      const r = this.tttEngine!.makeMove(move);
      if (!r) return null;
      return { san: r.san, captured: r.captured, from: move, to: move };
    }
    const r = this.chessEngine!.makeMove(move);
    if (!r) return null;
    return { san: r.san, captured: r.captured, from: r.from, to: r.to };
  }

  private checkGameOver(turn: 'w' | 'b'): void {
    if (!this.isOver()) return;

    if (this.isCheckers) {
      const s = this.checkersEngine!.gameStatus();
      if (s === 'black_wins') this.endGame('black', 'black_wins', 'Black wins');
      else if (s === 'white_wins') this.endGame('white', 'white_wins', 'White wins');
      else this.endGame('draw', 'draw', 'Draw');
    } else if (this.isWargames) {
      const s = this.wargamesEngine!.gameStatus();
      const reason = this.wargamesEngine!.endReason();
      if (s === 'white_wins') this.endGame('white', 'white_wins', reason);
      else if (s === 'black_wins') this.endGame('black', 'black_wins', reason);
      else this.endGame('draw', s === 'peace' ? 'peace' : 'draw', reason);
    } else if (this.isTTT) {
      const s = this.tttEngine!.gameStatus();
      if (s === 'x_wins') this.endGame('white', 'x_wins', 'X wins!');
      else if (s === 'o_wins') this.endGame('black', 'o_wins', 'O wins!');
      else this.endGame('draw', 'draw', 'Draw — nobody wins');
    } else {
      if (this.chessEngine!.gameStatus() === 'checkmate') {
        this.endGame(turn === 'w' ? 'white' : 'black', 'checkmate',
          `Checkmate — ${turn === 'w' ? 'White' : 'Black'} wins`);
      } else {
        const reason = this.chessEngine!.drawReason();
        this.endGame('draw', this.chessEngine!.gameStatus() as GameStatus, reason);
      }
    }
  }

  private getCapturedPieces(): CapturedPieces {
    return computeCapturedPieces(this.moveHistory);
  }

  async start(): Promise<void> {
    this.running = true;
    this.emitState();
    await this.gameLoop();
  }

  pause(): void {
    this.paused = true;
    this.status = 'paused';
    this.emitState();
  }

  resume(): void {
    this.paused = false;
    this.stepMode = false;
    this.status = 'active';
    this.pauseResolver?.();
    this.pauseResolver = null;
    this.emitState();
  }

  step(): void {
    if (this.status === 'completed') return;

    if (!this.paused) {
      this.paused = true;
      this.stepMode = true;
      this.status = 'paused';
    }

    // If we're waiting for a step signal, resolve it
    if (this.stepResolver) {
      this.stepResolver();
      this.stepResolver = null;
    } else if (this.pauseResolver) {
      // If game is paused and waiting, do one step then re-pause
      this.stepMode = true;
      this.pauseResolver();
      this.pauseResolver = null;
    }
  }

  stop(): void {
    this.running = false;
    this.pauseResolver?.();
    this.stepResolver?.();
    this.humanMoveResolver?.('');
    this.disposeProviders();
  }

  private disposeProviders(): void {
    this.whiteProvider?.dispose?.();
    this.blackProvider?.dispose?.();
    this.whiteProvider = null;
    this.blackProvider = null;
  }

  submitHumanMove(uci: string): void {
    if (!this.awaitingHuman || !this.humanMoveResolver) return;
    if (!this.getLegalMoves().includes(uci)) return;
    const resolve = this.humanMoveResolver;
    this.humanMoveResolver = null;
    resolve(uci);
  }

  export(): { pgn: string; json: object } {
    return {
      pgn: this.getPgn(),
      json: this.buildState(),
    };
  }

  // ── Game Loop ──────────────────────────────────────────

  private async gameLoop(): Promise<void> {
    while (this.running && !this.isOver()) {
      if (this.moveHistory.length >= this.config.maxMoves * 2) {
        this.endGame('draw', 'max_moves_reached', 'Maximum moves reached');
        return;
      }

      if (this.paused && !this.stepMode) {
        await this.waitForResume();
        if (!this.running) return;
      }
      if (this.stepMode) {
        this.stepMode = false;
      }

      const turn = this.getTurn();
      const providerConfig = turn === 'w' ? this.config.white : this.config.black;
      const legalMoves = this.getLegalMoves();

      let moveStr: string | null = null;
      let rawResponse = '';
      let tokensUsed: number | undefined;
      let latencyMs = 0;
      let retryCount = 0;
      const invalidAttempts: string[] = [];
      let currentPrompt = '';

      if (providerConfig.type === 'human') {
        this.awaitingHuman = true;
        this.thinking = false;
        this.thinkingPlayer = null;
        this.emitState();

        const waitStart = Date.now();
        const submitted = await this.waitForHumanMove();
        this.awaitingHuman = false;
        if (!this.running || !submitted) return;

        moveStr = submitted;
        latencyMs = Date.now() - waitStart;
        rawResponse = 'Human move';
      } else {
        // ── AI turn ──
        const provider = (turn === 'w' ? this.whiteProvider : this.blackProvider)!;
        const prompt = this.buildPrompt(turn, legalMoves);

        this.thinking = true;
        this.thinkingPlayer = turn;
        this.emitState();

        currentPrompt = prompt;
        const overallStart = Date.now();

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
          try {
            let streamed = false;
            const onChunk = (text: string) => {
              streamed = true;
              this.socket.emit('thinking-chunk', { color: turn, text });
            };

            const result = await provider.getMove({ prompt: currentPrompt, onChunk });
            rawResponse = result.rawResponse;

            if (!streamed && rawResponse) {
              this.socket.emit('thinking-chunk', { color: turn, text: rawResponse });
            }

            tokensUsed = (tokensUsed ?? 0) + (result.tokensUsed ?? 0);
            latencyMs = Date.now() - overallStart;

            // Parse using game-appropriate parser
            moveStr = this.parseResponse(rawResponse, legalMoves);
            if (moveStr) break;

            // Invalid move
            const attemptStr = rawResponse.substring(0, 120);
            console.log(`[Arena] Invalid move attempt (${turn === 'w' ? 'White' : 'Black'}): "${attemptStr}"`);
            invalidAttempts.push(attemptStr);
            retryCount++;

            currentPrompt = this.buildRetry(attemptStr, legalMoves);
          } catch (err: any) {
            invalidAttempts.push(`Error: ${err.message}`);
            retryCount++;
            if (attempt === this.config.maxRetries) break;
            await this.delay(1000);
            currentPrompt = this.buildRetry(`Error: ${err.message}`, legalMoves);
          }
        }
      }

      if (!moveStr || !this.running) {
        if (this.running) {
          const side = turn === 'w' ? 'White' : 'Black';
          this.endGame(
            turn === 'w' ? 'black' : 'white',
            'invalid_move_failure',
            `${side} (${providerConfig.model}) forfeited — exceeded ${this.config.maxRetries} invalid move retries`,
          );
        }
        return;
      }

      // Apply move
      const result = this.applyMove(moveStr);
      if (!result) {
        this.endGame(
          turn === 'w' ? 'black' : 'white',
          'invalid_move_failure',
          'Internal validation error',
        );
        return;
      }

      const record: MoveRecord = {
        moveNumber: Math.floor(this.moveHistory.length / 2) + 1,
        color: turn,
        san: result.san,
        uci: moveStr,
        fen: this.getFen(),
        latencyMs,
        tokensUsed,
        retryCount,
        invalidAttempts,
        rawResponse,
        prompt: currentPrompt,
        captured: result.captured,
      };
      this.moveHistory.push(record);

      if (result.captured) {
        console.log(`[Arena] ${turn === 'w' ? 'White' : 'Black'} captured with ${result.san}`);
      }

      this.lastMove = { from: result.from, to: result.to };
      this.thinking = false;
      this.thinkingPlayer = null;

      // Check game over
      this.checkGameOver(turn);
      if (this.status === 'completed') return;

      this.gameStatus = 'active';
      this.emitState();

      // Delay between moves (auto mode)
      if (!this.stepMode && !this.paused) {
        // WarGames gets extra delay for trajectory animation
        const delay = this.isWargames
          ? Math.max(this.config.moveDelayMs, 2500)
          : this.config.moveDelayMs;
        await this.delay(delay);
      }

      // If paused (user clicked pause during or after the move), wait
      if (this.paused && !this.stepMode) {
        await this.waitForResume();
        if (!this.running) return;
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────

  private endGame(
    winner: 'white' | 'black' | 'draw',
    gameStatus: GameStatus,
    reason: string,
  ): void {
    this.status = 'completed';
    this.running = false;
    this.winner = winner;
    this.gameStatus = gameStatus;
    this.endReason = reason;
    this.thinking = false;
    this.thinkingPlayer = null;
    this.awaitingHuman = false;
    this.disposeProviders();
    this.emitState();
  }

  private computeMetrics(): MatchMetrics {
    const whiteMoves = this.moveHistory.filter((m) => m.color === 'w');
    const blackMoves = this.moveHistory.filter((m) => m.color === 'b');

    const avg = (moves: MoveRecord[]) =>
      moves.length > 0
        ? moves.reduce((sum, m) => sum + m.latencyMs, 0) / moves.length
        : 0;

    return {
      totalMoves: this.moveHistory.length,
      whiteAvgLatency: Math.round(avg(whiteMoves)),
      blackAvgLatency: Math.round(avg(blackMoves)),
      whiteInvalidMoves: whiteMoves.reduce((s, m) => s + m.invalidAttempts.length, 0),
      blackInvalidMoves: blackMoves.reduce((s, m) => s + m.invalidAttempts.length, 0),
      whiteTotalTokens: whiteMoves.reduce((s, m) => s + (m.tokensUsed ?? 0), 0),
      blackTotalTokens: blackMoves.reduce((s, m) => s + (m.tokensUsed ?? 0), 0),
      whiteRetries: whiteMoves.reduce((s, m) => s + m.retryCount, 0),
      blackRetries: blackMoves.reduce((s, m) => s + m.retryCount, 0),
    };
  }

  private buildState(): MatchState {
    return {
      id: this.id,
      game: this.config.game || 'chess',
      status: this.status,
      fen: this.getFen(),
      turn: this.getTurn(),
      moveHistory: this.moveHistory,
      capturedPieces: this.getCapturedPieces(),
      gameStatus: this.gameStatus,
      white: this.config.white,
      black: this.config.black,
      metrics: this.computeMetrics(),
      thinking: this.thinking,
      thinkingPlayer: this.thinkingPlayer,
      awaitingHuman: this.awaitingHuman,
      legalMoves: this.awaitingHuman ? this.getLegalMoves() : undefined,
      pgn: this.getPgn(),
      lastMove: this.lastMove,
      winner: this.winner,
      endReason: this.endReason ?? undefined,
      config: this.config,
    };
  }

  private emitState(overrides?: Partial<MatchState>): void {
    const state = { ...this.buildState(), ...overrides };
    this.socket.emit('match-state', state);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private waitForResume(): Promise<void> {
    return new Promise((resolve) => {
      this.pauseResolver = resolve;
    });
  }

  private waitForHumanMove(): Promise<string> {
    return new Promise((resolve) => {
      this.humanMoveResolver = resolve;
    });
  }

  private waitForStep(): Promise<void> {
    return new Promise((resolve) => {
      this.stepResolver = resolve;
    });
  }
}
