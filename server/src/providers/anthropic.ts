import { BaseProvider } from './base.js';
import type { MoveRequest, MoveResponse } from '../types.js';

export class AnthropicProvider extends BaseProvider {
  readonly name = 'Anthropic';
  private omitTemperature = false;

  async getMove(request: MoveRequest): Promise<MoveResponse> {
    const apiKey = this.getEnvKey(this.config.apiKeyEnvVar);
    const endpoint = this.config.endpoint || 'https://api.anthropic.com/v1/messages';

    return this.chatCompletionAdaptive(
      endpoint,
      {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      (maxTokens) => ({
        model: this.config.model,
        max_tokens: maxTokens,
        ...(!this.omitTemperature && !(this.config.settingsMode === 'auto' && this.config.temperature === undefined) &&
          { temperature: request.temperature ?? this.config.temperature ?? 0.3 }),
        ...(request.system ? { system: request.system } : {}),
        messages: [{ role: 'user', content: request.prompt }],
      }),
      (json) => ({
        text: json.content?.[0]?.text ?? '',
        tokens:
          (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
      }),
      this.config.maxTokens ?? 8192,
      (status, error) => {
        if (status === 400 && !this.omitTemperature &&
          /temperature.*(?:not supported|unsupported)|(?:unsupported|not supported).*temperature/i.test(error)) {
          this.omitTemperature = true;
          console.log(`[${this.name}] Retrying without temperature`);
          return true;
        }
        return false;
      },
    );
  }
}
