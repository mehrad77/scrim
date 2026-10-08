import { initialState, step, type EngineState } from '@scrim/engine';
import { cueOrder, type Show } from '@scrim/format';

/**
 * What the stage looks like right after `cueId` (or at the top of the show),
 * with every fade finished. Lets designers preview without a projector.
 */
export function previewState(show: Show, cueId: string | null): EngineState {
  let state = initialState(show);
  if (!cueId) return settle(state);
  let t = 1;
  for (const cue of cueOrder(show)) {
    t += 1e7;
    state = step(show, state, { type: 'fireCue', cueId: cue.id, source: 'system' }, t).state;
    if (cue.id === cueId) break;
  }
  return settle(state);
}

/** Finish fades and freeze clocks, so the preview is a still picture. */
export function settle(state: EngineState): EngineState {
  for (const ls of Object.values(state.layers)) {
    ls.opacity = { ...ls.opacity, from: ls.opacity.to, dur: 0 };
    if (ls.counter) ls.counter = { ...ls.counter, running: false };
    if (ls.media) ls.media = { ...ls.media, playing: false };
  }
  return state;
}
