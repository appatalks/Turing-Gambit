export function buildDotsAndBoxesPrompt(color: 'W' | 'B', board: string, legalMoves: string[]): string {
  return `You are playing Dots and Boxes as ${color}. Draw an edge between two dots. Completing the 4th side of a box earns you a point AND another turn. Most boxes wins.

Board:
${board}

Edge notation: H<row><col> = horizontal edge, V<row><col> = vertical edge.
Available edges: ${legalMoves.join(', ')}

Pick ONE edge. Reply with:
MOVE: <edge>`;
}

export function buildDotsAndBoxesRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  const shuffled = [...legalMoves].sort(() => Math.random() - 0.5);
  const pick = shuffled[0];
  return `"${invalidMove}" is not valid. Available edges: ${shuffled.join(', ')}

Reply: MOVE: ${pick}
(or any other edge from the list above)`;
}

export function parseDotsAndBoxesMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();
  const explicit = text.match(/MOVE[:\s]+([HV]\d\d)/i);
  if (explicit) return explicit[1].toUpperCase();
  const standalone = text.match(/\b([HV]\d\d)\b/i);
  if (standalone) return standalone[1].toUpperCase();
  return null;
}
