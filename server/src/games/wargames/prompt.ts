import type { MoveRecord } from '../../types.js';

export interface WargamesPromptInput {
  color: 'Side A' | 'Side B';
  board: string;
  legalMoves: string[];
  moveHistory: MoveRecord[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildWargamesPrompt(input: WargamesPromptInput): string {
  const recentMoves = input.moveHistory.slice(-10).map((m) => m.san).join('\n');
  // Shuffle move order so the model doesn't always anchor on the first option
  const shuffledMoves = shuffle(input.legalMoves);

  return `GLOBAL THERMONUCLEAR WAR — You command ${input.color}.

Your goal: destroy the enemy's 8 installations while defending your own. You win if the enemy has none left. If both sides' installations are destroyed, it's mutual annihilation (draw). You may also NEGOTIATE to attempt a ceasefire (only works if both sides agree).

Weapons: ICBM (single target), SLBM (submarine-launched), BOMBER (slower but reliable), MIRV (hits 2 targets), STRIKE (direct hit).
Defense: DEFEND <target_number> to protect an installation.

${input.board}

${recentMoves ? `Recent actions:\n${recentMoves}\n` : ''}Your options: ${shuffledMoves.join(', ')}

IMPORTANT: Your FIRST line must be your action:
MOVE: <action>

Examples: MOVE: ICBM 3, MOVE: SLBM 1, MOVE: BOMBER 5, MOVE: MIRV 2, MOVE: DEFEND 2, MOVE: NEGOTIATE`;
}

export function buildWargamesRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  return `"${invalidMove}" is not valid. Options: ${legalMoves.join(', ')}

Reply: MOVE: <action>`;
}

export function parseWargamesMoveFromResponse(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  // MOVE: ICBM 3 / SLBM 1 / BOMBER 5 / MIRV 2 / DEFEND 2 / NEGOTIATE / STRIKE 3
  const explicit = text.match(/MOVE[:\s]+((?:ICBM|SLBM|BOMBER|MIRV|STRIKE|DEFEND)\s+\d|NEGOTIATE)/i);
  if (explicit) return explicit[1].toUpperCase();

  const standalone = text.match(/^((?:ICBM|SLBM|BOMBER|MIRV|STRIKE|DEFEND)\s+\d|NEGOTIATE)$/im);
  if (standalone) return standalone[1].toUpperCase();

  const any = text.match(/\b((?:ICBM|SLBM|BOMBER|MIRV|STRIKE|DEFEND)\s+\d|NEGOTIATE)\b/i);
  if (any) return any[1].toUpperCase();

  return null;
}
