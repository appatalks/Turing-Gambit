import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { MatchManager } from './match-manager.js';
import { checkAvailableProviders } from './providers/registry.js';
import { listCopilotModels } from './providers/copilot.js';
import { listProviderModels } from './providers/models.js';

// Load .env — try cwd first, then parent (when run from server/)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => cb(null, true), // Allow all origins (local desktop app)
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Serve built client in production (web mode)
app.use(express.static(path.resolve(process.cwd(), 'client', 'dist')));
app.use(express.static(path.resolve(process.cwd(), '..', 'client', 'dist')));

// ── REST API ──────────────────────────────────────────

app.get('/api/providers', async (_req, res) => {
  res.json(await checkAvailableProviders());
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.1.4' });
});

app.get('/api/copilot-models', async (_req, res) => {
  const models = await listCopilotModels();
  res.json(models);
});

app.post('/api/models', async (req, res) => {
  const { provider, keys } = req.body;
  if (!provider || !['openai', 'anthropic', 'ollama', 'lmstudio', 'generic-openai', 'copilot', 'human'].includes(provider.type)) {
    res.status(400).json({ error: 'Choose a valid provider.' });
    return;
  }
  try {
    res.json({ models: await listProviderModels(provider, keys) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Models] ${message}`);
    res.status(400).json({ error: message });
  }
});

// ── Socket.IO ─────────────────────────────────────────

const matchManager = new MatchManager();

io.on('connection', (socket) => {
  console.log(`[Arena] Client connected: ${socket.id}`);

  socket.on('start-match', (payload) => {
    const { keys, ...config } = payload ?? {};
    if (keys && typeof keys === 'object') {
      for (const [k, v] of Object.entries(keys)) {
        if (typeof v === 'string' && v) process.env[k] = v;
      }
    }
    console.log(`[Arena] Starting match for ${socket.id}`);
    try {
      if (!Number.isInteger(config.maxRetries) || config.maxRetries < 0 || config.maxRetries > 10 ||
        !Number.isFinite(config.moveDelayMs) || config.moveDelayMs < 0 || config.moveDelayMs > 10000 ||
        !Number.isInteger(config.maxMoves) || config.maxMoves < 10 || config.maxMoves > 500) {
        throw new Error('Match settings are outside the allowed ranges.');
      }
      for (const player of [config.white, config.black]) {
        if (!player || typeof player.model !== 'string' || !player.model.trim()) throw new Error('Choose a model for each player.');
        if (player.temperature != null && (!Number.isFinite(player.temperature) || player.temperature < 0 ||
          player.temperature > (player.type === 'anthropic' ? 1 : 2))) throw new Error('Invalid player temperature.');
        if (player.maxTokens != null && (!Number.isInteger(player.maxTokens) || player.maxTokens < 256 || player.maxTokens > 131072)) {
          throw new Error('Player token budget must be between 256 and 131072.');
        }
      }
      if (config.maxTokens != null && (!Number.isInteger(config.maxTokens) || config.maxTokens < 256 || config.maxTokens > 131072)) {
        throw new Error('Match token budget must be between 256 and 131072.');
      }
      matchManager.startMatch(socket, config);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Arena] Cannot start match: ${message}`);
      socket.emit('match-error', message);
    }
  });

  socket.on('set-keys', (keys: Record<string, string>) => {
    for (const [k, v] of Object.entries(keys)) {
      if (typeof v === 'string' && v) process.env[k] = v;
    }
  });

  socket.on('pause-match', () => {
    matchManager.pauseMatch(socket.id);
  });

  socket.on('resume-match', () => {
    matchManager.resumeMatch(socket.id);
  });

  socket.on('step-match', () => {
    matchManager.stepMatch(socket.id);
  });

  socket.on('human-move', (uci: string) => {
    matchManager.submitHumanMove(socket.id, uci);
  });

  socket.on('reset-match', () => {
    matchManager.resetMatch(socket.id);
    socket.emit('match-reset');
  });

  socket.on('export-match', () => {
    const data = matchManager.exportMatch(socket.id);
    socket.emit('match-export', data);
  });

  socket.on('disconnect', () => {
    console.log(`[Arena] Client disconnected: ${socket.id}`);
    matchManager.stopMatchForSocket(socket.id);
  });
});

// ── Start ─────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, async () => {
  console.log(`\n  ♔  AI Chess Arena server listening on http://localhost:${PORT}\n`);
  const providers = await checkAvailableProviders();
  for (const [name, info] of Object.entries(providers)) {
    const icon = info.available ? '✓' : '✗';
    console.log(`  ${icon}  ${name}${info.reason ? ` (${info.reason})` : ''}`);
  }
  console.log();
});
