import { accessText, isRelaxed, type EngineState } from '@scrim/engine';
import type { AccessText, Cue, Show } from '@scrim/format';
import type { AccessView, Translated } from '@scrim/protocol';

/** Whether the show uses the personal access channel at all: any access text, or translations. */
export function usesAccess(show: Show): boolean {
  return !!show.languages?.others.length || show.cues.some((c) => hasAccess(c));
}

const hasAccess = (c: Cue) =>
  !!c.access &&
  (!!c.access.caption?.trim() ||
    !!c.access.description?.trim() ||
    !!c.access.warning?.trim() ||
    !!c.access.buzz);

function translated(show: Show, cue: Cue | undefined, kind: keyof AccessText): Translated | null {
  const text = accessText(cue, kind);
  if (!text) return null;
  const i18n: Record<string, string> = {};
  for (const lang of show.languages?.others ?? []) {
    const t = cue?.access?.i18n?.[lang]?.[kind]?.trim();
    if (t) i18n[lang] = t;
  }
  return { text, i18n };
}

/**
 * What phones need for the access channel now: the caption up, the latest description, the
 * standby cue's warning, every language of each, and whether the performance is relaxed. Null
 * when the show doesn't use the channel and isn't relaxed.
 */
export function accessView(show: Show, state: EngineState): AccessView | null {
  const relaxed = isRelaxed(state);
  if (!usesAccess(show) && !relaxed) return null;
  const find = (id: string | null | undefined) => show.cues.find((c) => c.id === id);
  const access = state.access;
  const description = translated(show, find(access?.describeCue), 'description');
  return {
    languages: show.languages ?? { base: 'en', others: [] },
    caption: translated(show, find(access?.captionCue), 'caption'),
    description: description && { ...description, seq: access?.seq ?? 0 },
    warning: translated(show, find(state.standby), 'warning'),
    buzz: access?.buzz ?? 0,
    ...(relaxed ? { relaxed } : {}),
  };
}
