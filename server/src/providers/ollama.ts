import { BaseProvider } from './base.js';
import type { MoveRequest, MoveResponse } from '../types.js';

export class OllamaProvider extends BaseProvider {
  readonly name = 'Ollama';

  async getMove(request: MoveRequest): Promise<MoveResponse> {
    const endpoint =
      (this.config.endpoint || process.env.OLLAMA_ENDPOINT || 'http://localhost:11434') +
      '/api/chat';

    const messages: { role: string; content: string }[] = [];
    if (request.system) messages.push({ role: 'system', content: request.system });
    messages.push({ role: 'user', content: request.prompt });

    return this.chatCompletionAdaptive(
      endpoint,
      {},
      (maxTokens) => ({
        model: this.config.model,
        messages,
        stream: false,
        options: {
          temperature: request.temperature ?? this.config.temperature ?? 0.3,
          num_predict: maxTokens,
        },
      }),
      (json) => ({
        text: json.message?.content ?? '',
        tokens: json.eval_count,
      }),
      this.config.maxTokens ?? 8192,
    );
  }
}
