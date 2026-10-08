import type { Cue, Scene } from '@scrim/format';

/** Spike-tape colours for tagging scenes and cues (DESIGN_SYSTEM.md › Tape palette). */
export const TAPES = [
  { n: 1, name: 'Red', bg: 'bg-tape-1', border: 'border-tape-1', fill: 'fill-tape-1' },
  { n: 2, name: 'Orange', bg: 'bg-tape-2', border: 'border-tape-2', fill: 'fill-tape-2' },
  { n: 3, name: 'Yellow', bg: 'bg-tape-3', border: 'border-tape-3', fill: 'fill-tape-3' },
  { n: 4, name: 'Green', bg: 'bg-tape-4', border: 'border-tape-4', fill: 'fill-tape-4' },
  { n: 5, name: 'Teal', bg: 'bg-tape-5', border: 'border-tape-5', fill: 'fill-tape-5' },
  { n: 6, name: 'Blue', bg: 'bg-tape-6', border: 'border-tape-6', fill: 'fill-tape-6' },
  { n: 7, name: 'Violet', bg: 'bg-tape-7', border: 'border-tape-7', fill: 'fill-tape-7' },
  { n: 8, name: 'Pink', bg: 'bg-tape-8', border: 'border-tape-8', fill: 'fill-tape-8' },
] as const;

export function tapeOf(cue: Cue | undefined, scene: Scene | undefined) {
  const n = cue?.tape ?? scene?.tape;
  return TAPES.find((t) => t.n === n) ?? null;
}
