export function buildBattleshipPrompt(color: 'A' | 'B', board: string, legalMoves: string[]): string {
  return `You are playing Battleship as Fleet ${color}. Fire at the enemy grid to find and sink all their ships. Use your hit/miss intel to hunt efficiently — when you hit, target adjacent cells.

Your firing grid (enemy waters):
${board}

Fire at a coordinate (A1-H8) you haven't tried.
${legalMoves.length <= 20 ? `Available: ${legalMoves.join(', ')}` : `${legalMoves.length} cells remaining.`}

Reply with:
MOVE: <coordinate>`;
}

export function buildBattleshipRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  return `"${invalidMove}" is not valid (already fired or out of range).

Reply with an unfired coordinate A1-H8: MOVE: <coordinate>`;
}

export function parseBattleshipMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();
  const explicit = text.match(/MOVE[:\s]+([A-H][1-8])/i);
  if (explicit) return explicit[1].toUpperCase();
  const standalone = text.match(/\b([A-H][1-8])\b/i);
  if (standalone) return standalone[1].toUpperCase();
  return null;
}
