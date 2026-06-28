// ─── Strategy prompts for arcade games ───────────────────
// Instead of asking for one action per tick, we ask the model to write a
// JavaScript `decide(state)` function that will be executed many times.

const PONG_STATE_DOCS = `The \`state\` object has these fields:
- state.side: 'w' (left paddle) or 'b' (right paddle)
- state.ballX, state.ballY: ball position (0-13 x, 0-13 y)
- state.velX: -1 (moving left) or 1 (moving right)
- state.velY: -1 (up), 0 (flat), or 1 (down)
- state.myPaddle: your paddle center row (1-12, covers 3 rows)
- state.oppPaddle: opponent paddle center row
- state.myScore, state.oppScore: current scores (first to 3 wins)
- state.speed: ball sub-steps per tick (increases during rallies)
- state.courtWidth: 14, state.courtHeight: 14
- state.round: current tick number`;

const TRON_STATE_DOCS = `The \`state\` object has these fields:
- state.side: 'w' (cyan) or 'b' (orange)
- state.grid: grid size (18x18)
- state.myHead: { x, y } — your head position
- state.oppHead: { x, y } — opponent head position
- state.myDir: your current direction ('UP'|'DOWN'|'LEFT'|'RIGHT')
- state.oppDir: opponent's current direction
- state.occupied: array of "x,y" strings representing all occupied cells (trails)
- state.round: current tick number

Crashing into a wall (x<0, y<0, x>=grid, y>=grid), your own trail, or opponent trail = death.
You cannot reverse direction (e.g. if heading RIGHT, can't go LEFT).`;

const MARIO_STATE_DOCS = `The \`state\` object has these fields:
- state.side: 'w' (red runner) or 'b' (green runner)
- state.trackLength: total track length (finish at this index)
- state.myPos: your current cell position
- state.oppPos: opponent's current cell position
- state.track: string of characters ('G'=ground, 'P'=pit, '#'=pipe, 'F'=finish)
- state.nextCell: character at myPos+1
- state.cellAfter: character at myPos+2
- state.myFalls, state.oppFalls: fall counts
- state.onGround: true if on ground (can jump), false if mid-air
- state.stuckFrames: how many consecutive frames you haven't moved (>0 means stuck!)
- state.round: current tick number

The runner auto-moves forward. '#' (pipe) blocks forward motion — you MUST JUMP to clear it.
'P' (pit) on ground = fall & respawn. JUMP clears the next obstacle by going airborne.
If state.stuckFrames > 0, you're stuck behind a pipe — return 'JUMP' to get over it.`;

export function buildStrategyPrompt(game: string, side: 'w' | 'b', prevCode?: string, feedback?: string): string {
  const stateDocs = game === 'pong' ? PONG_STATE_DOCS
    : game === 'tron' ? TRON_STATE_DOCS
    : MARIO_STATE_DOCS;

  const actions = game === 'pong' ? "'UP', 'DOWN', or 'STAY'"
    : game === 'tron' ? "'UP', 'DOWN', 'LEFT', or 'RIGHT'"
    : "'RUN', 'JUMP', or 'WAIT'";

  const gameName = game === 'pong' ? 'Pong' : game === 'tron' ? 'Tron Light-Cycles' : 'Platform Race';

  let prompt = `You are writing an AI bot to play ${gameName}. Write a JavaScript function body that receives a \`state\` argument and returns one of: ${actions}.

${stateDocs}

Your function body will be executed MANY times per second — once per game tick. Write efficient, deterministic logic. You have access to standard Math functions. No async, no globals, no imports.

RULES:
- Return EXACTLY one action string (e.g., return 'UP';)
- The function body is the ONLY thing you output — no function declaration wrapper needed
- Think strategically: predict the future, not just react to the current frame
- You can use local variables, loops, and conditionals freely

`;

  if (prevCode && feedback) {
    prompt += `\nYour PREVIOUS strategy was:
\`\`\`javascript
${prevCode}
\`\`\`

RESULT of running it:
${feedback}

Analyze what went wrong and write an IMPROVED version. Learn from the outcome.\n\n`;
  } else {
    prompt += `This is your first attempt. Write a strong opening strategy.\n\n`;
  }

  prompt += `Respond with ONLY the function body (JavaScript code). No explanation, no markdown fences, no function wrapper. Just the code that goes inside the function.`;

  return prompt;
}

export function buildStrategyRetryPrompt(error: string, game: string): string {
  const actions = game === 'pong' ? "'UP', 'DOWN', or 'STAY'"
    : game === 'tron' ? "'UP', 'DOWN', 'LEFT', or 'RIGHT'"
    : "'RUN', 'JUMP', or 'WAIT'";

  return `Your strategy code failed to compile: ${error}

Write a corrected version. Rules:
- Pure JavaScript function body (no function declaration, no markdown)
- Must return one of: ${actions}
- No async/await, no require/import, no globals
- Receives \`state\` as the only argument

Respond with ONLY the corrected function body.`;
}

/**
 * Parse a strategy code response from the model.
 * Strips thinking blocks, markdown fences, and function wrappers.
 */
export function parseStrategyCode(response: string): string {
  // Strip <think> blocks
  let text = response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  if (!text) text = response.trim();

  // Strip markdown code fences
  text = text.replace(/^```(?:javascript|js|typescript|ts)?\n?/gm, '').replace(/^```\s*$/gm, '').trim();

  // If wrapped in a function declaration, extract the body
  const arrowMatch = text.match(/^(?:const|let|var)\s+\w+\s*=\s*\(?.*?\)?\s*=>\s*\{([\s\S]*)\}\s*;?\s*$/);
  if (arrowMatch) return arrowMatch[1].trim();

  const funcMatch = text.match(/^function\s*\w*\s*\(.*?\)\s*\{([\s\S]*)\}\s*$/);
  if (funcMatch) return funcMatch[1].trim();

  return text;
}
