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
      signal: AbortSignal.timeout(60_000),
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
}
