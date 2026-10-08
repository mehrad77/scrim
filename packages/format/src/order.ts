import type { Cue, Show } from './schema.js';

/** Cues in running order: by scene order, then by position in the cue array. */
export function cueOrder(show: Pick<Show, 'scenes' | 'cues'>): Cue[] {
  const rank = new Map(show.scenes.map((s, i) => [s.id, i]));
  return show.cues
    .map((cue, i) => ({ cue, i }))
    .filter(({ cue }) => rank.has(cue.sceneId))
    .sort((a, b) => rank.get(a.cue.sceneId)! - rank.get(b.cue.sceneId)! || a.i - b.i)
    .map(({ cue }) => cue);
}
