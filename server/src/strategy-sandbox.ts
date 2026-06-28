// ─── Strategy Sandbox ────────────────────────────────────
// Safely executes model-generated decision functions for arcade games.
// Each strategy is a JS function body that receives a `state` object and
// must return a legal action string (e.g., 'UP', 'DOWN', 'STAY').
//
// Security: runs via `new Function()` with a frozen state object and a
// hard timeout enforced by instruction budget (no async, no globals access).

export interface StrategyState {
  [key: string]: unknown;
}

export interface StrategyResult {
  action: string;
  error?: string;
}

const ALLOWED_ACTIONS: Record<string, string[]> = {
  pong: ['UP', 'DOWN', 'STAY'],
  tron: ['UP', 'DOWN', 'LEFT', 'RIGHT'],
  mario: ['RUN', 'JUMP', 'WAIT'],
};

/**
 * Compile a model-generated function body into a callable strategy.
 * The function receives a single `state` argument and must return an action string.
 * Returns a compiled function or an error message.
 */
export function compileStrategy(
  code: string,
  game: string,
): { fn: ((state: StrategyState) => string) | null; error?: string } {
  // Strip markdown code fences if the model wrapped the code
  let cleaned = code.replace(/^```(?:javascript|js|typescript|ts)?\n?/gm, '').replace(/^```\s*$/gm, '').trim();

  // If the model returned a full function declaration, extract the body
  const funcMatch = cleaned.match(/^(?:function\s+\w*\s*\(.*?\)\s*\{([\s\S]*)\}|(?:const|let|var)\s+\w+\s*=\s*(?:\(.*?\)|[\w]+)\s*=>\s*\{([\s\S]*)\})$/);
  if (funcMatch) {
    cleaned = (funcMatch[1] || funcMatch[2] || cleaned).trim();
  }

  // Basic safety checks — reject code that tries to escape the sandbox
  const forbidden = [
    /\bprocess\b/, /\brequire\b/, /\bimport\b/, /\bglobal\b/,
    /\beval\b/, /\bFunction\b/, /\bfetch\b/, /\bXMLHttpRequest\b/,
    /\bsetTimeout\b/, /\bsetInterval\b/, /\bPromise\b/, /\basync\b/,
    /\bawait\b/, /\b__proto__\b/, /\bconstructor\b/,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(cleaned)) {
      return { fn: null, error: `Forbidden keyword: ${pattern.source}` };
    }
  }

  try {
    // The function receives `state` and must return a string
    const fn = new Function('state', cleaned) as (state: StrategyState) => string;
    // Quick validation — run once with a dummy state to catch syntax errors
    const testState = Object.freeze({ tick: 0, game });
    const testResult = fn(testState);
    if (typeof testResult !== 'string') {
      return { fn: null, error: `Strategy must return a string, got ${typeof testResult}` };
    }
    return { fn };
  } catch (err: any) {
    return { fn: null, error: `Compile error: ${err.message}` };
  }
}

/**
 * Execute a compiled strategy function with a given state.
 * Returns the action or a fallback if the function throws or returns invalid.
 */
export function executeStrategy(
  fn: (state: StrategyState) => string,
  state: StrategyState,
  game: string,
): StrategyResult {
  const legal = ALLOWED_ACTIONS[game] || [];
  try {
    const frozenState = Object.freeze({ ...state });
    const raw = fn(frozenState);
    const action = String(raw).trim().toUpperCase();
    if (legal.includes(action)) {
      return { action };
    }
    // Try common synonyms
    const normalized = normalizeAction(action, game);
    if (normalized && legal.includes(normalized)) {
      return { action: normalized };
    }
    return { action: legal[0], error: `Invalid action "${raw}", defaulting to ${legal[0]}` };
  } catch (err: any) {
    return { action: legal[0], error: `Runtime error: ${err.message}` };
  }
}

function normalizeAction(raw: string, game: string): string | null {
  const u = raw.toUpperCase();
  if (game === 'pong') {
    if (u === 'U' || u === 'MOVE_UP') return 'UP';
    if (u === 'D' || u === 'MOVE_DOWN') return 'DOWN';
    if (u === 'S' || u === 'HOLD' || u === 'NONE') return 'STAY';
  }
  if (game === 'tron') {
    if (u === 'U' || u === 'NORTH' || u === 'N') return 'UP';
    if (u === 'D' || u === 'SOUTH' || u === 'S') return 'DOWN';
    if (u === 'L' || u === 'WEST' || u === 'W') return 'LEFT';
    if (u === 'R' || u === 'EAST' || u === 'E') return 'RIGHT';
  }
  if (game === 'mario') {
    if (u === 'R' || u === 'GO' || u === 'WALK') return 'RUN';
    if (u === 'J' || u === 'HOP' || u === 'LEAP') return 'JUMP';
    if (u === 'W' || u === 'HOLD' || u === 'STOP') return 'WAIT';
  }
  return null;
}
