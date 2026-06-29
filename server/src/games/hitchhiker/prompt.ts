function stripThinkTags(response: string): string {
  const stripped = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  return stripped || response.trim();
}

export function buildHHPrompt(board: string, _legalMoves: string[], recentMoves?: { san: string }[]): { system?: string; prompt: string } {
  const system = `You are playing The Hitchhiker's Guide to the Galaxy text adventure. Race to reach the Heart of Gold! You MUST try different commands each turn — never repeat a command that didn't work. Key sequence: wake up → TAKE TOWEL → GO SOUTH (to porch) → LIE DOWN → GO SOUTH (to pub) → DRINK BEER → WAIT → (on Vogon ship) TAKE BABEL FISH → GO EAST → GO EAST → USE EJECT BUTTON → USE SUB-ETHA DEVICE. DON'T PANIC.`;

  const history = recentMoves && recentMoves.length > 0
    ? `\nYour command history (DO NOT repeat failed commands):\n${recentMoves.slice(-12).map((m) => `  > ${m.san}`).join('\n')}\n`
    : '';

  const prompt = `${board}
${history}
IMPORTANT: Look at your command history above. Do NOT repeat commands that failed or gave no progress. Try the NEXT step in the sequence.

Available commands: GO NORTH/SOUTH/EAST/WEST, TAKE <item>, EXAMINE <item>, DRINK BEER, LIE DOWN, USE <item>, PUSH <button>, WAIT, INVENTORY, LOOK.

Step-by-step walkthrough:
1. In Bedroom: TAKE ASPIRIN, then GO SOUTH
2. At Front Porch: TAKE TOWEL, then LIE DOWN
3. Lying in Mud: GO SOUTH (or WAIT first, then GO SOUTH)
4. At Pub: DRINK BEER, then WAIT
5. On Vogon Ship: TAKE BABEL FISH, then GO EAST, then GO EAST
6. At Airlock: USE EJECT BUTTON (must have towel!)
7. In Space: USE SUB-ETHA DEVICE

Reply with exactly ONE command:
MOVE: <command>`;

  return { system, prompt };
}

export function buildHHRetryPrompt(invalidMove: string, _legalMoves: string[]): string {
  return `"${invalidMove}" wasn't understood. Use: GO NORTH/SOUTH/EAST/WEST, TAKE <item>, EXAMINE <item>, DRINK, LIE DOWN, USE <item>, PUSH <button>, WAIT, LOOK, INVENTORY.

Reply with: MOVE: <command>`;
}

export function parseHHMove(response: string): string | null {
  const text = stripThinkTags(response);
  if (!text) return null;

  const explicit = text.match(/MOVE\s*:\s*(.+)/i);
  if (explicit) {
    const cmd = explicit[1].trim().replace(/["`']/g, '');
    if (cmd.length > 0 && cmd.length < 100) return cmd;
  }

  const verbs = /^(GO|NORTH|SOUTH|EAST|WEST|N|S|E|W|TAKE|GET|DROP|EXAMINE|X|READ|LOOK|L|INVENTORY|I|DRINK|LIE|USE|PUSH|PRESS|WAIT|Z)\b/i;
  for (const line of text.split('\n')) {
    const trimmed = line.trim().replace(/^[>\-\*•]\s*/, '');
    if (verbs.test(trimmed)) return trimmed.replace(/["`']/g, '').slice(0, 80);
  }

  const firstLine = text.split('\n')[0]?.trim();
  if (firstLine && firstLine.length < 60 && firstLine.length > 1) return firstLine.replace(/["`']/g, '');

  return null;
}
