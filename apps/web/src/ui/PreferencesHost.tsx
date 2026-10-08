import { lazy, Suspense, useEffect, useState } from 'react';

const OPEN_EVENT = 'scrim:open-preferences';
const PreferencesDialog = lazy(() => import('./Preferences.js'));

/** Open the Preferences dialog, the same as ⌘, (Ctrl+,). */
export function openPreferences(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * Mount once per surface: it listens for ⌘, (Ctrl+,) and `openPreferences()` and shows the
 * Preferences dialog, loading it the first time. Preferences are per machine, never in a show.
 */
export function PreferencesHost() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const show = () => {
      setLoaded(true);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!loaded) return null;
  return (
    <Suspense fallback={null}>
      <PreferencesDialog open={open} onOpenChange={setOpen} />
    </Suspense>
  );
}
