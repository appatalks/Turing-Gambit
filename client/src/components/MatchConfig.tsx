import { useState, useEffect } from 'react';
import type { MatchConfig, ProviderConfig, ProviderType } from '../types';
import { PROVIDER_OPTIONS } from '../types';
import { GAME_CATEGORIES, gamesInCategory, GAMES_BY_ID } from '../lib/games';

interface Props {
  onStart: (config: MatchConfig) => void;
  autoPlay?: boolean;
  onToggleAutoPlay?: () => void;
}

const DEFAULT_CONFIG: MatchConfig = {
  game: 'chess',
  white: { type: 'ollama', model: 'llama3.1' },
  black: { type: 'ollama', model: 'llama3.1' },
  maxRetries: 5,
  moveDelayMs: 800,
  maxMoves: 200,
  maxTokens: 8192,
};

const STORAGE_KEY = 'tg-match-config';

function loadSavedConfig(): MatchConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_CONFIG;
}

export function MatchConfigPanel({ onStart, autoPlay, onToggleAutoPlay }: Props) {
  const [config, setConfig] = useState<MatchConfig>(loadSavedConfig);

  // Persist config changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const updatePlayer = (
    color: 'white' | 'black',
    updates: Partial<ProviderConfig>,
  ) => {
    setConfig((prev) => ({
      ...prev,
      [color]: { ...prev[color], ...updates },
    }));
  };

  const setProviderType = (color: 'white' | 'black', type: ProviderType) => {
    const opt = PROVIDER_OPTIONS.find((o) => o.value === type);
    updatePlayer(color, {
      type,
      model: opt?.defaultModel ?? '',
      endpoint: undefined,
    });
  };

  return (
    <div className="config-screen">
      {/* Left sidebar — game picker */}
      <aside className="config-sidebar">
        <div className="sidebar-header">Games</div>
        <nav className="sidebar-nav">
          {GAME_CATEGORIES.map((cat) => (
            <div key={cat.id} className="sidebar-group">
              <div className="sidebar-group-label">{cat.label}</div>
              {gamesInCategory(cat.id).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`sidebar-item ${config.game === g.id ? 'sidebar-item-active' : ''}`}
                  onClick={() => setConfig((c) => ({ ...c, game: g.id }))}
                  title={g.description}
                >
                  <span className="sidebar-item-icon">{g.icon}</span>
                  <span className="sidebar-item-name">{g.name}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Right — main config content */}
      <div className="config-main">
        <div className="config-header">
          <h1 className="config-title">
            <span className="title-icon">♔</span> Turing-Gambit{' '}
            <span className="title-icon">♚</span>
          </h1>
          <p className="config-subtitle text-secondary">
            {GAMES_BY_ID[config.game]?.icon} {GAMES_BY_ID[config.game]?.name} — {GAMES_BY_ID[config.game]?.description}
          </p>
        </div>

        {config.game === 'debate' && (
          <div className="debate-topic-input">
            <label>Debate topic (optional)</label>
            <input
              type="text"
              placeholder="Leave blank for a random resolution…"
              value={config.debateTopic || ''}
              onChange={(e) => setConfig((c) => ({ ...c, debateTopic: e.target.value }))}
            />
          </div>
        )}

        <div className="config-panels">
          <PlayerConfigCard
            color="white"
            provider={config.white}
            onTypeChange={(t) => setProviderType('white', t)}
            onUpdate={(u) => updatePlayer('white', u)}
          />
          <div className="config-vs">VS</div>
          <PlayerConfigCard
            color="black"
            provider={config.black}
            onTypeChange={(t) => setProviderType('black', t)}
            onUpdate={(u) => updatePlayer('black', u)}
          />
        </div>

        <div className="config-settings glass">
          <h3>Match Settings</h3>
          <div className="settings-grid">
            <div>
              <label>Max Retries (invalid moves)</label>
              <input
                type="number"
                min={0}
                max={10}
                value={config.maxRetries}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, maxRetries: +e.target.value }))
                }
              />
            </div>
            <div>
              <label>Move Delay (ms)</label>
              <input
                type="number"
                min={0}
                max={10000}
                step={100}
                value={config.moveDelayMs}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, moveDelayMs: +e.target.value }))
                }
              />
            </div>
            <div>
              <label>Max Moves per Side</label>
              <input
                type="number"
                min={10}
                max={500}
                value={config.maxMoves}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, maxMoves: +e.target.value }))
                }
              />
            </div>
            <div>
              <label>Max Tokens per Move</label>
              <input
                type="number"
                min={256}
                max={131072}
                step={256}
                value={config.maxTokens ?? 8192}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, maxTokens: +e.target.value }))
                }
              />
              <span className="field-hint">Output budget. Auto-shrinks if a model rejects it.</span>
            </div>
          </div>
        </div>

        <div className="config-start-row">
          {onToggleAutoPlay && (
            <label className="autoplay-toggle">
              <input type="checkbox" checked={!!autoPlay} onChange={onToggleAutoPlay} />
              <span>🔁 Auto-play (AI vs AI rematch)</span>
            </label>
          )}
          <button className="btn btn-primary btn-start" onClick={() => onStart(config)}>
            ▶ Start Match
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerConfigCard({
  color,
  provider,
  onTypeChange,
  onUpdate,
}: {
  color: 'white' | 'black';
  provider: ProviderConfig;
  onTypeChange: (type: ProviderType) => void;
  onUpdate: (updates: Partial<ProviderConfig>) => void;
}) {
  const isWhite = color === 'white';
  const opt = PROVIDER_OPTIONS.find((o) => o.value === provider.type);

  const [copilotModels, setCopilotModels] = useState<{ modelId: string; name: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (provider.type === 'copilot') {
      setLoadingModels(true);
      fetch('/api/copilot-models')
        .then((r) => r.json())
        .then((models: { modelId: string; name: string }[]) => {
          setCopilotModels(models);
          if (models.length > 0 && provider.model === 'default') {
            onUpdate({ model: models[0].modelId });
          }
        })
        .catch(() => setCopilotModels([]))
        .finally(() => setLoadingModels(false));
    }
  }, [provider.type]);

  const isCopilot = provider.type === 'copilot';
  const isHuman = provider.type === 'human';

  return (
    <div className={`glass config-card ${isWhite ? 'config-card-white' : 'config-card-black'}`}>
      <div className="config-card-header">
        <span className="config-piece">{isWhite ? '♔' : '♚'}</span>
        <span>{isWhite ? 'White' : 'Black'}</span>
      </div>

      <div className="config-field">
        <label>Provider</label>
        <select
          value={provider.type}
          onChange={(e) => onTypeChange(e.target.value as ProviderType)}
        >
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {opt && <p className="field-hint">{opt.description}</p>}
      </div>

      {isHuman ? (
        <div className="human-card-note">
          <span className="human-icon">🧑</span>
          <p>You'll move the pieces yourself when it's this side's turn. Drag a piece on the board to make your move.</p>
        </div>
      ) : (
        <>
          {/* Model: dropdown for Copilot, text input for others */}
          <div className="config-field">
            <label>Model</label>
            {isCopilot ? (
              loadingModels ? (
                <div className="field-hint">Discovering models...</div>
              ) : copilotModels.length > 0 ? (
                <select
                  value={provider.model}
                  onChange={(e) => onUpdate({ model: e.target.value })}
                >
                  {copilotModels.map((m) => (
                    <option key={m.modelId} value={m.modelId}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    value={provider.model}
                    onChange={(e) => onUpdate({ model: e.target.value })}
                    placeholder="Model name (e.g. claude-sonnet-4.6)"
                  />
                  <p className="field-hint" style={{ color: 'var(--warning)' }}>
                    Could not discover models. Is Copilot CLI installed?
                    <br />
                    <code>npm i -g @github/copilot && copilot auth login</code>
                  </p>
                </>
              )
            ) : (
              <input
                value={provider.model}
                onChange={(e) => onUpdate({ model: e.target.value })}
                placeholder="Model name"
              />
            )}
          </div>

          {opt?.needsEndpoint && (
            <div className="config-field">
              <label>Endpoint URL</label>
              <input
                value={provider.endpoint ?? ''}
                onChange={(e) => onUpdate({ endpoint: e.target.value || undefined })}
                placeholder={
                  provider.type === 'ollama'
                    ? 'http://localhost:11434'
                    : provider.type === 'lmstudio'
                      ? 'http://localhost:1234'
                      : 'http://host:port'
                }
              />
              {(provider.type === 'ollama' || provider.type === 'lmstudio') && (
                <p className="field-hint">
                  Leave blank for localhost default. The API path is added automatically.
                </p>
              )}
            </div>
          )}

          <div className="config-field-row">
            <div className="config-field">
              <label>Temperature</label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={provider.temperature ?? 0.3}
                onChange={(e) => onUpdate({ temperature: +e.target.value })}
              />
            </div>
            <div className="config-field">
              <label>Max Tokens</label>
              <input
                type="number"
                min={50}
                max={4096}
                step={50}
                value={provider.maxTokens ?? 2048}
                onChange={(e) => onUpdate({ maxTokens: +e.target.value })}
              />
            </div>
          </div>

          {opt?.keyEnvVar && (
            <p className="key-hint text-muted">
              Requires <code>{opt.keyEnvVar}</code> in server .env
            </p>
          )}
        </>
      )}
    </div>
  );
}
