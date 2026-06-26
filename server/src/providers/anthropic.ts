import { BaseProvider } from './base.js';
import type { MoveRequest, MoveResponse } from '../types.js';

export class AnthropicProvider extends BaseProvider {
  readonly name = 'Anthropic';

  async getMove(request: MoveRequest): Promise<MoveResponse> {
    const apiKey = this.getEnvKey(this.config.apiKeyEnvVar);
    const endpoint = this.config.endpoint || 'https://api.anthropic.com/v1/messages';

    return this.chatCompletion(
      endpoint,
      {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      {
        model: this.config.model,
        max_tokens: this.config.maxTokens ?? 256,
        temperature: this.config.temperature ?? 0.3,
        messages: [{ role: 'user', content: request.prompt }],
      },
      (json) => ({
        text: json.content?.[0]?.text ?? '',
        tokens:
          (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
      }),
    );
  }
}
