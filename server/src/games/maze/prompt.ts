function stripThinkTags(response: string): string {
  const stripped = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  return stripped || response.trim();
}

export function buildMazePrompt(board: string, legalMoves: string[], recentMoves?: { san: string }[]): { system?: string; prompt: string } {
  const system = 'You are navigating a maze. Race to reach the goal (G) before your opponent. You can only see a limited area around you. Avoid revisiting cells (marked *). Use wall-following or dead-end elimination to solve the maze efficiently.';

  const history = recentMoves && recentMoves.length > 0
    ? `\nYour recent moves:\n${recentMoves.slice(-10).map((m) => `  ${m.san}`).join('\n')}\n`
    : '';

  const prompt = `${board}
${history}
Available directions: ${legalMoves.join(', ')}

Strategy:
- The goal is at the bottom-right corner
- Avoid cells you've already visited (marked *)
- Generally prefer SOUTH and EAST to approach the goal
- If stuck, backtrack and try unexplored paths

Reply with exactly one direction:
MOVE: <NORTH|SOUTH|EAST|WEST>`;

  return { system, prompt };
}

export function buildMazeRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  return `"${invalidMove}" is not valid. Available: ${legalMoves.join(', ')}

Reply with: MOVE: <direction>`;
}

export function parseMazeMove(response: string): string | null {
  const text = stripThinkTags(response);
  if (!text) return null;

  const explicit = text.match(/MOVE\s*:\s*(NORTH|SOUTH|EAST|WEST|N|S|E|W)\b/i);
  if (explicit) {
    const dir = explicit[1].toUpperCase();
    if (dir.length === 1) {
      const map: Record<string, string> = { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST' };
      return map[dir] || null;
    }
    return dir;
  }

  const bare = text.match(/\b(NORTH|SOUTH|EAST|WEST)\b/i);
  if (bare) return bare[1].toUpperCase();

  const abbr = text.match(/\b([NSEW])\b/);
  if (abbr) {
    const map: Record<string, string> = { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST' };
    return map[abbr[1]] || null;
  }

  return null;
}
