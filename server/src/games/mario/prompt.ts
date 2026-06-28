export function buildMarioPrompt(board: string, legalMoves: string[]): string {
  return `You are a champion speed-runner in a side-scrolling platform race. You and a rival sprint down identical tracks toward a finish flag. Pits drop you back to your last checkpoint; pipe walls block you. Read the terrain ahead, time your jumps, and reach the flag first.

${board}

Legal actions: ${legalMoves.join(', ')}.

Plan the next hazard, then commit. Don't JUMP if you'd land on a pit or pipe — RUN instead.

IMPORTANT: Your FINAL line must be exactly one of:
ACTION: RUN
ACTION: JUMP
ACTION: WAIT`;
}

export function buildMarioRetryPrompt(invalid: string, legalMoves: string[]): string {
  return `"${invalid}" is not a valid action. Choose one of: ${legalMoves.join(', ')}.

End your reply with one line:
ACTION: RUN
or
ACTION: JUMP
or
ACTION: WAIT`;
}

export function parseMarioMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  const explicit = text.match(/ACTION[:\s]+(RUN|JUMP|WAIT|HOP|LEAP|WALK|GO|HOLD|STAY|[RJW])\b/i);
  if (explicit) return normalize(explicit[1]);

  const upper = text.toUpperCase();
  const idxJump = Math.max(upper.lastIndexOf('JUMP'), upper.lastIndexOf('HOP'), upper.lastIndexOf('LEAP'));
  const idxWait = Math.max(upper.lastIndexOf('WAIT'), upper.lastIndexOf('HOLD'));
  const idxRun = Math.max(upper.lastIndexOf('RUN'), upper.lastIndexOf('WALK'));
  const best = Math.max(idxJump, idxWait, idxRun);
  if (best === -1) return null;
  if (best === idxJump) return 'JUMP';
  if (best === idxWait) return 'WAIT';
  return 'RUN';
}

function normalize(v: string): string {
  const u = v.toUpperCase();
  if (u === 'J' || u === 'JUMP' || u === 'HOP' || u === 'LEAP') return 'JUMP';
  if (u === 'W' || u === 'WAIT' || u === 'HOLD' || u === 'STAY') return 'WAIT';
  return 'RUN';
}
