import { useState, useEffect } from 'react';
import type { MatchConfig, ProviderConfig, ProviderType } from '../types';
import { PROVIDER_OPTIONS } from '../types';
import { GAME_CATEGORIES, gamesInCategory, GAMES_BY_ID } from '../lib/games';
import { recommendedSettings, type ModelOption } from '../../../server/src/providers/model-settings';
import { loadSavedKeys } from './SettingsModal';
import { apiUrl } from '../lib/server-url';

interface Props {
  onStart: (config: MatchConfig) => void;
  autoPlay?: boolean;
  onToggleAutoPlay?: () => void;
}

const DEFAULT_CONFIG: MatchConfig = {
  game: 'chess',
  white: { type: 'ollama', model: 'llama3.1', settingsMode: 'auto' },
  black: { type: 'ollama', model: 'llama3.1', settingsMode: 'auto' },
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
      apiKeyEnvVar: opt?.keyEnvVar,
      temperature: undefined,
      maxTokens: undefined,
      settingsMode: 'auto',
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
      <form className="config-main" onSubmit={(event) => { event.preventDefault(); onStart(config); }}>
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
              <label htmlFor="max-retries">Max Retries (invalid moves)</label>
              <input
                id="max-retries"
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
              <label htmlFor="move-delay">Move Delay (ms)</label>
              <input
                id="move-delay"
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
              <label htmlFor="max-moves">Max Moves per Side</label>
              <input
                id="max-moves"
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
              <label htmlFor="match-tokens">Max Tokens per Move</label>
              <input
                id="match-tokens"
                type="number"
                min={256}
                max={131072}
                step={1}
                value={config.maxTokens ?? 8192}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, maxTokens: +e.target.value }))
                }
              />
              <span className="field-hint">Default for manual settings without a per-player limit. Automatic mode uses the model's balanced budget.</span>
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
          <button className="btn btn-primary btn-start" type="submit">
            ▶ Start Match
          </button>
        </div>
      </form>
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

  const [models, setModels] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const settings = recommendedSettings(provider.type, provider.model);
  const automatic = provider.settingsMode === 'auto';

  useEffect(() => {
    setModels([]);
    setModelError(null);
    if (provider.type === 'human') return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingModels(true);
      try {
        const response = await fetch(apiUrl('/api/models'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, keys: loadSavedKeys() }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Model discovery failed (${response.status})`);
        if (!Array.isArray(data.models)) throw new Error('Invalid model list from server.');
        if (!controller.signal.aborted) setModels(data.models);
      } catch (err) {
        if (!controller.signal.aborted) setModelError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) setLoadingModels(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [provider.type, provider.endpoint, provider.apiKeyEnvVar, refresh]);

  const isCopilot = provider.type === 'copilot';
  const isHuman = provider.type === 'human';

  return (
    <div className={`glass config-card ${isWhite ? 'config-card-white' : 'config-card-black'}`}>
      <div className="config-card-header">
        <span className="config-piece">{isWhite ? '♔' : '♚'}</span>
        <span>{isWhite ? 'White' : 'Black'}</span>
      </div>

      <div className="config-field">
        <label htmlFor={`${color}-provider`}>Provider</label>
        <select
          id={`${color}-provider`}
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
          <div className="config-field">
            <label htmlFor={`${color}-model-picker`}>Available Models</label>
            <select id={`${color}-model-picker`} value={models.some((m) => m.id === provider.model) ? provider.model : ''}
              onChange={(e) => { if (e.target.value) onUpdate({ model: e.target.value }); }}>
              <option value="">Custom model ID (enter below)</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button className="btn btn-secondary" type="button" disabled={loadingModels}
              onClick={() => setRefresh((value) => value + 1)}>Refresh Models</button>
            {loadingModels && <p className="field-hint">Discovering models...</p>}
            {modelError && <p role="alert" className="field-hint" style={{ color: 'var(--warning)' }}>{modelError} You can still enter a model ID manually.</p>}
            <label htmlFor={`${color}-model`}>Model ID</label>
            <input id={`${color}-model`} required value={provider.model}
              onChange={(e) => onUpdate({ model: e.target.value })} placeholder="Exact provider model ID" />
          </div>

          {!isCopilot && (
            <div className="config-field">
              <label htmlFor={`${color}-endpoint`}>Endpoint URL</label>
              <input
                id={`${color}-endpoint`}
                type="url"
                required={provider.type === 'generic-openai'}
                value={provider.endpoint ?? ''}
                onChange={(e) => onUpdate({ endpoint: e.target.value || undefined })}
                placeholder={
                  provider.type === 'ollama'
                    ? 'http://localhost:11434'
                    : provider.type === 'lmstudio'
                      ? 'http://localhost:1234'
                      : provider.type === 'openai'
                        ? 'https://api.openai.com'
                        : provider.type === 'anthropic'
                          ? 'https://api.anthropic.com'
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

          <label className="field-hint">
            <input type="checkbox" checked={automatic}
              onChange={(e) => onUpdate({ settingsMode: e.target.checked ? 'auto' : 'manual', temperature: undefined, maxTokens: undefined })} />
            Use balanced model settings
          </label>
          <p className="field-hint">{automatic ? settings.note : 'Advanced/manual overrides. Unsupported parameters may still be adapted by the provider.'}</p>
          {!automatic && !isCopilot && <div className="config-field-row">
            <div className="config-field">
              <label htmlFor={`${color}-temperature`}>Temperature</label>
              <input
                id={`${color}-temperature`}
                type="number"
                min={0}
                max={provider.type === 'anthropic' ? 1 : 2}
                step={0.1}
                value={provider.temperature ?? 0.3}
                onChange={(e) => onUpdate({ temperature: +e.target.value })}
              />
            </div>
            <div className="config-field">
              <label htmlFor={`${color}-tokens`}>Max Tokens (optional)</label>
              <input
                id={`${color}-tokens`}
                type="number"
                min={256}
                max={131072}
                step={1}
                placeholder="Use match default"
                value={provider.maxTokens ?? ''}
                onChange={(e) => onUpdate({ maxTokens: e.target.value ? +e.target.value : undefined })}
              />
            </div>
          </div>}
          {isCopilot && <p className="field-hint">{settings.note}</p>}

          {opt?.keyEnvVar && (
            <p className="key-hint text-muted">
              Set <code>{opt.keyEnvVar}</code> in Settings or the server environment.
            </p>
          )}
        </>
      )}
    </div>
  );
}
