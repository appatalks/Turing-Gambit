import { v4 as uuid } from 'uuid';
import type { Socket } from 'socket.io';
import {
  MatchConfig,
  MatchState,
  MatchStatus,
  MatchMetrics,
  MoveRecord,
  GameStatus,
} from './types.js';
import type { AIProvider } from './types.js';
import { ChessEngine, computeCapturedPieces } from './games/chess/engine.js';
import {
  buildChessPrompt,
  buildRetryPrompt,
  parseMoveFromResponse,
  extractMoveCandidates,
} from './games/chess/prompt.js';
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
  private engine: ChessEngine;
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

  constructor(config: MatchConfig, socket: Socket) {
    this.id = uuid();
    this.config = config;
    this.engine = new ChessEngine();
    this.socket = socket;
    // Create providers once per match (persistent sessions)
    if (config.white.type !== 'human') {
      this.whiteProvider = createProvider(config.white);
    }
    if (config.black.type !== 'human') {
      this.blackProvider = createProvider(config.black);
    }
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
    // Only accept if we're actually waiting and the move is legal
    if (!this.awaitingHuman || !this.humanMoveResolver) return;
    if (!this.engine.legalMovesUci().includes(uci)) return;
    const resolve = this.humanMoveResolver;
    this.humanMoveResolver = null;
    resolve(uci);
  }

  export(): { pgn: string; json: object } {
    return {
      pgn: this.engine.pgn(),
      json: this.buildState(),
    };
  }

  // ── Game Loop ──────────────────────────────────────────

  private async gameLoop(): Promise<void> {
    while (this.running && !this.engine.isGameOver()) {
      // Check max moves
      if (this.moveHistory.length >= this.config.maxMoves * 2) {
        this.endGame('draw', 'max_moves_reached', 'Maximum moves reached');
        return;
      }

      // Pause / step handling
      if (this.paused && !this.stepMode) {
        await this.waitForResume();
        if (!this.running) return;
      }
      if (this.stepMode) {
        this.stepMode = false; // consume the step
      }

      const turn = this.engine.turn();
      const providerConfig = turn === 'w' ? this.config.white : this.config.black;
      const legalMovesUci = this.engine.legalMovesUci();

      let moveUci: string | null = null;
      let rawResponse = '';
      let tokensUsed: number | undefined;
      let latencyMs = 0;
      let retryCount = 0;
      const invalidAttempts: string[] = [];
      let currentPrompt = '';

      if (providerConfig.type === 'human') {
        // ── Human turn: wait for a move from the client ──
        this.awaitingHuman = true;
        this.thinking = false;
        this.thinkingPlayer = null;
        this.emitState();

        const waitStart = Date.now();
        const submitted = await this.waitForHumanMove();
        this.awaitingHuman = false;

        if (!this.running || !submitted) return;

        moveUci = submitted;
        latencyMs = Date.now() - waitStart;
        rawResponse = 'Human move';
      } else {
        // ── AI turn ──
        const provider = (turn === 'w' ? this.whiteProvider : this.blackProvider)!;
        const prompt = buildChessPrompt({
          color: turn === 'w' ? 'White' : 'Black',
          fen: this.engine.fen(),
          legalMoves: legalMovesUci,
          moveHistory: this.moveHistory,
          gameStatus: this.engine.gameStatus(),
        });

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

            // For non-streaming providers, emit the full response as one chunk
            if (!streamed && rawResponse) {
              this.socket.emit('thinking-chunk', { color: turn, text: rawResponse });
            }

            tokensUsed = (tokensUsed ?? 0) + (result.tokensUsed ?? 0);
            latencyMs = Date.now() - overallStart;

            // 1. Try primary UCI parser
            const parsed = parseMoveFromResponse(rawResponse);
            if (parsed && legalMovesUci.includes(parsed)) {
              moveUci = parsed;
              break;
            }

            // 2. Fallback: extract all candidates (UCI + SAN) and match
            if (!moveUci) {
              const candidates = extractMoveCandidates(rawResponse);
              for (const c of candidates) {
                if (legalMovesUci.includes(c)) { moveUci = c; break; }
                const fromSan = this.engine.trySanToUci(c);
                if (fromSan && legalMovesUci.includes(fromSan)) { moveUci = fromSan; break; }
              }
            }

            if (moveUci) break;

            // Invalid move — log for debugging
            const attemptStr = parsed || rawResponse.substring(0, 120);
            console.log(`[Arena] Invalid move attempt (${turn === 'w' ? 'White' : 'Black'}): "${attemptStr}" | raw: "${rawResponse.substring(0, 200)}"`);
            invalidAttempts.push(attemptStr);
            retryCount++;

            currentPrompt = buildRetryPrompt({
              invalidMove: attemptStr,
              legalMoves: legalMovesUci,
              fen: this.engine.fen(),
            });
          } catch (err: any) {
            invalidAttempts.push(`Error: ${err.message}`);
            retryCount++;
            if (attempt === this.config.maxRetries) break;
            await this.delay(1000);
            currentPrompt = buildRetryPrompt({
              invalidMove: `Error: ${err.message}`,
              legalMoves: legalMovesUci,
              fen: this.engine.fen(),
            });
          }
        }
      }

      if (!moveUci || !this.running) {
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
      const result = this.engine.makeMove(moveUci);
      if (!result) {
        // Should never happen since we validated, but handle gracefully
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
        uci: moveUci,
        fen: this.engine.fen(),
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
        console.log(`[Arena] ${turn === 'w' ? 'White' : 'Black'} captured ${result.captured} with ${result.san}`);
      }

      this.lastMove = { from: result.from, to: result.to };
      this.thinking = false;
      this.thinkingPlayer = null;
      this.gameStatus = this.engine.gameStatus();

      // Check game over conditions
      if (this.engine.isGameOver()) {
        if (this.engine.gameStatus() === 'checkmate') {
          this.endGame(
            turn === 'w' ? 'white' : 'black',
            'checkmate',
            `Checkmate — ${turn === 'w' ? 'White' : 'Black'} wins`,
          );
        } else {
          const reason = this.engine.drawReason();
          const status = this.engine.gameStatus() as GameStatus;
          this.endGame('draw', status, reason);
        }
        return;
      }

      this.emitState();

      // Delay between moves (auto mode)
      if (!this.stepMode && !this.paused) {
        await this.delay(this.config.moveDelayMs);
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
      status: this.status,
      fen: this.engine.fen(),
      turn: this.engine.turn(),
      moveHistory: this.moveHistory,
      capturedPieces: computeCapturedPieces(this.moveHistory),
      gameStatus: this.gameStatus,
      white: this.config.white,
      black: this.config.black,
      metrics: this.computeMetrics(),
      thinking: this.thinking,
      thinkingPlayer: this.thinkingPlayer,
      awaitingHuman: this.awaitingHuman,
      pgn: this.engine.pgn(),
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
