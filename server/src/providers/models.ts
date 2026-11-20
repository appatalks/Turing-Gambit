import type { ProviderConfig } from '../types.js';
import { listCopilotModels } from './copilot.js';
import { providerEndpoint, type ModelOption } from './model-settings.js';

function modelEndpoint(config: Pick<ProviderConfig, 'type' | 'endpoint'>): URL {
  const endpoint = new URL(providerEndpoint(config));
  endpoint.pathname = config.type === 'ollama'
    ? endpoint.pathname.replace(/\/chat$/, '/tags')
    : endpoint.pathname.replace(/\/(?:chat\/completions|messages)$/, '/models');
  endpoint.hash = '';
  return endpoint;
}

function approvedModelEndpoint(config: ProviderConfig): URL {
  const requested = modelEndpoint(config).toString();
  const approved = [
    'https://api.openai.com',
    'https://api.anthropic.com',
    'http://localhost:11434', 'http://127.0.0.1:11434',
    'http://localhost:1234', 'http://127.0.0.1:1234',
    process.env.OLLAMA_ENDPOINT,
    process.env.LMSTUDIO_ENDPOINT,
    ...(process.env.MODEL_ENDPOINT_ALLOWLIST || '').split(','),
  ];
  for (const raw of approved) {
    if (!raw?.trim()) continue;
    const endpoint = modelEndpoint({ type: config.type, endpoint: raw.trim() });
    if (endpoint.toString() === requested) return endpoint;
  }
  throw new Error('Model discovery endpoint is not approved. Add its base URL to MODEL_ENDPOINT_ALLOWLIST in the server environment, or enter the model ID manually.');
}

export async function listProviderModels(config: ProviderConfig, keys: Record<string, string> = {}): Promise<ModelOption[]> {
  if (config.type === 'human') return [];
  if (config.type === 'copilot') {
    const models = await listCopilotModels();
    if (!models.length) throw new Error('Copilot returned no models. Check CLI installation and authentication.');
    return models.map(({ modelId, name }) => ({ id: modelId, name }));
  }
  const endpoint = approvedModelEndpoint(config);
  const keyName = config.apiKeyEnvVar || (
    config.type === 'openai' ? 'OPENAI_API_KEY' :
    config.type === 'anthropic' ? 'ANTHROPIC_API_KEY' :
    config.type === 'generic-openai' ? 'CUSTOM_API_KEY' : undefined
  );
  const key = keyName ? keys[keyName] || process.env[keyName] : undefined;
  if (keyName && !key && config.type !== 'generic-openai') {
    throw new Error(`Save ${keyName} in Settings before refreshing models.`);
  }
  const headers: Record<string, string> = {};
  if (config.type === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01';
    if (key) headers['x-api-key'] = key;
  } else if (key) headers.Authorization = `Bearer ${key}`;
  const models: ModelOption[] = [];
  for (let page = 0; page < 20; page++) {
    const response = await fetch(endpoint, { headers, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      throw new Error(`Model discovery failed (HTTP ${response.status}). Check the endpoint and API key.`);
    }
    const json: { data?: unknown; models?: unknown; has_more?: boolean; last_id?: string } = await response.json();
    const entries = config.type === 'ollama' ? json.models : json.data;
    if (!Array.isArray(entries)) throw new Error('Model endpoint returned an unexpected response.');
    for (const item of entries as unknown[]) {
      if (!item || typeof item !== 'object') throw new Error('Model endpoint returned an invalid model entry.');
      const entry = item as Record<string, unknown>;
      const id: unknown = config.type === 'ollama' ? entry.name : entry.id;
      if (typeof id === 'string' && id) {
        models.push({ id, name: typeof entry.display_name === 'string' ? entry.display_name : id });
      }
    }
    if (config.type !== 'anthropic' || !json.has_more) {
      if (!models.length) throw new Error('No models were returned. Load a local model or check account access.');
      return [...new Map(models.map((model) => [model.id, model])).values()].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (!json.last_id) throw new Error('Model endpoint returned invalid pagination.');
    endpoint.searchParams.set('after_id', json.last_id);
  }
  throw new Error('Model list exceeded the pagination limit.');
}
