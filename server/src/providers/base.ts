import type { AIProvider, MoveRequest, MoveResponse, ProviderConfig } from '../types.js';

export class ProviderRequestError extends Error {
  constructor(readonly status: number, detail: string) {
    super(`Provider API error ${status}: ${detail}`);
  }

  get permanent(): boolean {
    return this.status >= 400 && this.status < 500 && ![408, 409, 425, 429].includes(this.status);
  }
}

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
   * `adaptRequest` may adjust provider-specific parameters and retry at the
   * same budget. It must return true only when it changes the next request.
   */
  protected async chatCompletionAdaptive(
    endpoint: string,
    headers: Record<string, string>,
    buildBody: (maxTokens: number) => object,
    extractResponse: (json: any) => { text: string; tokens?: number },
    startMaxTokens: number,
    adaptRequest?: (status: number, error: string) => boolean,
  ): Promise<MoveResponse> {
    const candidates = this.tokenCandidates(startMaxTokens);

    for (let i = 0; ; ) {
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
      if (adaptRequest?.(res.status, errText)) continue;

      const canDownshift = i < candidates.length - 1 && this.isTokenLimitError(res.status, errText);
      if (canDownshift) {
        console.log(`[${this.name}] Token budget ${mt} rejected — retrying smaller (${candidates[++i]})`);
        continue;
      }
      const key = this.config.apiKeyEnvVar && process.env[this.config.apiKeyEnvVar];
      const detail = key ? errText.replaceAll(key, '[redacted]') : errText;
      throw new ProviderRequestError(res.status, detail);
    }
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
    const tokenLimit = /(?:context[ _-]?(?:length|window)|max(?:imum)?[ _-]?(?:(?:completion|output)[ _-]?)?tokens|output tokens|token (?:count|limit))/i;
    const exceedsLimit = /exceed|too (?:large|long|many|high)|at most|must be (?:less|lower)|maximum|allowed|supports up to/i;
    const limit = tokenLimit.exec(msg);
    return /context_length_exceeded/i.test(msg)
      || (limit != null && exceedsLimit.test(msg.slice(limit.index + limit[0].length)))
      || /(?:exceed|too many|maximum number of).*(?:context|tokens)|reduce (?:the |your )?(?:length|number of tokens)/i.test(msg);
  }
}
