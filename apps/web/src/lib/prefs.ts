/**
 * Per-machine appearance and comfort preferences (see DESIGN_SYSTEM.md › Themes and modes).
 * They are applied as attributes on <html> before first paint by `bootstrapPrefs`, which Vite
 * inlines into index.html and audience.html, and again whenever they change.
 */

export type ThemePref = 'booth' | 'paper' | 'system';
export type ContrastPref = 'standard' | 'high' | 'system';
export type MotionPref = 'system' | 'reduced' | 'full';

export interface Prefs {
  theme: ThemePref;
  contrast: ContrastPref;
  motion: MotionPref;
  /** Root font scale: 0.9, 1, 1.1 or 1.25. */
  uiScale: number;
  /** Accent hue in degrees; 355–50 is skipped so the accent never reads as fault or warn. */
  accentHue: number;
  editorDensity: 'compact' | 'comfortable';
  /** Brightness of operator thumbnails in the Booth theme, 0.3–1. */
  thumbBrightness: number;
}

export const PREFS_KEY = 'scrim.prefs';

export const DEFAULT_PREFS: Prefs = {
  theme: 'booth',
  contrast: 'system',
  motion: 'system',
  uiScale: 1,
  accentHue: 330,
  editorDensity: 'comfortable',
  thumbBrightness: 0.6,
};

/**
 * Reads the stored preferences and sets data-theme, data-contrast, data-motion, --ui-scale and
 * --accent-h on <html>. Self-contained (no imports, no closures) because its source is inlined
 * into the HTML pages to run before first paint.
 */
export function bootstrapPrefs(key: string, forceReducedMotion?: boolean): void {
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(localStorage.getItem(key) ?? '{}') ?? {};
  } catch {
    p = {};
  }
  const root = document.documentElement;
  const mq = (q: string) => !!window.matchMedia && window.matchMedia(q).matches;
  const theme =
    p.theme === 'paper' || p.theme === 'booth'
      ? p.theme
      : p.theme === 'system'
        ? mq('(prefers-color-scheme: light)')
          ? 'paper'
          : 'booth'
        : 'booth';
  const contrast =
    p.contrast === 'high' || (p.contrast !== 'standard' && mq('(prefers-contrast: more)'))
      ? 'high'
      : 'standard';
  const motion =
    forceReducedMotion ||
    p.motion === 'reduced' ||
    (p.motion !== 'full' && mq('(prefers-reduced-motion: reduce)'))
      ? 'reduced'
      : 'full';
  root.dataset.theme = theme;
  root.dataset.contrast = contrast;
  root.dataset.motion = motion;
  // Output windows show only the stage: no interface scale there.
  const isOutput = /^\/(output|remote-output)/.test(location.pathname);
  const scale = typeof p.uiScale === 'number' && p.uiScale >= 0.75 && p.uiScale <= 1.5;
  root.style.setProperty('--ui-scale', !isOutput && scale ? String(p.uiScale) : '1');
  const hue = typeof p.accentHue === 'number' ? ((p.accentHue % 360) + 360) % 360 : 330;
  root.style.setProperty('--accent-h', String(hue > 355 || hue < 50 ? 330 : hue));
}

export function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return { ...DEFAULT_PREFS, ...(raw ? (JSON.parse(raw) as Partial<Prefs>) : {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let showModeMotionLock = false;

/** Merge, store and apply preferences. */
export function writePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...readPrefs(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable; the change still applies for this session
  }
  bootstrapPrefs(PREFS_KEY, showModeMotionLock);
  return next;
}

/** Show mode forces the reduced motion profile (DESIGN_SYSTEM.md › Motion). */
export function setShowModeMotion(on: boolean): void {
  showModeMotionLock = on;
  bootstrapPrefs(PREFS_KEY, on);
}
