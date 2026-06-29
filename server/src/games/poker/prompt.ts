const POKER_ACTIONS = ['FOLD', 'CHECK', 'CALL', 'RAISE_SMALL', 'RAISE_BIG', 'ALL_IN'] as const;

function stripThinkTags(response: string): string {
  const stripped = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  return stripped || response.trim();
}

function normalizePokerAction(value: string): string | null {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, '_');

  if (normalized === 'ALLIN') return 'ALL_IN';
  if (normalized === 'RAISESMALL') return 'RAISE_SMALL';
  if (normalized === 'RAISEBIG') return 'RAISE_BIG';
  return POKER_ACTIONS.includes(normalized as typeof POKER_ACTIONS[number]) ? normalized : null;
}

export function buildPokerPrompt(board: string, legalMoves: string[], recentMoves?: { san: string }[]): { system?: string; prompt: string } {
  const system = 'You are playing Texas Hold\'em Poker. Think about pot odds, position, hand strength, and opponent tendencies. Never reveal or infer hidden cards.';

  const history = recentMoves && recentMoves.length > 0
    ? `\nRecent hand history (latest last):\n${recentMoves.slice(-15).map((m) => `  ${m.san}`).join('\n')}\n`
    : '';

  const prompt = `${board}
${history}
Legal actions: ${legalMoves.join(', ')}

Choose exactly one legal action.
Reply with: MOVE: <action>`;

  return { system, prompt };
}

export function buildPokerRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  const suggestion = legalMoves[0] ?? 'CHECK';
  return `"${invalidMove}" is invalid.

Legal actions: ${legalMoves.join(', ')}

Reply with exactly:
MOVE: ${suggestion}`;
}

export function parsePokerMove(response: string): string | null {
  const text = stripThinkTags(response);
  if (!text) return null;

  const explicit = text.match(/MOVE\s*:\s*([A-Z_\-\s]+)/i);
  if (explicit) {
    const action = normalizePokerAction(explicit[1]);
    if (action) return action;
  }

  for (const action of ['RAISE_SMALL', 'RAISE_BIG', 'ALL_IN', 'FOLD', 'CHECK', 'CALL'] as const) {
    const pattern = new RegExp(action.replace('_', '[-_\\s]*'), 'i');
    if (pattern.test(text)) return action;
  }

  return null;
}
