export const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
  (window.location.protocol === 'file:' ? 'http://localhost:3001' : window.location.origin);

export function apiUrl(path: string): string {
  return new URL(path, SERVER_URL).toString();
}
