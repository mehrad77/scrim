import type { AccessText, Cue, Show } from '@scrim/format';

/**
 * The personal access channel's place in the show: whose caption is up, whose description was
 * last given (with a count, so a phone reads each one once), and how many buzzes there have
 * been. Engine state, so a jump, Back or a crash resume puts the right caption back.
 */
export interface AccessState {
  captionCue: string | null;
  describeCue: string | null;
  seq: number;
  buzz: number;
}

export const NO_ACCESS: AccessState = { captionCue: null, describeCue: null, seq: 0, buzz: 0 };

/** One of a cue's access texts in a language, or the show's own when there's no translation. */
export function accessText(cue: Cue | undefined, kind: keyof AccessText, lang?: string): string {
  const own = cue?.access?.[kind]?.trim() ?? '';
  const translated = lang ? cue?.access?.i18n?.[lang]?.[kind]?.trim() : '';
  return translated || own;
}

/** What firing a cue does to the channel. Absent caption: the last one stays; empty: it clears. */
export function accessAfter(prev: AccessState | undefined, cue: Cue): AccessState | undefined {
  const a = cue.access;
  if (!a || (a.caption === undefined && !a.description?.trim() && !a.buzz)) return prev;
  const next = { ...(prev ?? NO_ACCESS) };
  if (a.caption !== undefined) next.captionCue = a.caption.trim() ? cue.id : null;
  if (a.description?.trim()) {
    next.describeCue = cue.id;
    next.seq += 1;
  }
  if (a.buzz) next.buzz += 1;
  return next;
}

/** The caption up now, in the show's own language: what `{{caption}}` shows on stage. */
export function currentCaption(show: Pick<Show, 'cues'>, access: AccessState | undefined): string {
  if (!access?.captionCue) return '';
  return accessText(
    show.cues.find((c) => c.id === access.captionCue),
    'caption',
  );
}
