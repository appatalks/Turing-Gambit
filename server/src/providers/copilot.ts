import { spawn, execFile, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import { BaseProvider } from './base.js';
import type { MoveRequest, MoveResponse } from '../types.js';

const execFileAsync = promisify(execFile);

// ─── Copilot ACP Provider ───────────────────────────────
// Uses a persistent process but creates a FRESH session per move.
// This gives each evaluation clean context (no accumulated history)
// while reusing the heavy subprocess + auth handshake.

export class CopilotProvider extends BaseProvider {
  readonly name = 'GitHub Copilot';
  private session: ACPSession | null = null;
  private ready: Promise<void> | null = null;

  async getMove(request: MoveRequest): Promise<MoveResponse> {
    if (!this.ready) {
      this.ready = this.boot();
    }
    await this.ready;

    const start = Date.now();

    // Fresh session per move — clean slate, no context bleed
    const sessionId = await this.session!.newSession();
    if (this.config.model && this.config.model !== 'default' && this.config.model !== 'auto') {
      await this.session!.selectModel(sessionId, this.config.model);
    }
    const response = await this.session!.prompt(sessionId, request.prompt, request.onChunk);

    // ACP doesn't report token usage — estimate from text length (~4 chars/token)
    const estimatedTokens = Math.ceil((request.prompt.length + response.length) / 4);

    return {
      rawResponse: response,
      tokensUsed: estimatedTokens,
      latencyMs: Date.now() - start,
    };
  }

  dispose(): void {
    if (this.session) {
      this.session.destroy();
      this.session = null;
      this.ready = null;
    }
  }

  private async boot(): Promise<void> {
    const proc = spawn('copilot', ['--acp', '--stdio', '--allow-all'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.session = new ACPSession(proc);
    await this.session.initialize();
    // Initial session just to warm up — will be discarded
    await this.session.newSession();
  }
}

// ─── Model discovery ────────────────────────────────────
// The Copilot CLI has no `--list-models` flag. Models are advertised
// by the ACP agent via a session/update notification on session/new.

let modelsCache: { models: CopilotModel[]; ts: number } | null = null;
const CACHE_TTL = 60_000;

export interface CopilotModel {
  modelId: string;
  name: string;
}

export async function listCopilotModels(): Promise<CopilotModel[]> {
  if (modelsCache && Date.now() - modelsCache.ts < CACHE_TTL) {
    return modelsCache.models;
  }

  const proc = spawn('copilot', ['--acp', '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const session = new ACPSession(proc);

  try {
    await session.initialize();
    await session.newSession();
    const models = session.getAvailableModels();
    if (models.length > 0) {
      modelsCache = { models, ts: Date.now() };
    }
    return models;
  } catch {
    return [];
  } finally {
    session.destroy();
  }
}

export async function isCopilotAvailable(): Promise<boolean> {
  try {
    await execFileAsync('copilot', ['--version'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

// ─── ACP Session (JSON-RPC 2.0 over NDJSON) ────────────

class ACPSession {
  private proc: ChildProcess;
  private idCounter = 0;
  private buffer = '';
  private accumulatedText = '';
  private chunkCallback: ((text: string) => void) | null = null;
  private availableModels: CopilotModel[] = [];
  private pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();
  private destroyed = false;

  constructor(proc: ChildProcess) {
    this.proc = proc;
    proc.stdout!.setEncoding('utf8');
    proc.stdout!.on('data', (chunk: string) => this.onData(chunk));
    proc.stderr!.on('data', () => {}); // drain
    proc.on('error', (err) =>
      this.rejectAll(new Error(`Copilot process error: ${err.message}`)),
    );
    proc.on('exit', (code) => {
      if (!this.destroyed)
        this.rejectAll(new Error(`Copilot exited with code ${code}`));
    });
  }

  async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {},
    });
  }

  async newSession(): Promise<string> {
    const result = await this.request('session/new', {
      cwd: process.cwd(),
      mcpServers: [],
    });
    const models = result?.models?.availableModels;
    if (Array.isArray(models)) {
      this.availableModels = models
        .filter((m: any) => m.modelId && m.modelId !== 'auto')
        .map((m: any) => ({ modelId: m.modelId, name: m.name ?? m.modelId }));
    }
    return result.sessionId;
  }

  getAvailableModels(): CopilotModel[] {
    return this.availableModels;
  }

  async selectModel(sessionId: string, modelId: string): Promise<void> {
    try {
      await this.request('session/set_model', { sessionId, modelId });
    } catch {
      // Non-fatal: fall back to the session default model
    }
  }

  async prompt(sessionId: string, text: string, onChunk?: (text: string) => void): Promise<string> {
    this.accumulatedText = '';
    this.chunkCallback = onChunk ?? null;
    await this.request('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text }],
    });
    this.chunkCallback = null;
    return this.accumulatedText;
  }

  destroy(): void {
    this.destroyed = true;
    this.rejectAll(new Error('Session destroyed'));
    try {
      this.proc.kill();
    } catch {}
  }

  // ── internals ─────────────────────────────────────

  private send(msg: object): void {
    if (this.proc.stdin?.writable) {
      this.proc.stdin.write(JSON.stringify(msg) + '\n');
    }
  }

  private request(method: string, params: object): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.idCounter;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`ACP '${method}' timed out (90 s)`));
      }, 90_000);

      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });

      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  private onData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        this.onMessage(JSON.parse(line));
      } catch {}
    }
  }

  private onMessage(msg: any): void {
    // Response to one of our requests
    if (msg.id != null && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
      else p.resolve(msg.result);
      return;
    }

    switch (msg.method) {
      case 'session/update': {
        const update = msg.params?.update;
        if (
          update?.sessionUpdate === 'agent_message_chunk' &&
          update?.content?.type === 'text'
        ) {
          this.accumulatedText += update.content.text;
          this.chunkCallback?.(this.accumulatedText);
        }
        break;
      }

      case 'session/request_permission':
        // Auto-grant: select the first "allow" option offered
        this.send({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            outcome: {
              outcome: 'selected',
              optionId: msg.params?.options?.[0]?.optionId ?? 'allow',
            },
          },
        });
        break;
    }
  }

  private rejectAll(error: Error): void {
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
  }
}
