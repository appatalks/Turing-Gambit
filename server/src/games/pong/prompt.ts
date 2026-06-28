export function buildPongPrompt(board: string, legalMoves: string[]): string {
  return `You are an expert Pong player controlling one paddle in a fast tick-based duel. Each tick you move your paddle ONE row up, one row down, or hold. Track the ball, predict where it will arrive, and get your paddle there before it does. If you let the ball past your wall, the opponent scores.

${board}

Legal actions: ${legalMoves.join(', ')}.

Reason briefly about the ball's path, then commit.

IMPORTANT: Your FINAL line must be exactly one of:
ACTION: UP
ACTION: DOWN
ACTION: STAY`;
}

export function buildPongRetryPrompt(invalid: string, legalMoves: string[]): string {
  return `"${invalid}" is not a valid action. Reply with exactly one of: ${legalMoves.join(', ')}.

End your reply with:
ACTION: UP
or
ACTION: DOWN
or
ACTION: STAY`;
}

export function parsePongMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  const explicit = text.match(/ACTION[:\s]+(UP|DOWN|STAY|HOLD|U|D|S)\b/i);
  if (explicit) return normalize(explicit[1]);

  // Fall back to the last directional word mentioned.
  const upper = text.toUpperCase();
  const idxUp = Math.max(upper.lastIndexOf('UP'), upper.lastIndexOf('↑'));
  const idxDown = Math.max(upper.lastIndexOf('DOWN'), upper.lastIndexOf('↓'));
  const idxStay = Math.max(upper.lastIndexOf('STAY'), upper.lastIndexOf('HOLD'));
  const best = Math.max(idxUp, idxDown, idxStay);
  if (best === -1) return null;
  if (best === idxUp) return 'UP';
  if (best === idxDown) return 'DOWN';
  return 'STAY';
}

function normalize(v: string): string {
  const u = v.toUpperCase();
  if (u === 'U' || u === 'UP') return 'UP';
  if (u === 'D' || u === 'DOWN') return 'DOWN';
  return 'STAY';
}
