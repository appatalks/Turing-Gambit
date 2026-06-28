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

// ─── Provider metadata for UI ───────────────────────────

export const PROVIDER_OPTIONS: {
  value: ProviderType;
  label: string;
  description: string;
  keyEnvVar?: string;
  needsEndpoint?: boolean;
  isHuman?: boolean;
  defaultModel: string;
}[] = [
  {
    value: 'human',
    label: 'Human (You)',
    description: 'Play moves yourself on the board',
    isHuman: true,
    defaultModel: 'human',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'GPT-4o, GPT-4, o1, etc.',
    keyEnvVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
  },
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    description: 'Claude Sonnet, Opus, Haiku',
    keyEnvVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    value: 'ollama',
    label: 'Ollama (Local)',
    description: 'Llama, Mistral, Gemma, etc.',
    needsEndpoint: true,
    defaultModel: 'llama3.1',
  },
  {
    value: 'lmstudio',
    label: 'LM Studio (Local)',
    description: 'Any model loaded in LM Studio',
    needsEndpoint: true,
    defaultModel: 'local-model',
  },
  {
    value: 'generic-openai',
    label: 'OpenAI Compatible',
    description: 'Any OpenAI-compatible endpoint',
    needsEndpoint: true,
    defaultModel: 'model-name',
  },
  {
    value: 'copilot',
    label: 'GitHub Copilot',
    description: 'Copilot CLI — models auto-discovered',
    defaultModel: 'default',
  },
];
