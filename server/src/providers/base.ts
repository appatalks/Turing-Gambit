import type { AIProvider, MoveRequest, MoveResponse, ProviderConfig } from '../types.js';

export abstract class BaseProvider implements AIProvider {
  abstract readonly name: string;
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract getMove(request: MoveRequest): Promise<MoveResponse>;

  protected getEnvKey(envVar?: string): string {
    const key = envVar ? process.env[envVar] : undefined;
    if (!key && envVar) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return key ?? '';
  }

  protected async chatCompletion(
    endpoint: string,
    headers: Record<string, string>,
    body: object,
    extractResponse: (json: any) => { text: string; tokens?: number },
  ): Promise<MoveResponse> {
    const start = Date.now();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Provider API error ${res.status}: ${errText}`);
    }

    const json = await res.json();
    const latencyMs = Date.now() - start;
    const { text, tokens } = extractResponse(json);

    return { rawResponse: text, tokensUsed: tokens, latencyMs };
  }

  /**
   * Like chatCompletion, but starts with a generous output-token budget and
   * automatically retries with a smaller budget if the provider rejects the
   * request because the requested max_tokens / context length is too large.
   * `buildBody(maxTokens)` returns the request body for a given token budget.
   */
  protected async chatCompletionAdaptive(
    endpoint: string,
    headers: Record<string, string>,
    buildBody: (maxTokens: number) => object,
    extractResponse: (json: any) => { text: string; tokens?: number },
    startMaxTokens: number,
  ): Promise<MoveResponse> {
    const candidates = this.tokenCandidates(startMaxTokens);
    let lastErr = 'Unknown error';

    for (let i = 0; i < candidates.length; i++) {
      const mt = candidates[i];
      const start = Date.now();
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(buildBody(mt)),
          signal: AbortSignal.timeout(120_000),
        });
      } catch (e: any) {
        // Network/timeout — not a token-budget problem; don't downshift.
        throw new Error(`Provider request failed: ${e?.message ?? e}`);
      }

      if (res.ok) {
        const json = await res.json();
        const latencyMs = Date.now() - start;
        const { text, tokens } = extractResponse(json);
        return { rawResponse: text, tokensUsed: tokens, latencyMs };
      }

      const errText = await res.text().catch(() => 'Unknown error');
      lastErr = `${res.status}: ${errText}`;

      const canDownshift = i < candidates.length - 1 && this.isTokenLimitError(res.status, errText);
      if (canDownshift) {
        console.log(`[${this.name}] max_tokens ${mt} rejected — retrying smaller (${candidates[i + 1]})`);
        continue;
      }
      throw new Error(`Provider API error ${lastErr}`);
    }
    throw new Error(`Provider API error ${lastErr}`);
  }

  /** Descending list of output-token budgets to try, floored at 256. */
  private tokenCandidates(start: number): number[] {
    const out: number[] = [];
    let v = Math.max(256, Math.floor(start) || 256);
    while (v > 512) { out.push(v); v = Math.floor(v / 2); }
    out.push(512, 256);
    return [...new Set(out)];
  }

  /** Heuristic: does this error indicate the token budget / context is too large? */
  private isTokenLimitError(status: number, msg: string): boolean {
    if (status !== 400 && status !== 422 && status !== 413) return false;
    const m = (msg || '').toLowerCase();
    return /max_tokens|max_output|maximum.*token|output.*token|context[\s_]?length|too (large|long|many)|exceed|reduce the length/.test(m);
  }
}
