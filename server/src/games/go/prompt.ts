function stripThinkTags(response: string): string {
  const stripped = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  return stripped || response.trim();
}

export function buildGoPrompt(board: string, legalMoves: string[], recentMoves?: { san: string }[]): { system?: string; prompt: string } {
  const system = 'You are playing Go (9×9 board). Capture opponent groups by surrounding them. Control territory. Chinese area scoring with 5.5 komi for White. Think about: influence, territory, connections, cutting points, and life/death.';

  const history = recentMoves && recentMoves.length > 0
    ? `\nRecent moves:\n${recentMoves.slice(-12).map((m) => `  ${m.san}`).join('\n')}\n`
    : '';

  const moveSample = legalMoves.length <= 40
    ? legalMoves.join(', ')
    : `${legalMoves.slice(0, 30).join(', ')} ... (${legalMoves.length} moves available, or PASS)`;

  const prompt = `${board}
${history}
Legal moves: ${moveSample}

Strategy:
- Opening: play near the center and star points (E5, C3, G3, C7, G7)
- Build frameworks, don't play too close to opponent stones early
- Connect your groups, cut opponent groups
- PASS when no profitable moves remain (both pass = game ends)

Reply with: MOVE: <coordinate>
Example: MOVE: E5, MOVE: C3, MOVE: PASS`;

  return { system, prompt };
}

export function buildGoRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  const sample = legalMoves.slice(0, 25).join(', ');
  return `"${invalidMove}" is not legal (occupied, suicide, or ko). Legal: ${sample}${legalMoves.length > 25 ? ' ...' : ''}

Format: letter A-J (no I) + number 1-9. Example: E5, A1, J9, or PASS.
Reply with: MOVE: <coordinate>`;
}

export function parseGoMove(response: string): string | null {
  const text = stripThinkTags(response);
  if (!text) return null;

  // Check for PASS
  if (/\bPASS\b/i.test(text)) return 'PASS';

  // MOVE: E5
  const explicit = text.match(/MOVE\s*:\s*([A-HJ]\d+|PASS)/i);
  if (explicit) return explicit[1].toUpperCase();

  // Standalone coordinate
  const coord = text.match(/\b([A-HJ][1-9])\b/i);
  if (coord) return coord[1].toUpperCase();

  return null;
}
