import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MatchManager } from '../src/match-manager.ts';
import { OpenAIProvider } from '../src/providers/openai.ts';

const config = { type: 'openai', model: 'test-model', maxTokens: 1024 };
const success = { choices: [{ message: { content: 'e4' } }] };
const rejection = (param, code, message) => [400, { error: { param, code, message } }];

function mockRequests(t, replies) {
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    const reply = replies[bodies.length - 1];
    assert.ok(reply, 'Unexpected extra API request');
    return Response.json(reply[1], { status: reply[0] });
  });
  return bodies;
}

for (const temperatureFirst of [false, true]) {
  test(`remembers compatible parameters (${temperatureFirst ? 'temperature' : 'token field'} rejected first)`, async (t) => {
    const errors = [
      rejection('max_tokens', 'unsupported_parameter', 'Use max_completion_tokens instead'),
      rejection('temperature', 'unsupported_value', 'Only the default value is supported'),
    ];
    if (temperatureFirst) errors.reverse();
    const bodies = mockRequests(t, [...errors, [200, success], [200, success]]);
    const provider = new OpenAIProvider(config);
    assert.equal((await provider.getMove({ prompt: 'First move' })).rawResponse, 'e4');
    await provider.getMove({ prompt: 'Next move', temperature: 0.9 });
    assert.equal(bodies.length, 4);
    assert.equal(bodies[0].max_tokens, 1024);
    assert.equal(bodies[0].temperature, 0.3);
    assert.equal(bodies[1].max_tokens ?? bodies[1].max_completion_tokens, 1024);
    for (const body of bodies.slice(2)) {
      assert.equal(body.max_completion_tokens, 1024);
      assert.ok(!('max_tokens' in body));
      assert.ok(!('temperature' in body));
    }
  });
}

test('reduces the budget for a genuine limit without dropping temperature', async (t) => {
  const bodies = mockRequests(t, [
    rejection('max_tokens', 'invalid_value', 'max_tokens is too large: maximum is 512'),
    [200, success],
  ]);
  await new OpenAIProvider(config).getMove({ prompt: 'Move' });
  assert.deepEqual(bodies.map(({ max_tokens, temperature }) => [max_tokens, temperature]), [[1024, 0.3], [512, 0.3]]);
});

test('a low configured budget is never increased by the retry ladder', async (t) => {
  const bodies = mockRequests(t, [
    rejection('max_tokens', 'invalid_value', 'max_tokens is too large: maximum is 256'),
    [200, success],
  ]);
  await new OpenAIProvider({ ...config, maxTokens: 300 }).getMove({ prompt: 'Move' });
  assert.deepEqual(bodies.map((body) => body.max_tokens), [300, 256]);
});

test('empty reasoning output reports the budget error instead of an invalid move', async (t) => {
  const bodies = mockRequests(t, [[200, { choices: [{ message: { content: '' }, finish_reason: 'length' }] }]]);
  await assert.rejects(new OpenAIProvider(config).getMove({ prompt: 'Move' }), /completion budget was exhausted/);
  assert.equal(bodies.length, 1);
});

test('an unrelated request rejection ends the match without an invalid-move retry', async (t) => {
  const keyName = 'TG_MOCK_TEST_KEY';
  const previous = process.env[keyName];
  process.env[keyName] = 'test-key-not-a-real-credential';
  t.after(() => {
    if (previous === undefined) delete process.env[keyName];
    else process.env[keyName] = previous;
  });
  const bodies = mockRequests(t, [[404, { error: { code: 'model_not_found', message: 'Model is unavailable' } }]]);
  const manager = new MatchManager();
  const states = [];
  const error = await new Promise((resolve) => {
    manager.startMatch({
      id: 'mock-match',
      emit(event, data) {
        if (event === 'match-state') states.push(data);
        if (event === 'match-error') resolve(data);
      },
    }, {
      game: 'tictactoe',
      white: { ...config, apiKeyEnvVar: keyName },
      black: { type: 'human', model: 'human' },
      maxRetries: 5, maxMoves: 10, moveDelayMs: 0,
    });
  });
  assert.match(error, /404.*Model is unavailable/);
  assert.equal(bodies.length, 1);
  assert.equal(states.at(-1).status, 'completed');
  assert.equal(states.at(-1).gameStatus, 'provider_failure');
  assert.equal(states.at(-1).winner, null);
  assert.equal(states.at(-1).moveHistory.length, 0);
});
