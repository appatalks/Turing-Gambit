import { BaseProvider } from './base.js';
import type { MoveRequest, MoveResponse } from '../types.js';

// GitHub Models API — uses a GitHub PAT with "Models" scope.
// Endpoint: https://models.github.ai/inference/chat/completions
// Models use publisher/model format: openai/gpt-4o, meta/llama-4-maverick-17b-128e-instruct-fp8
// See: https://github.com/marketplace/models/catalog

export class AzureGitHubProvider extends BaseProvider {
  readonly name = 'GitHub Models';

  async getMove(request: MoveRequest): Promise<MoveResponse> {
    const token = this.getEnvKey(this.config.apiKeyEnvVar || 'GITHUB_TOKEN');
    const endpoint =
      this.config.endpoint ||
      process.env.GITHUB_MODELS_ENDPOINT ||
      'https://models.github.ai/inference/chat/completions';

    const messages: { role: string; content: string }[] = [];
    if (request.system) messages.push({ role: 'system', content: request.system });
    messages.push({ role: 'user', content: request.prompt });

    return this.chatCompletion(
      endpoint,
      { Authorization: `Bearer ${token}` },
      {
        model: this.config.model,
        messages,
        temperature: request.temperature ?? this.config.temperature ?? 0.3,
        max_tokens: this.config.maxTokens ?? 2048,
      },
      (json) => ({
        text: json.choices?.[0]?.message?.content ?? '',
        tokens: json.usage?.total_tokens,
      }),
    );
  }
}
