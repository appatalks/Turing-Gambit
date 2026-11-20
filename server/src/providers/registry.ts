import type { AIProvider, ProviderConfig } from '../types.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import { CopilotProvider } from './copilot.js';
import { isCopilotAvailable } from './copilot.js';
import { providerEndpoint, recommendedSettings } from './model-settings.js';

export function createProvider(config: ProviderConfig): AIProvider {
  if (config.settingsMode === 'auto') {
    const settings = recommendedSettings(config.type, config.model);
    config = { ...config, temperature: settings.temperature, maxTokens: settings.maxTokens };
  }
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider({
        ...config, endpoint: providerEndpoint(config),
        apiKeyEnvVar: config.apiKeyEnvVar ?? 'OPENAI_API_KEY',
      });
    case 'anthropic':
      return new AnthropicProvider({
        ...config, endpoint: providerEndpoint(config),
        apiKeyEnvVar: config.apiKeyEnvVar ?? 'ANTHROPIC_API_KEY',
      });
    case 'ollama':
      return new OllamaProvider(config);
    case 'lmstudio': {
      // LM Studio: OpenAI-compatible, no auth, well-known default port
      // Auto-append /v1/chat/completions when user enters just a base URL
      const lmsEndpoint = providerEndpoint(config);
      return new OpenAIProvider({
        ...config,
        endpoint: lmsEndpoint,
        apiKeyEnvVar: undefined,
      });
    }
    case 'generic-openai': {
      // Auto-append /v1/chat/completions when user enters just a base URL
      const keyName = config.apiKeyEnvVar || 'CUSTOM_API_KEY';
      return new OpenAIProvider({
        ...config,
        endpoint: providerEndpoint(config),
        apiKeyEnvVar: keyName === 'CUSTOM_API_KEY' && !process.env[keyName] ? undefined : keyName,
      });
    }
    case 'copilot':
      return new CopilotProvider(config);
    default:
      throw new Error(`Unknown provider type: ${(config as any).type}`);
  }
}

export async function checkAvailableProviders(): Promise<Record<string, { available: boolean; reason?: string }>> {
  const copilotOk = await isCopilotAvailable();
  return {
    openai: {
      available: !!process.env.OPENAI_API_KEY,
      reason: process.env.OPENAI_API_KEY ? undefined : 'OPENAI_API_KEY not set',
    },
    anthropic: {
      available: !!process.env.ANTHROPIC_API_KEY,
      reason: process.env.ANTHROPIC_API_KEY ? undefined : 'ANTHROPIC_API_KEY not set',
    },
    ollama: { available: true },
    lmstudio: { available: true },
    'generic-openai': { available: true },
    copilot: {
      available: copilotOk,
      reason: copilotOk ? undefined : 'copilot CLI not found — npm i -g @github/copilot && copilot auth login',
    },
  };
}
