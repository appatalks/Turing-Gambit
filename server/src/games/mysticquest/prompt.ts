const VALID_MQ_MOVES = [
  'MOVE_N',
  'MOVE_S',
  'MOVE_E',
  'MOVE_W',
  'ATTACK',
  'CAST_FIREBALL',
  'CAST_HEAL',
  'CAST_SHIELD',
  'GATHER',
  'REST',
] as const;

export function buildMQPrompt(board: string, legalMoves: string[]): { system?: string; prompt: string } {
  return {
    system: 'You are a hero in Mystic Quest, a turn-based fantasy strategy game.',
    prompt: `Board state:\n${board}\n\nLegal moves: ${legalMoves.join(', ')}\n\nAction notes:\n- ATTACK hits an adjacent enemy hero if one is next to you; otherwise it hits the weakest adjacent monster.\n- CAST_FIREBALL targets the enemy hero in range first; otherwise it hits the weakest monster within 3 tiles.\n\nReply with: MOVE: <action>`,
  };
}

export function buildMQRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  return `"${invalidMove}" is not a legal Mystic Quest move right now.\nLegal moves: ${legalMoves.join(', ')}\n\nReply with: MOVE: <action>`;
}

export function parseMQMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  const pattern = new RegExp(`\\b(${VALID_MQ_MOVES.join('|')})\\b`, 'gi');
  const explicit = text.match(/MOVE[:\s]+([A-Z_]+)/i);
  if (explicit) {
    const move = explicit[1].toUpperCase();
    if ((VALID_MQ_MOVES as readonly string[]).includes(move)) return move;
  }

  const matches = [...text.toUpperCase().matchAll(pattern)];
  if (matches.length > 0) {
    return matches[matches.length - 1][1].toUpperCase();
  }

  return null;
}
