import { useEffect, useState } from 'react';
import { PREFS_EVENT, PREFS_KEY, reapplyPrefs, readPrefs, type Prefs } from './prefs.js';

/** The current preferences, re-rendering when they change here or in another tab. */
export function usePrefs(): Prefs {
  const [prefs, setPrefs] = useState(readPrefs);
  useEffect(() => {
    const on = (e: Event) => {
      if (e instanceof StorageEvent) {
        if (e.key !== PREFS_KEY) return;
        reapplyPrefs();
      }
      setPrefs(readPrefs());
    };
    window.addEventListener(PREFS_EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(PREFS_EVENT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return prefs;
}
