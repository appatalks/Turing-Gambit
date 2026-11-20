import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { io } from '../../client/node_modules/socket.io-client/build/esm/index.js';
import { createMockProvider } from './mock-provider.mjs';

test('HTTP model discovery and Socket.IO matches use the same endpoint, keys and settings', { timeout: 20000 }, async (t) => {
  const { server: mock, requests } = createMockProvider();
  mock.listen(0, '127.0.0.1');
  await once(mock, 'listening');
  t.after(() => mock.close());
  const endpoint = `http://127.0.0.1:${mock.address().port}`;
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (data) => { if (String(data).includes('server listening')) resolve(); });
    child.once('exit', (code) => reject(new Error(`Test server exited with code ${code}`)));
    child.once('error', reject);
  });
  const base = `http://127.0.0.1:${port}`;
  const keys = { OPENAI_API_KEY: 'fake-e2e-openai', ANTHROPIC_API_KEY: 'fake-e2e-anthropic' };
  const white = { type: 'openai', model: 'gpt-6.1-terra', endpoint, settingsMode: 'auto' };
  const black = { type: 'anthropic', model: 'claude-opus-4-7', endpoint, settingsMode: 'auto' };
  const response = await fetch(`${base}/api/models`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: white, keys }),
  });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).models.some(({ id }) => id === white.model));
  const socket = io(base, { transports: ['websocket'] });
  t.after(() => socket.disconnect());
  await once(socket, 'connect');
  const config = { game: 'tictactoe', white, black, maxRetries: 5, maxMoves: 10, moveDelayMs: 0, maxTokens: 1024 };
  const complete = new Promise((resolve) => socket.on('match-state', (state) => {
    if (state.status === 'completed') resolve(state);
  }));
  socket.emit('start-match', { ...config, keys });
  const state = await complete;
  assert.equal(state.moveHistory.length, 7);
  assert.equal(state.gameStatus, 'x_wins');
  assert.equal(requests.length, 7);
  assert.ok(requests.filter((r) => r.body.model === white.model).every((r) => r.authorized && r.body.max_completion_tokens === 8192 && !('temperature' in r.body)));
  assert.ok(requests.filter((r) => r.body.model === black.model).every((r) => r.anthropicKey && r.body.max_tokens === 2048 && !('temperature' in r.body)));
  const error = once(socket, 'match-error');
  socket.emit('start-match', { ...config, white: { ...white, maxTokens: 999999 } });
  assert.match((await error)[0], /token budget/);
  assert.equal(requests.length, 7);
});
