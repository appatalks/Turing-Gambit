import { BaseProvider } from './base.js';
import type { MoveRequest, MoveResponse } from '../types.js';

export class OpenAIProvider extends BaseProvider {
  readonly name = 'OpenAI';
  private tokenField: 'max_tokens' | 'max_completion_tokens' = 'max_tokens';
  private omitTemperature = false;

  private adaptRequest(status: number, body: string): boolean {
    if (status !== 400 && status !== 422) return false;
    let error: { code?: string; param?: string; message?: string } | undefined;
    try {
      error = JSON.parse(body)?.error;
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
    }
    const message = typeof error?.message === 'string' ? error.message : body;

    if (this.tokenField === 'max_tokens' && (
      (error?.param === 'max_tokens' && error.code === 'unsupported_parameter') ||
      /\bmax_tokens\b['"`]?\s+(?:is\s+)?(?:not supported|unsupported)|(?:unsupported|unknown) parameter:\s*['"`]?\bmax_tokens\b|\bmax_completion_tokens\b['"`]?\s+instead/i.test(message)
    )) {
      this.tokenField = 'max_completion_tokens';
      console.log(`[${this.name}] Retrying with max_completion_tokens`);
      return true;
    }

    if (!this.omitTemperature && (
      (error?.param === 'temperature' && ['unsupported_parameter', 'unsupported_value'].includes(error.code ?? '')) ||
      /(?:unsupported|unknown) parameter:\s*['"`]?\btemperature\b|\btemperature\b['"`]?\s+(?:is\s+)?(?:not supported|unsupported)|\btemperature\b.*only (?:the )?default(?: value)?/i.test(message)
    )) {
      this.omitTemperature = true;
      console.log(`[${this.name}] Retrying without temperature`);
      return true;
    }
    return false;
  }

  async getMove(request: MoveRequest): Promise<MoveResponse> {
    const apiKey = this.getEnvKey(this.config.apiKeyEnvVar);
    const endpoint = this.config.endpoint || 'https://api.openai.com/v1/chat/completions';

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const messages: { role: string; content: string }[] = [];
    if (request.system) messages.push({ role: 'system', content: request.system });
    messages.push({ role: 'user', content: request.prompt });

    return this.chatCompletionAdaptive(
      endpoint,
      headers,
      (maxTokens) => ({
        model: this.config.model,
        messages,
        ...(!this.omitTemperature && { temperature: request.temperature ?? this.config.temperature ?? 0.3 }),
        [this.tokenField]: maxTokens,
      }),
      (json) => ({
        text: json.choices?.[0]?.message?.content ?? '',
        tokens: json.usage?.total_tokens,
      }),
      this.config.maxTokens ?? 8192,
      (status, error) => this.adaptRequest(status, error),
    );
  }
}
