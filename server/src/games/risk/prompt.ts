export function buildRiskPrompt(board: string, legalMoves: string[], recentMoves?: { san: string }[]): { system?: string; prompt: string } {
  let phaseHelp = '';
  let example = '';
  if (/REINFORCE/i.test(legalMoves[0] || '')) {
    phaseHelp = `REINFORCE phase — place your entire army pool on ONE of your territories (ideally a border you want to attack from or defend).
Format: MOVE: REINFORCE <TERRITORY>`;
    example = `MOVE: ${legalMoves[0]}`;
  } else if ((legalMoves[0] || '').startsWith('ATTACK') || legalMoves.includes('END_ATTACK')) {
    phaseHelp = `ATTACK phase — attack an adjacent enemy territory (a full blitz is auto-resolved with dice). You may attack multiple times, then end the phase.
Format: MOVE: ATTACK <FROM> <TO>   or   MOVE: END_ATTACK`;
    example = `MOVE: ${legalMoves.find((m) => m.startsWith('ATTACK')) || 'END_ATTACK'}`;
  } else {
    phaseHelp = `FORTIFY phase — optionally move armies from one of your territories to a connected friendly one (moves all but one), then your turn ends.
Format: MOVE: FORTIFY <FROM> <TO>   or   MOVE: END_TURN`;
    example = `MOVE: ${legalMoves.find((m) => m.startsWith('FORTIFY')) || 'END_TURN'}`;
  }

  const list = legalMoves.length <= 40
    ? `\nLegal moves: ${legalMoves.join(' | ')}`
    : `\n(${legalMoves.length} legal moves available — see options above.)`;

  const history = recentMoves && recentMoves.length > 0
    ? `\nRecent actions (latest last):\n${recentMoves.slice(-10).map((m) => `  ${m.san}`).join('\n')}\n`
    : '';

  const system = 'You are a RISK general. Conquer every territory to win. Think about which borders to reinforce, when to attack vs. consolidate, and how to avoid overextending.';

  const prompt = `${board}
${history}
${phaseHelp}
${list}

RESPONSE RULES (important):
- Keep any reasoning to ONE short sentence.
- Your reply MUST end with a line in exactly this form: MOVE: <one move from the legal list>
- Copy a move verbatim from the legal list. Do not invent territory codes.
Example reply:
${example}`;

  return { system, prompt };
}

export function buildRiskRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  const sample = legalMoves.slice(0, 40).join(' | ');
  return `"${invalidMove}" is not a legal move right now. Do not reason — just answer.

Pick ONE exactly from this list and copy it verbatim:
${sample}${legalMoves.length > 40 ? ' | ...' : ''}

Reply with only: MOVE: <one legal move>`;
}

export function parseRiskMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();
  const up = text.toUpperCase();

  // Prefer an explicit MOVE: line.
  const moveLine = up.match(/MOVE[:\s]+([A-Z_]+(?:\s+[A-Z]{3})?(?:\s+[A-Z]{3})?)/);
  const candidate = moveLine ? moveLine[1] : up;

  // Match the known command grammar.
  const m =
    candidate.match(/\bATTACK\s+([A-Z]{3})\s+([A-Z]{3})\b/) ||
    candidate.match(/\bFORTIFY\s+([A-Z]{3})\s+([A-Z]{3})\b/) ||
    candidate.match(/\bREINFORCE\s+([A-Z]{3})\b/);
  if (m) {
    const cmd = m[0].trim().replace(/\s+/g, ' ');
    return cmd;
  }
  if (/\bEND_ATTACK\b/.test(up)) return 'END_ATTACK';
  if (/\bEND_TURN\b/.test(up)) return 'END_TURN';
  return null;
}

// Lenient fallback: pick the legal move whose territory codes are most
// strongly referenced in the model's response. Helps smaller models that
// don't follow the exact "MOVE:" grammar.
export function fuzzyRiskMatch(response: string, legalMoves: string[]): string | null {
  const up = ' ' + response.toUpperCase().replace(/[^A-Z_]+/g, ' ') + ' ';

  // Explicit end commands win if mentioned and legal.
  if (legalMoves.includes('END_ATTACK') && /\bEND[_\s]?ATTACK\b/.test(up)) return 'END_ATTACK';
  if (legalMoves.includes('END_TURN') && /\bEND[_\s]?TURN\b/.test(up)) return 'END_TURN';

  const tokens = new Set(up.split(/\s+/).filter(Boolean));
  let best: string | null = null;
  let bestScore = -1;

  for (const mv of legalMoves) {
    const parts = mv.split(' ');
    const codes = parts.slice(1); // territory codes after the command word
    if (codes.length === 0) continue;
    if (!codes.every((c) => tokens.has(c))) continue;
    // Score: prefer codes that appear in the same order as the command
    // (FROM before TO), and the later in the text the better.
    let score = codes.length * 1000;
    if (codes.length === 2) {
      const a = up.indexOf(' ' + codes[0] + ' ');
      const b = up.lastIndexOf(' ' + codes[1] + ' ');
      if (a >= 0 && b >= 0 && a < b) score += 500; // correct order bonus
      score += Math.max(a, b);
    } else {
      score += up.lastIndexOf(' ' + codes[0] + ' ');
    }
    if (score > bestScore) { best = mv; bestScore = score; }
  }
  if (best) return best;

  // Last resort: a bare "end / stop / done / pass" with no territory move.
  // Phases are exclusive, so the available END_ option is unambiguous.
  if (/\b(END|STOP|DONE|PASS|FINISH|SKIP)\b/.test(up)) {
    if (legalMoves.includes('END_ATTACK') && !legalMoves.includes('END_TURN')) return 'END_ATTACK';
    if (legalMoves.includes('END_TURN')) return 'END_TURN';
  }
  return null;
}

