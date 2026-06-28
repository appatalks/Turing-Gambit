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
import { ConnectFourEngine } from './games/connectfour/engine.js';
import { buildConnectFourPrompt, buildConnectFourRetryPrompt, parseConnectFourMove } from './games/connectfour/prompt.js';
import { DotsAndBoxesEngine } from './games/dotsandboxes/engine.js';
import { buildDotsAndBoxesPrompt, buildDotsAndBoxesRetryPrompt, parseDotsAndBoxesMove } from './games/dotsandboxes/prompt.js';
import { BattleshipEngine } from './games/battleship/engine.js';
import { buildBattleshipPrompt, buildBattleshipRetryPrompt, parseBattleshipMove } from './games/battleship/prompt.js';
import { PrisonersDilemmaEngine } from './games/prisonersdilemma/engine.js';
import { buildPDPrompt, buildPDRetryPrompt, parsePDMove } from './games/prisonersdilemma/prompt.js';
import { DebateEngine } from './games/debate/engine.js';
import { buildDebatePrompt, parseDebateMove } from './games/debate/prompt.js';
import { RiskEngine } from './games/risk/engine.js';
import { buildRiskPrompt, buildRiskRetryPrompt, parseRiskMove, fuzzyRiskMatch } from './games/risk/prompt.js';
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
  private c4Engine: ConnectFourEngine | null = null;
  private dabEngine: DotsAndBoxesEngine | null = null;
  private bsEngine: BattleshipEngine | null = null;
  private pdEngine: PrisonersDilemmaEngine | null = null;
  private debateEngine: DebateEngine | null = null;
  private riskEngine: RiskEngine | null = null;
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
  private get isC4(): boolean { return this.config.game === 'connectfour'; }
  private get isDAB(): boolean { return this.config.game === 'dotsandboxes'; }
  private get isBS(): boolean { return this.config.game === 'battleship'; }
  private get isPD(): boolean { return this.config.game === 'prisonersdilemma'; }
  private get isDebate(): boolean { return this.config.game === 'debate'; }
  private get isRisk(): boolean { return this.config.game === 'risk'; }

  constructor(config: MatchConfig, socket: Socket) {
    this.id = uuid();
    this.config = config;
    switch (config.game) {
      case 'checkers': this.checkersEngine = new CheckersEngine(); break;
      case 'wargames': this.wargamesEngine = new WargamesEngine(); break;
      case 'tictactoe': this.tttEngine = new TicTacToeEngine(); break;
      case 'connectfour': this.c4Engine = new ConnectFourEngine(); break;
      case 'dotsandboxes': this.dabEngine = new DotsAndBoxesEngine(); break;
      case 'battleship': this.bsEngine = new BattleshipEngine(); break;
      case 'prisonersdilemma': this.pdEngine = new PrisonersDilemmaEngine(); break;
      case 'debate': this.debateEngine = new DebateEngine(config.debateTopic); break;
      case 'risk': this.riskEngine = new RiskEngine(); break;
      default: this.chessEngine = new ChessEngine(); break;
    }
    this.socket = socket;
    // Apply the match-level token budget to any provider that doesn't set its own.
    const withTokens = (p: typeof config.white) =>
      p.maxTokens == null && config.maxTokens != null ? { ...p, maxTokens: config.maxTokens } : p;
    if (config.white.type !== 'human') {
      this.whiteProvider = createProvider(withTokens(config.white));
    }
    if (config.black.type !== 'human') {
      this.blackProvider = createProvider(withTokens(config.black));
    }
  }

  // ── Game-agnostic engine helpers ───────────────────

  private getTurn(): 'w' | 'b' {
    if (this.isCheckers) return this.checkersEngine!.turn();
    if (this.isWargames) return this.wargamesEngine!.turn();
    if (this.isTTT) return this.tttEngine!.turn();
    if (this.isC4) return this.c4Engine!.turn();
    if (this.isDAB) return this.dabEngine!.turn();
    if (this.isBS) return this.bsEngine!.turn();
    if (this.isPD) return this.pdEngine!.turn();
    if (this.isDebate) return this.debateEngine!.turn();
    if (this.isRisk) return this.riskEngine!.turn();
    return this.chessEngine!.turn();
  }

  private getFen(): string {
    if (this.isCheckers) return this.checkersEngine!.boardState();
    if (this.isWargames) return this.wargamesEngine!.boardState();
    if (this.isTTT) return this.tttEngine!.boardState();
    if (this.isC4) return this.c4Engine!.boardState();
    if (this.isDAB) return this.dabEngine!.boardState();
    if (this.isBS) return this.bsEngine!.boardState();
    if (this.isPD) return this.pdEngine!.boardState();
    if (this.isDebate) return this.debateEngine!.boardState();
    if (this.isRisk) return this.riskEngine!.boardState();
    return this.chessEngine!.fen();
  }

  private getPgn(): string {
    if (this.isCheckers) return this.moveHistory.map((m) => m.san).join(', ');
    if (this.isWargames) return this.moveHistory.map((m) => m.san).join('\n');
    if (this.isTTT) return this.moveHistory.map((m) => m.san).join(', ');
    if (this.isDebate) return this.moveHistory.map((m) => m.san).join('\n');
    if (this.isC4 || this.isDAB || this.isBS || this.isPD) return this.moveHistory.map((m) => m.san).join(', ');
    if (this.isRisk) return this.moveHistory.map((m) => m.san).join('\n');
    return this.chessEngine!.pgn();
  }

  private getLegalMoves(): string[] {
    if (this.isCheckers) return this.checkersEngine!.legalMovesNotation();
    if (this.isWargames) return this.wargamesEngine!.legalMoves();
    if (this.isTTT) return this.tttEngine!.legalMoves();
    if (this.isC4) return this.c4Engine!.legalMoves();
    if (this.isDAB) return this.dabEngine!.legalMoves();
    if (this.isBS) return this.bsEngine!.legalMoves();
    if (this.isPD) return this.pdEngine!.legalMoves();
    if (this.isDebate) return this.debateEngine!.legalMoves();
    if (this.isRisk) return this.riskEngine!.legalMoves();
    return this.chessEngine!.legalMovesUci();
  }

  private isOver(): boolean {
    if (this.isCheckers) return this.checkersEngine!.isGameOver();
    if (this.isWargames) return this.wargamesEngine!.isGameOver();
    if (this.isTTT) return this.tttEngine!.isGameOver();
    if (this.isC4) return this.c4Engine!.isGameOver();
    if (this.isDAB) return this.dabEngine!.isGameOver();
    if (this.isBS) return this.bsEngine!.isGameOver();
    if (this.isPD) return this.pdEngine!.isGameOver();
    if (this.isDebate) return this.debateEngine!.isGameOver();
    if (this.isRisk) return this.riskEngine!.isGameOver();
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
    if (this.isC4) {
      return buildConnectFourPrompt(turn === 'w' ? 'Red' : 'Yellow', this.c4Engine!.boardForPrompt(), legalMoves);
    }
    if (this.isDAB) {
      return buildDotsAndBoxesPrompt(turn === 'w' ? 'W' : 'B', this.dabEngine!.boardForPrompt(), legalMoves);
    }
    if (this.isBS) {
      return buildBattleshipPrompt(turn === 'w' ? 'A' : 'B', this.bsEngine!.boardForPrompt(), legalMoves);
    }
    if (this.isPD) {
      return buildPDPrompt(this.pdEngine!.boardForPrompt());
    }
    if (this.isDebate) {
      return buildDebatePrompt(this.debateEngine!.boardForPrompt());
    }
    if (this.isRisk) {
      return buildRiskPrompt(this.riskEngine!.boardForPrompt(), legalMoves);
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
    if (this.isC4) return buildConnectFourRetryPrompt(invalidMove, legalMoves);
    if (this.isDAB) return buildDotsAndBoxesRetryPrompt(invalidMove, legalMoves);
    if (this.isBS) return buildBattleshipRetryPrompt(invalidMove, legalMoves);
    if (this.isPD) return buildPDRetryPrompt();
    if (this.isDebate) return buildDebatePrompt(this.debateEngine!.boardForPrompt());
    if (this.isRisk) return buildRiskRetryPrompt(invalidMove, legalMoves);
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
    if (this.isC4) {
      const p = parseConnectFourMove(raw);
      return p && legalMoves.includes(p) ? p : null;
    }
    if (this.isDAB) {
      const p = parseDotsAndBoxesMove(raw);
      return p && legalMoves.includes(p) ? p : null;
    }
    if (this.isBS) {
      const p = parseBattleshipMove(raw);
      return p && legalMoves.includes(p) ? p : null;
    }
    if (this.isPD) {
      const p = parsePDMove(raw);
      return p && legalMoves.includes(p) ? p : null;
    }
    if (this.isDebate) {
      // Free text — any non-empty response is valid.
      return parseDebateMove(raw);
    }
    if (this.isRisk) {
      const p = parseRiskMove(raw);
      if (p && legalMoves.includes(p)) return p;
      // Lenient fallback for models that don't follow the exact grammar.
      return fuzzyRiskMatch(raw, legalMoves);
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
    if (this.isC4) {
      const r = this.c4Engine!.makeMove(move);
      if (!r) return null;
      return { san: r.san, captured: r.captured, from: move, to: move };
    }
    if (this.isDAB) {
      const r = this.dabEngine!.makeMove(move);
      if (!r) return null;
      return { san: r.san, captured: r.captured, from: move, to: move };
    }
    if (this.isBS) {
      const r = this.bsEngine!.makeMove(move);
      if (!r) return null;
      return { san: r.san, captured: r.captured, from: move, to: move };
    }
    if (this.isPD) {
      const r = this.pdEngine!.makeMove(move);
      if (!r) return null;
      return { san: r.san, captured: r.captured, from: move, to: move };
    }
    if (this.isDebate) {
      const r = this.debateEngine!.makeMove(move);
      if (!r) return null;
      return { san: r.san, captured: r.captured, from: 'arg', to: 'arg' };
    }
    if (this.isRisk) {
      const r = this.riskEngine!.makeMove(move);
      if (!r) return null;
      const parts = move.split(/\s+/);
      const from = parts[1] || move;
      const to = parts[2] || from;
      return { san: r.san, captured: r.captured, from, to };
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
    } else if (this.isC4) {
      const s = this.c4Engine!.gameStatus();
      if (s === 'red_wins') this.endGame('white', 'red_wins', 'Red connects four!');
      else if (s === 'yellow_wins') this.endGame('black', 'yellow_wins', 'Yellow connects four!');
      else this.endGame('draw', 'draw', 'Draw — board full');
    } else if (this.isDAB) {
      const s = this.dabEngine!.gameStatus();
      if (s === 'white_wins') this.endGame('white', 'white_wins', 'White wins the boxes');
      else if (s === 'black_wins') this.endGame('black', 'black_wins', 'Black wins the boxes');
      else this.endGame('draw', 'draw', 'Draw — boxes split');
    } else if (this.isBS) {
      const s = this.bsEngine!.gameStatus();
      if (s === 'white_wins') this.endGame('white', 'white_wins', 'Side A sank the fleet');
      else this.endGame('black', 'black_wins', 'Side B sank the fleet');
    } else if (this.isPD) {
      const s = this.pdEngine!.gameStatus();
      if (s === 'white_wins') this.endGame('white', 'white_wins', 'White scored higher');
      else if (s === 'black_wins') this.endGame('black', 'black_wins', 'Black scored higher');
      else this.endGame('draw', 'draw', 'Draw — equal payoff');
    } else if (this.isDebate) {
      const s = this.debateEngine!.gameStatus();
      const v = this.debateEngine!.getVerdict();
      const reason = v ? v.reasoning : 'Judged';
      if (s === 'white_wins') this.endGame('white', 'white_wins', `PRO wins. ${reason}`);
      else if (s === 'black_wins') this.endGame('black', 'black_wins', `CON wins. ${reason}`);
      else this.endGame('draw', 'draw', `Draw. ${reason}`);
    } else if (this.isRisk) {
      const s = this.riskEngine!.gameStatus();
      if (s === 'white_wins') this.endGame('white', 'white_wins', 'Blue conquered the world');
      else this.endGame('black', 'black_wins', 'Red conquered the world');
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
      // Debate judging: once both sides have made all arguments, run the judge.
      if (this.isDebate && this.debateEngine!.argumentsComplete() && !this.debateEngine!.isJudged()) {
        await this.runDebateJudge();
        this.checkGameOver(this.getTurn());
        return;
      }

      // Risk has many micro-actions per turn, so allow a larger budget.
      const moveBudget = this.config.maxMoves * (this.isRisk ? 12 : 2);
      if (this.moveHistory.length >= moveBudget) {
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

  private async runDebateJudge(): Promise<void> {
    const engine = this.debateEngine!;
    const judgePrompt = engine.buildJudgePrompt();
    // Use whichever side is backed by an AI provider as the impartial judge.
    const provider = this.whiteProvider ?? this.blackProvider;

    this.thinking = true;
    this.thinkingPlayer = null;
    this.socket.emit('thinking-chunk', { color: 'w', text: '\n\n⚖️ Judge is deliberating...\n' });
    this.emitState();

    if (!provider) {
      // No AI available to judge (both human) — default to draw.
      engine.applyVerdict('VERDICT: DRAW');
      this.thinking = false;
      return;
    }

    try {
      let streamed = false;
      const onChunk = (text: string) => {
        streamed = true;
        this.socket.emit('thinking-chunk', { color: 'w', text });
      };
      const result = await provider.getMove({ prompt: judgePrompt, onChunk });
      if (!streamed && result.rawResponse) {
        this.socket.emit('thinking-chunk', { color: 'w', text: result.rawResponse });
      }
      engine.applyVerdict(result.rawResponse || 'VERDICT: DRAW');
    } catch (err: any) {
      console.log(`[Arena] Debate judge error: ${err.message}`);
      engine.applyVerdict('VERDICT: DRAW');
    }

    this.thinking = false;
    this.thinkingPlayer = null;
  }

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
