export function buildMQPrompt(board: string, legalMoves: string[]): string {
  return `You are playing Mystic Quest — a dungeon adventure.

${board}

Available actions: ${legalMoves.join(', ')}

Pick ONE action. Reply with:
MOVE: <action>`;
}

export function buildMQRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  return `"${invalidMove}" is not valid. Available actions: ${legalMoves.join(', ')}

Reply with: MOVE: <action>`;
}

export function parseMQMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  // MOVE: ACTION
  const explicit = text.match(/MOVE\s*:\s*(\w+)/i);
  if (explicit) return explicit[1].toUpperCase();

  // Standalone action word
  const actions = ['ATTACK', 'CAST', 'DEFEND', 'COLLECT', 'DISARM', 'FORWARD', 'BACK', 'EXIT', 'WAIT'];
  for (const action of actions) {
    if (new RegExp(`\\b${action}\\b`, 'i').test(text)) return action;
  }

  return null;
}
