/** Base URL of the realtime relay (http/https; WebSockets derive from it). */
export function defaultRelayUrl(): string {
  const env = import.meta.env.VITE_RELAY_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  return `${location.protocol}//${location.hostname}:8790`;
}

export function wsUrl(relay: string, path: string): string {
  return `${relay.replace(/^http/, 'ws')}${path}`;
}

export function isLocalHost(hostname = location.hostname): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** A stable random id for this browser, used as an anonymous client id. */
export function clientId(storageKey = 'scrim.clientId'): string {
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    localStorage.setItem(storageKey, id);
    return id;
  } catch {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  }
}
