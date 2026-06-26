import type { ChessPromptInput, RetryPromptInput, MoveRecord } from '../../types.js';

export function buildChessPrompt(input: ChessPromptInput): string {
  const historyStr = formatMoveHistory(input.moveHistory);
  const recentHistory = historyStr
    ? historyStr.split(' ').slice(-40).join(' ')
    : '';

  return `You are a chess engine playing as ${input.color}.

Position (FEN): ${input.fen}${recentHistory ? `\nRecent moves: ${recentHistory}` : ''}

Legal moves (UCI): ${input.legalMoves.join(', ')}

IMPORTANT: Your FIRST line of output must be your move in this format:
MOVE: <uci_move>

You may add brief analysis AFTER the MOVE line. The move MUST be from the legal moves list.`;
}

export function buildRetryPrompt(input: RetryPromptInput): string {
  return `Your previous answer "${input.invalidMove}" is not a legal move in this position.

Position (FEN): ${input.fen}
Legal moves (UCI): ${input.legalMoves.join(', ')}

You MUST pick exactly one move from this list. Respond with:
MOVE: <uci_move>`;
}

/** Primary parser: extract the most likely UCI move string */
export function parseMoveFromResponse(response: string): string | null {
  // Strip <think>...</think> blocks (Qwen, DeepSeek reasoning output)
  let text = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Also strip unclosed <think> blocks (model got cut off mid-reasoning)
  text = text.replace(/<think>[\s\S]*/gi, '').trim();
  if (!text) text = response.trim(); // fallback to full response

  // 1. Explicit MOVE: prefix
  const explicit = text.match(/MOVE[:\s]+[`"']?([a-h][1-8][a-h][1-8][qrbnQRBN]?)[`"']?/i);
  if (explicit) return explicit[1].toLowerCase();

  // 2. Backtick-wrapped UCI
  const backtick = text.match(/`([a-h][1-8][a-h][1-8][qrbnQRBN]?)`/);
  if (backtick) return backtick[1].toLowerCase();

  // 3. UCI on its own line
  const ownLine = text.match(/^([a-h][1-8][a-h][1-8][qrbnQRBN]?)$/m);
  if (ownLine) return ownLine[1].toLowerCase();

  // 4. Any word-bounded UCI (last match — often the final answer)
  const allUci = [...text.matchAll(/\b([a-h][1-8][a-h][1-8][qrbnQRBN]?)\b/g)];
  if (allUci.length > 0) return allUci[allUci.length - 1][1].toLowerCase();

  return null;
}

/** Extract ALL potential move strings (UCI + SAN) for fallback matching */
export function extractMoveCandidates(response: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const clean = s.replace(/[+#]$/, '');
    if (!seen.has(clean)) { seen.add(clean); candidates.push(clean); }
  };

  // UCI patterns (e2e4, g1f3, e7e8q)
  for (const m of response.matchAll(/\b([a-h][1-8][a-h][1-8][qrbnQRBN]?)\b/gi)) add(m[1].toLowerCase());

  // SAN piece moves (Nf3, Bxe5, Qd1, Rxh8)
  for (const m of response.matchAll(/\b([KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)\b/g)) add(m[1]);

  // SAN pawn moves (e4, exd5, e8=Q)
  for (const m of response.matchAll(/\b([a-h](?:x[a-h])?[1-8](?:=[QRBN])?[+#]?)\b/g)) add(m[1]);

  // Castling
  if (/O-O-O|0-0-0/i.test(response)) add('O-O-O');
  else if (/O-O|0-0/i.test(response)) add('O-O');

  return candidates;
}

function formatMoveHistory(history: MoveRecord[]): string {
  if (history.length === 0) return '';
  const pairs: string[] = [];
  for (let i = 0; i < history.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const white = history[i]?.san ?? '';
    const black = history[i + 1]?.san ?? '';
    pairs.push(black ? `${moveNum}. ${white} ${black}` : `${moveNum}. ${white}`);
  }
  return pairs.join(' ');
}
