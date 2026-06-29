export function buildPokerPrompt(board: string, legalMoves: string[]): string {
  return `You are playing Texas Hold'em Poker.

${board}

Available actions: ${legalMoves.join(', ')}

Strategy tips:
- FOLD: Surrender this hand (lose your bets)
- CALL: Match the opponent's bet
- CHECK: Pass without betting (only if no bet to you)
- BET/RAISE: Increase the stakes

Reply with:
MOVE: <action>`;
}

export function buildPokerRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  return `"${invalidMove}" is not valid. Available actions: ${legalMoves.join(', ')}

Reply with: MOVE: <action>`;
}

export function parsePokerMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  // MOVE: ACTION
  const explicit = text.match(/MOVE\s*:\s*(\w+)/i);
  if (explicit) return explicit[1].toUpperCase();

  // Standalone action word
  const actions = ['FOLD', 'CALL', 'CHECK', 'BET', 'RAISE'];
  for (const action of actions) {
    if (new RegExp(`\\b${action}\\b`, 'i').test(text)) return action;
  }

  return null;
}
