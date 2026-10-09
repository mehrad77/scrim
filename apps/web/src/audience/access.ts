import type { AccessView, Translated } from '@scrim/protocol';
import { hasPack } from './strings.js';

/** What this person turned on. It stays on their phone; the relay never learns it. */
export interface AccessPrefs {
  /** The show language they picked; null: follow the phone when the show offers it. */
  lang: string | null;
  captions: boolean;
  /** Text size, as a UI scale. */
  size: 1 | 1.25 | 1.5;
  describe: boolean;
  buzz: boolean;
  warnings: boolean;
}

const KEY = 'scrim.access';

export const DEFAULT_PREFS: AccessPrefs = {
  lang: null,
  captions: false,
  size: 1,
  describe: false,
  buzz: false,
  warnings: true,
};

export function readPrefs(): AccessPrefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as object) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(prefs: AccessPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // private mode: the choices last as long as the page
  }
}

const base = (lang: string) => lang.split('-')[0]!.toLowerCase();

/**
 * The language the show's words appear in: the person's pick, else the phone's own language when
 * the show is translated into it, else the show's own.
 */
export function showLang(prefs: AccessPrefs, view: AccessView | null): string {
  const langs = view?.languages ?? { base: 'en', others: [] };
  const offered = [langs.base, ...langs.others];
  if (prefs.lang && offered.includes(prefs.lang)) return prefs.lang;
  for (const l of navigator.languages ?? []) {
    const hit = langs.others.find((o) => base(o) === base(l));
    if (hit) return hit;
  }
  return langs.base;
}

/** The page's own words follow the show language when there's a pack, else the phone's. */
export function uiLang(lang: string): string {
  if (hasPack(lang)) return lang;
  return (navigator.languages ?? []).map(base).find(hasPack) ?? 'en';
}

/** A show text in the chosen language, or the show's own. */
export function tr(t: Translated | null | undefined, lang: string): string {
  return t ? (t.i18n[lang] ?? t.text) : '';
}

/** Read a text aloud with the phone's own voice; nothing crosses the network. */
export function speak(text: string, lang: string): void {
  if (!('speechSynthesis' in window) || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.speak(u);
}
