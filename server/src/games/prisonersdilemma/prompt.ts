export function buildPDPrompt(board: string): string {
  return `You are a player in the Iterated Prisoner's Dilemma. Each round you secretly choose to COOPERATE or DEFECT. You do NOT know the opponent's choice this round until after. Maximize YOUR total score over all rounds.

${board}

Think about your strategy (trust, retaliation, forgiveness). Then decide.

IMPORTANT: Your FIRST line must be:
MOVE: COOPERATE
or
MOVE: DEFECT`;
}

export function buildPDRetryPrompt(): string {
  return `Invalid. Reply with exactly:
MOVE: COOPERATE
or
MOVE: DEFECT`;
}

export function parsePDMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();
  const explicit = text.match(/MOVE[:\s]+(COOPERATE|DEFECT|C|D)\b/i);
  if (explicit) {
    const v = explicit[1].toUpperCase();
    return (v === 'C' || v === 'COOPERATE') ? 'COOPERATE' : 'DEFECT';
  }
  // Look for the words anywhere (last occurrence)
  const coop = text.toUpperCase().lastIndexOf('COOPERATE');
  const def = text.toUpperCase().lastIndexOf('DEFECT');
  if (coop === -1 && def === -1) return null;
  return def > coop ? 'DEFECT' : 'COOPERATE';
}
