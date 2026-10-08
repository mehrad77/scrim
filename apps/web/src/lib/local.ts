/** Per-machine settings in localStorage; reads never throw. */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable; the setting just won't persist
  }
}

/** Audio bus id -> output device id, for this machine. */
export const AUDIO_DEVICES_KEY = 'scrim.audioDevices';
