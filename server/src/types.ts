// ─── Provider Types ─────────────────────────────────────

export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'lmstudio'
  | 'generic-openai'
  | 'copilot'
  | 'human';

export interface ProviderConfig {
  type: ProviderType;
  model: string;
  endpoint?: string;
  apiKeyEnvVar?: string;
  temperature?: number;
  maxTokens?: number;
}

// ─── Match Types ────────────────────────────────────────

export type GameType = 'chess' | 'checkers' | 'wargames' | 'tictactoe';

export interface MatchConfig {
  game: GameType;
  white: ProviderConfig;
  black: ProviderConfig;
  maxRetries: number;
  moveDelayMs: number;
  maxMoves: number;
}

export type GameStatus =
  | 'active'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'resigned'
  | 'invalid_move_failure'
  | 'max_moves_reached'
  | 'black_wins'
  | 'white_wins'
  | 'peace'
  | 'x_wins'
  | 'o_wins';

export type MatchStatus =
  | 'configuring'
  | 'active'
  | 'paused'
  | 'completed';

export interface MoveRecord {
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  fen: string;
  latencyMs: number;
  tokensUsed?: number;
  retryCount: number;
  invalidAttempts: string[];
  rawResponse: string;
  prompt: string;
  captured?: string;
}

export interface CapturedPieces {
  white: string[];
  black: string[];
}

export interface MatchMetrics {
  totalMoves: number;
  whiteAvgLatency: number;
  blackAvgLatency: number;
  whiteInvalidMoves: number;
  blackInvalidMoves: number;
  whiteTotalTokens: number;
  blackTotalTokens: number;
  whiteRetries: number;
  blackRetries: number;
}

export interface MatchState {
  id: string;
  game: GameType;
  status: MatchStatus;
  fen: string;
  turn: 'w' | 'b';
  moveHistory: MoveRecord[];
  capturedPieces: CapturedPieces;
  gameStatus: GameStatus;
  white: ProviderConfig;
  black: ProviderConfig;
  metrics: MatchMetrics;
  thinking: boolean;
  thinkingPlayer: 'w' | 'b' | null;
  awaitingHuman: boolean;
  legalMoves?: string[];
  pgn: string;
  lastMove?: { from: string; to: string };
  winner?: 'white' | 'black' | 'draw' | null;
  endReason?: string;
  config: MatchConfig;
}

// ─── Provider Interface ─────────────────────────────────

export interface MoveRequest {
  prompt: string;
  onChunk?: (accumulatedText: string) => void;
}

export interface MoveResponse {
  rawResponse: string;
  tokensUsed?: number;
  latencyMs: number;
}

export interface AIProvider {
  readonly name: string;
  getMove(request: MoveRequest): Promise<MoveResponse>;
  dispose?(): void;
}

// ─── Prompt Types ───────────────────────────────────────

export interface ChessPromptInput {
  color: 'White' | 'Black';
  fen: string;
  legalMoves: string[];
  moveHistory: MoveRecord[];
  gameStatus: string;
}

export interface RetryPromptInput {
  invalidMove: string;
  legalMoves: string[];
  fen: string;
}
