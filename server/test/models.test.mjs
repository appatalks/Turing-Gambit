import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createProvider } from '../src/providers/registry.ts';
import { listProviderModels } from '../src/providers/models.ts';
import { recommendedSettings, providerEndpoint } from '../src/providers/model-settings.ts';
import { createMockProvider } from './mock-provider.mjs';

test('balanced profiles and endpoint normalization', () => {
  assert.deepEqual(recommendedSettings('openai', 'gpt-6.1-terra').reasoningEffort, 'low');
  assert.equal(recommendedSettings('anthropic', 'claude-opus-4-7').temperature, undefined);
  assert.equal(recommendedSettings('openai', 'gpt-4o').temperature, 0.3);
  assert.equal(providerEndpoint({ type: 'lmstudio', endpoint: 'http://localhost:1234/v1/' }), 'http://localhost:1234/v1/chat/completions');
  assert.equal(providerEndpoint({ type: 'ollama', endpoint: 'http://localhost:11434/api/chat' }), 'http://localhost:11434/api/chat');
  assert.equal(providerEndpoint({ type: 'ollama', endpoint: 'http://localhost:11434/api/' }), 'http://localhost:11434/api/chat');
  assert.equal(providerEndpoint({ type: 'anthropic', endpoint: 'https://api.anthropic.com/v1/' }), 'https://api.anthropic.com/v1/messages');
  assert.throws(() => providerEndpoint({ type: 'generic-openai' }), /endpoint URL/);
});

test('all HTTP provider adapters discover models and use automatic or manual settings', async (t) => {
  const { server, requests } = createMockProvider();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const keyName = 'TG_PROVIDER_TEST_KEY';
  process.env[keyName] = 'fake-local-test-key';
  t.after(() => delete process.env[keyName]);
  for (const type of ['openai', 'generic-openai', 'anthropic', 'ollama', 'lmstudio']) {
    const model = type === 'anthropic' ? 'claude-opus-4-7' : type === 'ollama' ? 'llama3.1' : type === 'lmstudio' ? 'gpt-4o' : 'gpt-6.1-terra';
    const config = { type, model, endpoint, apiKeyEnvVar: type === 'lmstudio' || type === 'ollama' ? undefined : keyName, settingsMode: 'auto' };
    const models = await listProviderModels(config);
    assert.ok(models.some(({ id }) => id === model));
    const provider = createProvider(config);
    assert.equal((await provider.getMove({ prompt: 'Available positions: 3, 4' })).rawResponse, 'MOVE: 3');
    const request = requests.at(-1);
    if (type === 'openai' || type === 'generic-openai') {
      assert.equal(request.body.max_completion_tokens, 8192);
      assert.equal(request.body.reasoning_effort, 'low');
      assert.ok(!('temperature' in request.body));
    } else if (type === 'ollama') {
      assert.deepEqual(request.body.options, { temperature: 0.3, num_predict: 2048 });
    } else {
      assert.equal(request.body.max_tokens, 2048);
    }
  }
  const manual = createProvider({ type: 'openai', model: 'gpt-4o', endpoint, apiKeyEnvVar: keyName, settingsMode: 'manual', maxTokens: 4096, temperature: 0.9 });
  await manual.getMove({ prompt: 'Available positions: 5' });
  assert.equal(requests.at(-1).body.temperature, 0.9);
  assert.equal(requests.at(-1).body.max_tokens, 4096);
  const noAuth = createProvider({ type: 'generic-openai', model: 'gpt-4o', endpoint, apiKeyEnvVar: 'CUSTOM_API_KEY', settingsMode: 'auto' });
  await noAuth.getMove({ prompt: 'Available positions: 2' });
  assert.equal(requests.at(-1).authorized, !!process.env.CUSTOM_API_KEY);
});
