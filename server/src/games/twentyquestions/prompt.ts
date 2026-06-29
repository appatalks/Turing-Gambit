export function buildTQPrompt(board: string, legalMoves: string[]): string {
  return `You are playing 20 Questions.

${board}

Legal actions: ${legalMoves.join(', ')}

Rules:
- If you're the ANSWERER and need to pick a secret, reply: SECRET: <thing>
- If you're the QUESTIONER, ask yes/no questions with: ASK: <question>
- To make a guess: GUESS: <your guess>
- To answer a question: reply YES or NO
- To judge a guess: reply CORRECT or WRONG

Reply with your action now.`;
}

export function buildTQRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  return `"${invalidMove}" is not valid. Legal actions: ${legalMoves.join(', ')}

If picking a secret: SECRET: <thing>
If asking: ASK: <question>
If guessing: GUESS: <guess>
If answering: YES, NO, CORRECT, or WRONG

Reply with exactly one action.`;
}

export function parseTQMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  // SECRET: ...
  const secret = text.match(/SECRET\s*:\s*(.+)/i);
  if (secret) return `SECRET: ${secret[1].trim()}`;

  // GUESS: ...
  const guess = text.match(/GUESS\s*:\s*(.+)/i);
  if (guess) return `GUESS: ${guess[1].trim()}`;

  // ASK: ...
  const ask = text.match(/ASK\s*:\s*(.+)/i);
  if (ask) return `ASK: ${ask[1].trim()}`;

  // YES/NO/CORRECT/WRONG
  const answer = text.match(/\b(CORRECT|WRONG|YES|NO)\b/i);
  if (answer) return answer[1].toUpperCase();

  return null;
}
