/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    minimize(): void;
    maximize(): void;
    close(): void;
    getAutoUpdate(): Promise<boolean>;
    setAutoUpdate(enabled: boolean): Promise<void>;
  };
}
