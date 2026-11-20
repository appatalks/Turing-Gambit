import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

test('Electron IPC persists update preference and exposes it through preload', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tg-prefs-test-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const handlers = new Map();
  const require = createRequire(import.meta.url);
  const electron = {
    app: { isPackaged: false, disableHardwareAcceleration() {}, commandLine: { appendSwitch() {} },
      getPath: () => dir, whenReady: () => ({ then() {} }), on() {} },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler), on() {} },
  };
  const filename = path.resolve(import.meta.dirname, '../../electron/main.cjs');
  runInNewContext(readFileSync(filename, 'utf8'), {
    require: (name) => name === 'electron' ? electron : name === '../package.json' ? {} : require(name),
    __dirname: path.dirname(filename), process, console,
  });
  const get = handlers.get('get-auto-update');
  const set = handlers.get('set-auto-update');
  assert.equal(get(), true);
  set(null, false);
  assert.equal(get(), false);
  set(null, true);
  assert.equal(get(), true);
  assert.throws(() => set(null, 'false'), /boolean/);
  writeFileSync(path.join(dir, 'prefs.json'), 'broken');
  assert.throws(get, /JSON/);
  let api;
  runInNewContext(readFileSync(path.resolve(import.meta.dirname, '../../electron/preload.cjs'), 'utf8'), {
    require: () => ({
      contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } },
      ipcRenderer: { invoke: async (name, value) => handlers.get(name)(null, value) },
    }),
  });
  writeFileSync(path.join(dir, 'prefs.json'), '{}');
  return api.setAutoUpdate(false).then(async () => assert.equal(await api.getAutoUpdate(), false));
});
