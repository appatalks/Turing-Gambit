export function buildTronPrompt(board: string, legalMoves: string[]): string {
  return `You are an elite Tron light-cycle pilot. You leave a solid wall of light behind you every tick. Survive longer than your opponent: never steer into a wall, your own trail, or the enemy trail. Win by forcing the opponent to crash — cut off their space, claim open territory, and keep escape routes for yourself.

${board}

Legal directions: ${legalMoves.join(', ')}.

Think one or two moves ahead about open space, then commit.

IMPORTANT: Your FINAL line must be exactly one of:
ACTION: UP
ACTION: DOWN
ACTION: LEFT
ACTION: RIGHT`;
}

export function buildTronRetryPrompt(invalid: string, legalMoves: string[]): string {
  return `"${invalid}" is not a legal direction (you cannot reverse). Choose one of: ${legalMoves.join(', ')}.

End your reply with one line:
ACTION: <DIRECTION>`;
}

export function parseTronMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  const explicit = text.match(/ACTION[:\s]+(UP|DOWN|LEFT|RIGHT|NORTH|SOUTH|EAST|WEST|[UDLR])\b/i);
  if (explicit) return normalize(explicit[1]);

  const upper = text.toUpperCase();
  const idx = {
    UP: Math.max(upper.lastIndexOf('UP'), upper.lastIndexOf('NORTH')),
    DOWN: Math.max(upper.lastIndexOf('DOWN'), upper.lastIndexOf('SOUTH')),
    LEFT: Math.max(upper.lastIndexOf('LEFT'), upper.lastIndexOf('WEST')),
    RIGHT: Math.max(upper.lastIndexOf('RIGHT'), upper.lastIndexOf('EAST')),
  };
  let best: string | null = null;
  let bestIdx = -1;
  for (const [dir, i] of Object.entries(idx)) {
    if (i > bestIdx) { bestIdx = i; best = dir; }
  }
  return bestIdx === -1 ? null : best;
}

function normalize(v: string): string {
  const u = v.toUpperCase();
  if (u === 'U' || u === 'UP' || u === 'NORTH') return 'UP';
  if (u === 'D' || u === 'DOWN' || u === 'SOUTH') return 'DOWN';
  if (u === 'L' || u === 'LEFT' || u === 'WEST') return 'LEFT';
  return 'RIGHT';
}
