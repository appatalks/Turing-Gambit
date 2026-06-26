const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');

const isDev = !app.isPackaged;
const SERVER_PORT = 3001;
const APP_VERSION = require('../package.json').version;
const GITHUB_REPO = 'appatalks/Turing-Gambit';

let mainWindow = null;
let serverProcess = null;

// ── Auto-update check ───────────────────────────────

function checkForUpdates() {
  // Skip if disabled in prefs
  const prefsPath = path.join(app.getPath('userData'), 'prefs.json');
  try {
    const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
    if (prefs.autoUpdate === false) return;
  } catch {}

  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  https.get(url, { headers: { 'User-Agent': 'Turing-Gambit/' + APP_VERSION } }, (res) => {
    let body = '';
    res.on('data', (c) => body += c);
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        const latest = data.tag_name?.replace(/^v/, '');
        if (latest && latest !== APP_VERSION && compareVersions(latest, APP_VERSION) > 0) {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `Turing-Gambit v${latest} is available (you have v${APP_VERSION}).`,
            buttons: ['Download', 'Later'],
            defaultId: 0,
          }).then((result) => {
            if (result.response === 0) {
              shell.openExternal(`https://github.com/${GITHUB_REPO}/releases/latest`);
            }
          });
        }
      } catch {}
    });
  }).on('error', () => {});
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// ── .env loader (no external deps) ──────────────────

function loadEnvFile() {
  const candidates = [
    path.join(app.getPath('userData'), '.env'),
    path.join(__dirname, '..', '.env'),
  ];
  if (!isDev && process.resourcesPath) {
    candidates.unshift(path.join(process.resourcesPath, '.env'));
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      for (const line of lines) {
        const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
      console.log(`[arena] Loaded env from ${p}`);
      return;
    }
  }
}

// ── Server ──────────────────────────────────────────

function startServer() {
  if (isDev) return; // dev uses separate `npm run dev`

  const serverPath = path.join(process.resourcesPath, 'server.cjs');

  serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: String(SERVER_PORT), NODE_ENV: 'production' },
    silent: true,
  });

  serverProcess.stdout?.on('data', (d) => console.log(`[server] ${d.toString().trim()}`));
  serverProcess.stderr?.on('data', (d) => console.error(`[server] ${d.toString().trim()}`));
  serverProcess.on('error', (err) => console.error('Server error:', err));
}

function waitForServer(timeoutMs = 15000) {
  if (isDev) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (Date.now() > deadline) return reject(new Error('Server start timeout'));
      http
        .get(`http://localhost:${SERVER_PORT}/api/health`, (res) => {
          if (res.statusCode === 200) resolve();
          else setTimeout(check, 150);
        })
        .on('error', () => setTimeout(check, 150));
    };
    check();
  });
}

// ── Window ──────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: 'Turing-Gambit',
    icon: path.join(__dirname, 'resources', 'icon.png'),
    backgroundColor: '#00000000',
    transparent: true,
    frame: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: true,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Check for updates 3s after window shows (non-blocking)
    if (!isDev) setTimeout(checkForUpdates, 3000);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Window control IPC ──────────────────────────────

ipcMain.on('win-minimize', () => mainWindow?.minimize());
ipcMain.on('win-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('win-close', () => mainWindow?.close());

// ── Lifecycle ───────────────────────────────────────

app.whenReady().then(async () => {
  loadEnvFile();
  startServer();
  try {
    await waitForServer();
  } catch (e) {
    console.error(e.message);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
