import type { ProviderConfig, ProviderType } from '../types.js';

export interface ModelSettings {
  temperature?: number;
  maxTokens: number;
  tokenField?: 'max_tokens' | 'max_completion_tokens';
  reasoningEffort?: 'low';
  note: string;
}

export interface ModelOption {
  id: string;
  name: string;
}

export function recommendedSettings(type: ProviderType, model: string): ModelSettings {
  if (type === 'human') return { maxTokens: 0, note: 'No model settings are needed.' };
  if (type === 'copilot') {
    return { maxTokens: 8192, note: 'Copilot manages sampling and output limits; these cannot be overridden through ACP.' };
  }
  const openAI = type === 'openai' || type === 'generic-openai';
  const reasoning = openAI && /^(?:openai\/)?(?:gpt-[56](?:[.-]|$)|o[134](?:[.-]|$))/i.test(model);
  if (reasoning) {
    return {
      maxTokens: 8192,
      tokenField: 'max_completion_tokens',
      reasoningEffort: 'low',
      note: 'Reasoning model: low effort, provider-default sampling, and an 8192-token budget including reasoning.',
    };
  }
  const modernClaude = type === 'anthropic' &&
    /claude-(?:(?:opus|sonnet|haiku)-(?:4-[7-9]|[5-9])|mythos)/i.test(model);
  return {
    temperature: modernClaude ? undefined : 0.3,
    maxTokens: 2048,
    tokenField: openAI || type === 'lmstudio' ? 'max_tokens' : undefined,
    note: modernClaude
      ? 'Claude manages sampling; use a 2048-token output budget.'
      : 'Balanced gameplay: temperature 0.3 and a 2048-token output budget. Unknown models adapt to explicit API rejections.',
  };
}

export function providerEndpoint(config: Pick<ProviderConfig, 'type' | 'endpoint'>): string {
  const defaults: Partial<Record<ProviderType, string>> = {
    openai: 'https://api.openai.com',
    anthropic: 'https://api.anthropic.com',
    ollama: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
    lmstudio: process.env.LMSTUDIO_ENDPOINT || 'http://localhost:1234',
  };
  const raw = config.endpoint || defaults[config.type];
  if (!raw) throw new Error('Enter an endpoint URL for this provider.');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Endpoint must use HTTP or HTTPS.');
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (config.type === 'ollama') {
    if (!url.pathname.endsWith('/api/chat')) url.pathname += url.pathname.endsWith('/api') ? '/chat' : '/api/chat';
  } else if (config.type === 'anthropic') {
    if (!url.pathname.endsWith('/messages')) url.pathname += url.pathname.endsWith('/v1') ? '/messages' : '/v1/messages';
  } else if (!url.pathname.endsWith('/chat/completions')) {
    url.pathname += url.pathname.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
  }
  return url.toString();
}
