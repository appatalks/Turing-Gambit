import type { MoveRecord } from '../../types.js';

export interface CheckersPromptInput {
  color: 'Black' | 'White';
  board: string;
  legalMoves: string[];
  moveHistory: MoveRecord[];
}

export function buildCheckersPrompt(input: CheckersPromptInput): string {
  const recentMoves = input.moveHistory.slice(-20).map((m) => m.san).join(', ');

  return `You are playing checkers (American/English draughts) as ${input.color}.

Board (b=black, w=white, B/W=kings, _=empty, .=unused):
${input.board}

${recentMoves ? `Recent moves: ${recentMoves}` : ''}

Legal moves: ${input.legalMoves.join(', ')}

Rules reminder: Jumps are mandatory. Multi-jumps use dashes (e.g., 9-18-27). Pieces reaching the far row become kings.

IMPORTANT: Your FIRST line must be your move:
MOVE: <from-to>

The move MUST be one from the legal moves list.`;
}

export function buildCheckersRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  return `"${invalidMove}" is not valid. Legal moves: ${legalMoves.join(', ')}

Reply ONLY: MOVE: <from-to>`;
}

export function parseCheckersMoveFromResponse(response: string): string | null {
  // Strip <think> blocks
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  // 1. Explicit MOVE: prefix
  const explicit = text.match(/MOVE[:\s]+(\d{1,2}(?:-\d{1,2})+)/i);
  if (explicit) return explicit[1];

  // 2. Standalone move pattern on its own line
  const ownLine = text.match(/^(\d{1,2}(?:-\d{1,2})+)$/m);
  if (ownLine) return ownLine[1];

  // 3. Any move-like pattern (last match)
  const all = [...text.matchAll(/\b(\d{1,2}(?:-\d{1,2})+)\b/g)];
  if (all.length > 0) return all[all.length - 1][1];

  return null;
}
