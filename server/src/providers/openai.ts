import { BaseProvider, ProviderRequestError } from './base.js';
import type { MoveRequest, MoveResponse, ProviderConfig } from '../types.js';
import { recommendedSettings } from './model-settings.js';

export class OpenAIProvider extends BaseProvider {
  readonly name = 'OpenAI';
  private tokenField: 'max_tokens' | 'max_completion_tokens' = 'max_tokens';
  private omitTemperature = false;
  private reasoningEffort?: 'low';

  constructor(config: ProviderConfig) {
    super(config);
    if (config.settingsMode === 'auto') {
      const settings = recommendedSettings(config.type, config.model);
      this.tokenField = settings.tokenField ?? 'max_tokens';
      this.omitTemperature = settings.temperature === undefined;
      this.reasoningEffort = settings.reasoningEffort;
    }
  }

  private adaptRequest(status: number, body: string): boolean {
    if (status !== 400 && status !== 422) return false;
    let error: { code?: string; param?: string; message?: string } | undefined;
    try {
      error = JSON.parse(body)?.error;
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
    }
    const message = typeof error?.message === 'string' ? error.message : body;
    if (this.reasoningEffort && error?.param === 'reasoning_effort' &&
      ['unsupported_parameter', 'unsupported_value'].includes(error.code ?? '')) {
      this.reasoningEffort = undefined;
      console.log(`[${this.name}] Retrying without reasoning_effort`);
      return true;
    }

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
        ...(this.reasoningEffort && { reasoning_effort: this.reasoningEffort }),
      }),
      (json) => {
        const choice = json?.choices?.[0];
        const text = choice?.message?.content;
        if (typeof text !== 'string' || !text.trim()) {
          const detail = choice?.finish_reason === 'length'
            ? 'No visible model output: the completion budget was exhausted. Increase Max Tokens or use a lower reasoning effort.'
            : choice?.message?.refusal || 'The model returned no text for this move.';
          throw new ProviderRequestError(400, detail);
        }
        return { text, tokens: json.usage?.total_tokens };
      },
      this.config.maxTokens ?? 8192,
      (status, error) => this.adaptRequest(status, error),
    );
  }
}
