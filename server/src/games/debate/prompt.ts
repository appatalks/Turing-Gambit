export function buildDebatePrompt(board: string): string {
  return `${board}

Make your strongest argument for your side. Be persuasive, use logic and evidence, and rebut the opponent's points if any. Keep it to 2-4 tight sentences.

Write your argument directly (no "MOVE:" prefix needed — just argue):`;
}

// Debate accepts any non-empty text as a valid "move".
export function parseDebateMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();
  // Strip a leading "MOVE:" if the model added one
  text = text.replace(/^MOVE[:\s]+/i, '').trim();
  return text.length > 0 ? text : null;
}
