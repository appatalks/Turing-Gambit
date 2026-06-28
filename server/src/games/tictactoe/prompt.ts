import type { MoveRecord } from '../../types.js';

export function buildTTTPrompt(color: 'X' | 'O', board: string, legalMoves: string[]): string {
  return `You are playing Tic-Tac-Toe as ${color}.

Board (empty squares show their number):
${board}

Available positions: ${legalMoves.join(', ')}

Pick ONE position. Reply with:
MOVE: <number>`;
}

export function buildTTTRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  return `"${invalidMove}" is not valid. Available: ${legalMoves.join(', ')}

Reply: MOVE: <number>`;
}

export function parseTTTMoveFromResponse(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  const explicit = text.match(/MOVE[:\s]+(\d)/i);
  if (explicit) return explicit[1];

  const standalone = text.match(/^(\d)$/m);
  if (standalone) return standalone[1];

  // Last single digit mentioned
  const all = [...text.matchAll(/\b([1-9])\b/g)];
  if (all.length > 0) return all[all.length - 1][1];

  return null;
}
