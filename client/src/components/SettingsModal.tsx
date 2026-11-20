import { useState, useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (keys: Record<string, string>) => void;
}

const KEY_FIELDS = [
  { id: 'OPENAI_API_KEY', label: 'OpenAI API Key', placeholder: 'sk-...' },
  { id: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
  { id: 'CUSTOM_API_KEY', label: 'Custom / Generic Key', placeholder: 'key...' },
];

const THEMES = [
  { id: 'midnight', name: 'Midnight', preview: 'linear-gradient(135deg, #0a0a1a, #1a1a3a)' },
  { id: 'emerald', name: 'Emerald', preview: 'linear-gradient(135deg, #020d08, #0a3020)' },
  { id: 'amber', name: 'Amber', preview: 'linear-gradient(135deg, #0a0804, #2a1a08)' },
  { id: 'rose', name: 'Rose', preview: 'linear-gradient(135deg, #0a0408, #2a0818)' },
];

const STORAGE_KEY = 'tg-api-keys';
const THEME_KEY = 'tg-theme';
const APP_VERSION = '1.1.4';

function applyTheme(id: string) {
  document.documentElement.setAttribute('data-theme', id);
  localStorage.setItem(THEME_KEY, id);
}

// Apply saved theme and opacity on module load
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
const savedOpacity = localStorage.getItem('tg-opacity');
if (savedOpacity) document.documentElement.style.setProperty('--bg-opacity', `${savedOpacity}%`);

export function SettingsModal({ open, onClose, onSave }: Props) {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [currentTheme, setCurrentTheme] = useState(savedTheme || 'midnight');
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem('tg-opacity');
    return saved ? parseInt(saved) : 100;
  });
  const [autoUpdate, setAutoUpdate] = useState(() => {
    const saved = localStorage.getItem('tg-auto-update');
    return saved !== 'false'; // default true
  });
  const [settingsError, setSettingsError] = useState<string | null>(null);

  function handleApplyTheme(id: string) {
    applyTheme(id);
    setCurrentTheme(id);
  }

  function handleOpacity(val: number) {
    setOpacity(val);
    document.documentElement.style.setProperty('--bg-opacity', `${val}%`);
    localStorage.setItem('tg-opacity', String(val));
  }

  async function handleAutoUpdate(enabled: boolean) {
    try {
      await window.electronAPI?.setAutoUpdate(enabled);
      setAutoUpdate(enabled);
      localStorage.setItem('tg-auto-update', String(enabled));
      setSettingsError(null);
    } catch (err) {
      setSettingsError(`Could not save update preference: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setCurrentTheme(document.documentElement.getAttribute('data-theme') || 'midnight');
      if (window.electronAPI) {
        window.electronAPI.getAutoUpdate().then(setAutoUpdate).catch((err: unknown) => {
          setSettingsError(`Could not read update preference: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        setKeys(saved);
      } catch {
        setKeys({});
      }
    }
  }, [open]);

  if (!open) return null;

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    onSave(keys);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass glass-glow animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <h3>API Keys</h3>
          <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: 12 }}>
            Keys are stored locally and sent to the server when starting matches or refreshing models. Appearance and update preferences apply immediately; Save stores your API keys.
          </p>

          {KEY_FIELDS.map((f) => (
            <div className="config-field" key={f.id} style={{ marginBottom: 12 }}>
              <label htmlFor={f.id}>{f.label}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  id={f.id}
                  type={visible[f.id] ? 'text' : 'password'}
                  value={keys[f.id] || ''}
                  onChange={(e) => setKeys((k) => ({ ...k, [f.id]: e.target.value }))}
                  placeholder={f.placeholder}
                  autoComplete="off"
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-secondary btn-icon"
                  onClick={() => setVisible((v) => ({ ...v, [f.id]: !v[f.id] }))}
                  title={visible[f.id] ? 'Hide' : 'Show'}
                  style={{ fontSize: '0.7rem', minWidth: 32 }}
                >
                  {visible[f.id] ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          ))}

          <h3 style={{ marginTop: 18 }}>Theme</h3>
          <div className="theme-picker">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`theme-swatch ${currentTheme === t.id ? 'theme-swatch-active' : ''}`}
                style={{ background: t.preview }}
                onClick={() => handleApplyTheme(t.id)}
                title={t.name}
              />
            ))}
          </div>

          <h3 style={{ marginTop: 18 }}>Transparency</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span className="text-muted" style={{ fontSize: '0.7rem' }}>Clear</span>
            <input
              type="range"
              min={30}
              max={100}
              value={opacity}
              aria-label="Transparency"
              onChange={(e) => handleOpacity(+e.target.value)}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span className="text-muted" style={{ fontSize: '0.7rem' }}>Opaque</span>
            <span className="mono" style={{ fontSize: '0.75rem', width: 36 }}>{opacity}%</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.65rem', marginTop: 4 }}>
            Lower values let your desktop show through (frameless mode only)
          </p>

          <h3 style={{ marginTop: 18 }}>Updates</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 8, fontSize: '0.82rem' }}>
            <input
              type="checkbox"
              checked={autoUpdate}
              disabled={!window.electronAPI}
              onChange={(e) => handleAutoUpdate(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            Check for updates on launch
          </label>
          <p className="text-muted" style={{ fontSize: '0.65rem', marginTop: 4 }}>
            v{APP_VERSION} — compares against latest GitHub release
            {!window.electronAPI && ' (desktop app only)'}
          </p>
          {settingsError && <p role="alert" className="text-secondary">{settingsError}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

export function loadSavedKeys(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}
