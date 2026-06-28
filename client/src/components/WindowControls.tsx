import { useRef } from 'react';

interface Props {
  onSettings?: () => void;
  onScoreboard?: () => void;
  onMusicFiles?: (files: FileList) => void;
}

export function WindowControls({ onSettings, onScoreboard, onMusicFiles }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function minimize() {
    (window as any).electronAPI?.minimize?.();
  }

  function maximize() {
    (window as any).electronAPI?.maximize?.();
  }

  function close() {
    (window as any).electronAPI?.close?.() || window.close();
  }

  function handleMusic() {
    fileRef.current?.click();
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0 && onMusicFiles) {
      onMusicFiles(e.target.files);
    }
  }

  return (
    <div className="window-controls">
      {onMusicFiles && (
        <>
          <button className="win-btn win-music" onClick={handleMusic} title="Load music folder">🎵</button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            multiple
            /* @ts-ignore */
            webkitdirectory=""
            onChange={handleFiles}
            hidden
          />
        </>
      )}
      {onScoreboard && (
        <button className="win-btn win-scoreboard" onClick={onScoreboard} title="Scoreboard">🏆</button>
      )}
      {onSettings && (
        <button className="win-btn win-settings" onClick={onSettings} title="Settings">⚙</button>
      )}
      <button className="win-btn win-minimize" onClick={minimize} title="Minimize">─</button>
      <button className="win-btn win-maximize" onClick={maximize} title="Maximize">□</button>
      <button className="win-btn win-close" onClick={close} title="Close">✕</button>
    </div>
  );
}
