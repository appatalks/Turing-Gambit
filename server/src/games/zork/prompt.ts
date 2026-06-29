function stripThinkTags(response: string): string {
  const stripped = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  return stripped || response.trim();
}

export function buildZorkPrompt(board: string, _legalMoves: string[], recentMoves?: { san: string }[]): { system?: string; prompt: string } {
  const system = `You are playing Zork I, the classic text adventure. You are racing against another player — the first to score ${65} points by placing all treasures in the trophy case wins. Explore, collect items, solve puzzles, and be efficient. This is a real Zork game with a parser that understands: GO direction, TAKE item, DROP item, OPEN item, EXAMINE item, PUT item IN container, ATTACK enemy, LIGHT lantern, INVENTORY, LOOK.`;

  const history = recentMoves && recentMoves.length > 0
    ? `\nYour recent commands:\n${recentMoves.slice(-8).map((m) => `  ${m.san.split(' → ')[0]}`).join('\n')}\n`
    : '';

  const prompt = `${board}
${history}
What is your next command? Think about your strategy:
- Explore to find treasures (jeweled egg, gold coffin, sceptre, diamond, jade figurine, chalice, platinum bar, trident, ivory torch)
- You need the brass lantern (in kitchen) to explore dark underground areas
- You need the elvish sword to defeat the troll blocking the underground passages
- PUT treasures IN TROPHY CASE (in the living room) to score points
- Be efficient — fewest turns wins if scores are tied

Reply with EXACTLY one text adventure command:
MOVE: <command>

Examples: MOVE: GO NORTH, MOVE: TAKE LANTERN, MOVE: OPEN MAILBOX, MOVE: LIGHT LANTERN, MOVE: PUT EGG IN CASE, MOVE: ATTACK TROLL`;

  return { system, prompt };
}

export function buildZorkRetryPrompt(invalidMove: string, _legalMoves: string[]): string {
  return `"${invalidMove}" was not understood. Use standard text adventure commands:
GO NORTH/SOUTH/EAST/WEST/UP/DOWN, TAKE <item>, DROP <item>, OPEN <item>, EXAMINE <item>, PUT <item> IN <container>, ATTACK <enemy>, LIGHT LANTERN, INVENTORY, LOOK

Reply with: MOVE: <command>`;
}

export function parseZorkMove(response: string): string | null {
  const text = stripThinkTags(response);
  if (!text) return null;

  // Try explicit MOVE: prefix
  const explicit = text.match(/MOVE\s*:\s*(.+)/i);
  if (explicit) {
    const cmd = explicit[1].trim().replace(/["`']/g, '');
    if (cmd.length > 0 && cmd.length < 100) return cmd;
  }

  // Try a line that looks like a command (starts with known verb)
  const verbs = /^(GO|NORTH|SOUTH|EAST|WEST|UP|DOWN|N|S|E|W|U|D|TAKE|GET|DROP|OPEN|CLOSE|EXAMINE|X|READ|LOOK|L|INVENTORY|I|PUT|PLACE|ATTACK|KILL|FIGHT|LIGHT|TURN|EXTINGUISH|SCORE|WAIT|Z)\b/i;
  for (const line of text.split('\n')) {
    const trimmed = line.trim().replace(/^[>\-\*•]\s*/, '');
    if (verbs.test(trimmed)) {
      const cmd = trimmed.replace(/["`']/g, '').slice(0, 80);
      return cmd;
    }
  }

  // Last resort: take the first short line
  const firstLine = text.split('\n')[0]?.trim();
  if (firstLine && firstLine.length < 60 && firstLine.length > 1) {
    return firstLine.replace(/["`']/g, '');
  }

  return null;
}
