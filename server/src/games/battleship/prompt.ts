// Find cells adjacent to existing hits that are still unfired — the smart
// "hunt" targets when a ship is damaged but not yet sunk.
function hotTargets(board: string, legal: Set<string>): string[] {
  const letters = 'ABCDEFGHIJ';
  const hits: { c: number; r: number }[] = [];
  for (const line of board.split('\n')) {
    const m = line.match(/^\s*(\d{1,2})\s+(.*)$/);
    if (!m) continue;
    const row = parseInt(m[1]);
    if (row < 1 || row > 10) continue;
    const cells = m[2].trim().split(/\s+/);
    cells.forEach((ch, ci) => { if (ch === 'X') hits.push({ c: ci, r: row }); });
  }
  const out = new Set<string>();
  for (const h of hits) {
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const c = h.c + dc, r = h.r + dr;
      if (c < 0 || c > 9 || r < 1 || r > 10) continue;
      const coord = letters[c] + r;
      if (legal.has(coord)) out.add(coord);
    }
  }
  return [...out];
}

export function buildBattleshipPrompt(color: 'A' | 'B', board: string, legalMoves: string[]): string {
  const legalSet = new Set(legalMoves);
  const hot = hotTargets(board, legalSet);
  const hint = hot.length > 0
    ? `\n⚠ You have unfinished hits — fire NEXT to a cell adjacent to an "X" to sink the ship: ${hot.join(', ')}`
    : '';

  return `You are playing Battleship as Fleet ${color}. Find and sink all enemy ships.
On the grid: X = your past hit, o = your past miss, . = water you have NOT fired at.
You may ONLY fire at a "." cell. Never repeat an X or o cell.

Your firing grid (enemy waters):
${board}
${hint}

Pick ONE coordinate you have not fired at yet (a "." cell). Available cells:
${legalMoves.join(', ')}

Reply with exactly: MOVE: <coordinate>`;
}

export function buildBattleshipRetryPrompt(invalidMove: string, legalMoves: string[]): string {
  const sample = legalMoves.slice(0, 60).join(', ');
  return `"${invalidMove}" is NOT allowed — you already fired there (or it is off the board). Do not reason, just answer.

Choose ONE coordinate from this unfired list and copy it exactly:
${sample}${legalMoves.length > 60 ? ', ...' : ''}

Reply with only: MOVE: <coordinate>`;
}

export function parseBattleshipMove(response: string): string | null {
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();
  const explicit = text.match(/MOVE[:\s]+([A-J](?:10|[1-9]))\b/i);
  if (explicit) return explicit[1].toUpperCase();
  const standalone = text.match(/\b([A-J](?:10|[1-9]))\b/i);
  if (standalone) return standalone[1].toUpperCase();
  return null;
}

// Legality-aware extraction: prefer the MOVE: coordinate if it is unfired,
// otherwise pick a legal (unfired) coordinate from the response — preferring
// the last one mentioned, since models usually state their final answer last.
export function extractBattleshipMove(response: string, legalMoves: string[]): string | null {
  const legal = new Set(legalMoves);
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  const explicit = text.match(/MOVE[:\s]+([A-J](?:10|[1-9]))\b/i);
  if (explicit && legal.has(explicit[1].toUpperCase())) return explicit[1].toUpperCase();

  const all = [...text.toUpperCase().matchAll(/\b([A-J](?:10|[1-9]))\b/g)].map((m) => m[1]);
  for (let i = all.length - 1; i >= 0; i--) {
    if (legal.has(all[i])) return all[i];
  }
  return null;
}
