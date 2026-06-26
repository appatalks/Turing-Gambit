import { BaseProvider } from './base.js';
import type { MoveRequest, MoveResponse } from '../types.js';

export class OllamaProvider extends BaseProvider {
  readonly name = 'Ollama';

  async getMove(request: MoveRequest): Promise<MoveResponse> {
    const endpoint =
      (this.config.endpoint || process.env.OLLAMA_ENDPOINT || 'http://localhost:11434') +
      '/api/chat';

    return this.chatCompletion(
      endpoint,
      {},
      {
        model: this.config.model,
        messages: [{ role: 'user', content: request.prompt }],
        stream: false,
        options: {
          temperature: this.config.temperature ?? 0.3,
          num_predict: this.config.maxTokens ?? 256,
        },
      },
      (json) => ({
        text: json.message?.content ?? '',
        tokens: json.eval_count,
      }),
    );
  }
}
