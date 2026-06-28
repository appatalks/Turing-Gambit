export function buildConnectFourPrompt(color: 'Red' | 'Yellow', board: string, legalMoves: string[]): string {
  return `You are playing Connect Four as ${color}. Drop discs to connect 4 in a row (horizontal, vertical, or diagonal).

${board}

Available columns: ${legalMoves.join(', ')}

Pick ONE column number. Reply with:
MOVE: <column>`;
}

export function buildConnectFourRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  return `"${invalidMove}" is not valid. Available columns: ${legalMoves.join(', ')}

Reply: MOVE: <column>`;
}

export function parseConnectFourMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();
  const explicit = text.match(/MOVE[:\s]+([1-7])/i);
  if (explicit) return explicit[1];
  const standalone = text.match(/^([1-7])$/m);
  if (standalone) return standalone[1];
  const all = [...text.matchAll(/\b([1-7])\b/g)];
  if (all.length > 0) return all[all.length - 1][1];
  return null;
}
