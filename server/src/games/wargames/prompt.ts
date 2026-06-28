import type { MoveRecord } from '../../types.js';

export interface WargamesPromptInput {
  color: 'Side A' | 'Side B';
  board: string;
  legalMoves: string[];
  moveHistory: MoveRecord[];
}

// Randomized strategic doctrines to vary AI behavior between games
const DOCTRINES = [
  'AGGRESSIVE FIRST STRIKE: Prioritize overwhelming offense. Use MIRV and SLBM to maximize destruction quickly.',
  'FLEXIBLE RESPONSE: Balance offense and defense. Counter enemy strikes, exploit undefended targets.',
  'COUNTERFORCE: Target the enemy systematically. Use BOMBER to strip defenses, then ICBM the weakened targets.',
  'DETERRENCE & DE-ESCALATION: Favor defense and negotiation. Strike only when strategically necessary.',
  'DECAPITATION: Concentrate firepower. Use MIRV to cripple multiple targets in single strikes.',
  'ATTRITION WARFARE: Steady pressure. Mix all triad options to wear down the enemy over time.',
];

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
  // Pick a doctrine pseudo-randomly per side (stable-ish via color hash + randomness)
  const doctrine = DOCTRINES[Math.floor(Math.random() * DOCTRINES.length)];
  // Shuffle move order so the model doesn't always anchor on the first option
  const shuffledMoves = shuffle(input.legalMoves);

  return `GLOBAL THERMONUCLEAR WAR — You command ${input.color}.

STRATEGIC DOCTRINE: ${doctrine}

${input.board}

${recentMoves ? `Recent actions:\n${recentMoves}\n` : ''}Your options: ${shuffledMoves.join(', ')}

Make a decisive, strategic choice that fits your doctrine. Vary your approach.

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
