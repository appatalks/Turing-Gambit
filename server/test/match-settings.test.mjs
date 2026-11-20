import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { MatchManager } from '../src/match-manager.ts';
import { createMockProvider } from './mock-provider.mjs';

test('match move limit, delay, retries and inherited/manual/automatic budgets are honored', { timeout: 10000 }, async (t) => {
  const { server, requests } = createMockProvider();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const manager = new MatchManager();
  const run = (config) => new Promise((resolve) => {
    manager.startMatch({ id: 'settings-test', emit: (event, state) => {
      if (event === 'match-state' && state.status === 'completed') resolve(state);
    } }, config);
  });
  const config = {
    game: 'chess', maxMoves: 10, moveDelayMs: 100, maxRetries: 1, maxTokens: 777,
    white: { type: 'generic-openai', model: 'retry-once', endpoint, settingsMode: 'manual', temperature: 0.9 },
    black: { type: 'lmstudio', model: 'gpt-4o', endpoint, settingsMode: 'auto' },
  };
  const start = Date.now();
  const state = await run(config);
  assert.equal(state.gameStatus, 'max_moves_reached');
  assert.equal(state.moveHistory.length, 20);
  assert.ok(Date.now() - start >= 1900, '19 inter-move delays of 100ms must not be skipped');
  assert.equal(requests.length, 21);
  assert.equal(state.moveHistory[0].retryCount, 1);
  assert.equal(requests[0].body.max_tokens, 777);
  assert.equal(requests[0].body.temperature, 0.9);
  assert.equal(requests[1].body.temperature, 0.7);
  assert.ok(requests.filter((r) => r.body.model === 'gpt-4o').every((r) => r.body.max_tokens === 2048));
  const previous = requests.length;
  const failure = await run({ ...config, maxRetries: 0, white: { ...config.white, model: 'always-invalid' } });
  assert.equal(failure.gameStatus, 'invalid_move_failure');
  assert.equal(failure.moveHistory.length, 0);
  assert.equal(requests.length - previous, 1);
});
