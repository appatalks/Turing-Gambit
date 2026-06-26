import { BaseProvider } from './base.js';
import type { MoveRequest, MoveResponse } from '../types.js';

export class OpenAIProvider extends BaseProvider {
  readonly name = 'OpenAI';

  async getMove(request: MoveRequest): Promise<MoveResponse> {
    const apiKey = this.getEnvKey(this.config.apiKeyEnvVar);
    const endpoint = this.config.endpoint || 'https://api.openai.com/v1/chat/completions';

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return this.chatCompletion(
      endpoint,
      headers,
      {
        model: this.config.model,
        messages: [{ role: 'user', content: request.prompt }],
        temperature: this.config.temperature ?? 0.3,
        max_tokens: this.config.maxTokens ?? 256,
      },
      (json) => ({
        text: json.choices?.[0]?.message?.content ?? '',
        tokens: json.usage?.total_tokens,
      }),
    );
  }
}
