function stripThinkTags(response: string): string {
  const stripped = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  return stripped || response.trim();
}

function isAnswererTurn(legalMoves: string[]): boolean {
  return legalMoves.some((move) => ['YES', 'NO', 'SOMETIMES'].includes(move.toUpperCase()));
}

export function buildTQPrompt(board: string, legalMoves: string[]): { system?: string; prompt: string } {
  const answerer = isAnswererTurn(legalMoves);
  const system = answerer
    ? 'You are playing 20 Questions as the Answerer. You know the secret word and must answer the Questioner honestly with YES, NO, or SOMETIMES. Never reveal the secret directly.'
    : 'You are playing 20 Questions as the Questioner. Use the Q&A history to ask efficient yes/no questions or make a direct guess for the secret word.';

  const prompt = answerer
    ? `${board}

Reply with exactly one move in this form:
MOVE: YES
or
MOVE: NO
or
MOVE: SOMETIMES`
    : `${board}

Reply with exactly one move in one of these forms:
MOVE: ASK: <your yes/no question>
or
MOVE: GUESS: <your answer>`;

  return { system, prompt };
}

export function buildTQRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  if (isAnswererTurn(legalMoves)) {
    return `"${invalidMove}" is invalid. Reply with exactly one of:
MOVE: YES
MOVE: NO
MOVE: SOMETIMES`;
  }

  return `"${invalidMove}" is invalid. Reply with exactly one move:
MOVE: ASK: <your yes/no question>
or
MOVE: GUESS: <your answer>`;
}

export function parseTQMove(response: string): string | null {
  const text = stripThinkTags(response);
  if (!text) return null;

  const explicitMove = text.match(/MOVE\s*:\s*(ASK|GUESS)\s*:\s*([^\n\r]+)/i);
  if (explicitMove) {
    const kind = explicitMove[1].toUpperCase();
    const value = explicitMove[2].trim().replace(/^["']|["']$/g, '');
    return value ? `${kind}: ${value}` : null;
  }

  const bareMove = text.match(/\b(ASK|GUESS)\s*:\s*([^\n\r]+)/i);
  if (bareMove) {
    const kind = bareMove[1].toUpperCase();
    const value = bareMove[2].trim().replace(/^["']|["']$/g, '');
    return value ? `${kind}: ${value}` : null;
  }

  const answer = text.match(/\b(YES|NO|SOMETIMES)\b/i);
  if (answer) return answer[1].toUpperCase();

  return null;
}
