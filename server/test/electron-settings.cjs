const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-electron-e2e-'));
app.setPath('userData', userData);
const loadURL = BrowserWindow.prototype.loadURL;
BrowserWindow.prototype.loadURL = function () {
  this.webContents.once('did-finish-load', () => testSettings(this));
  return loadURL.call(this, process.env.TG_E2E_URL || 'http://127.0.0.1:43123');
};

const timer = setTimeout(() => {
  console.error('Electron settings test timed out');
  app.exit(1);
}, 20000);
app.on('quit', () => {
  clearTimeout(timer);
  fs.rmSync(userData, { recursive: true, force: true });
});

async function testSettings(window) {
  try {
    await window.webContents.executeJavaScript(`
      document.querySelector('[title="Settings"]').click();
    `);
    await window.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const deadline = Date.now() + 3000;
        function check() {
          const input = Array.from(document.querySelectorAll('input[type="checkbox"]'))
            .find(el => el.parentElement.textContent.includes('Check for updates on launch'));
          if (input) { if (input.disabled) reject(new Error('Desktop update preference is disabled')); else { input.click(); resolve(); } }
          else if (Date.now() > deadline) reject(new Error('Settings did not render'));
          else setTimeout(check, 20);
        }
        check();
      });
    `);
    assert.equal(await window.webContents.executeJavaScript('window.electronAPI.getAutoUpdate()'), false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'prefs.json'), 'utf8')).autoUpdate, false);
    await new Promise((resolve) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.reload();
    });
    assert.equal(await window.webContents.executeJavaScript('window.electronAPI.getAutoUpdate()'), false);
    await window.webContents.executeJavaScript('window.electronAPI.setAutoUpdate(true)');
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'prefs.json'), 'utf8')).autoUpdate, true);
    console.log('PASS: real Electron renderer -> preload -> IPC -> persisted update preference, including reload');
    app.exit(0);
  } catch (err) {
    console.error(err.message);
    app.exit(1);
  }
}

require('../../electron/main.cjs');
