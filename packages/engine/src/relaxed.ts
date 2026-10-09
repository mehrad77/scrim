import {
  ancestorsOf,
  layerTree,
  type Action,
  type Cue,
  type LayerTree,
  type Show,
} from '@scrim/format';
import type { EngineState } from './state.js';
import { tweenValue } from './tween.js';

/** A relaxed performance's limits when the show doesn't set its own. */
export const RELAXED_DEFAULTS = { brightness: 0.7, volume: 0.6, minFade: 1 } as const;

/** Turning relaxed on or off dims and quietens over this long, so nobody sees a jump. */
export const RELAXED_FADE = 2;

export function relaxedSettings(show: Show): {
  brightness: number;
  volume: number;
  minFade: number;
} {
  const r = show.relaxed;
  return {
    brightness: r?.brightness ?? RELAXED_DEFAULTS.brightness,
    volume: r?.volume ?? RELAXED_DEFAULTS.volume,
    minFade: r?.minFade ?? RELAXED_DEFAULTS.minFade,
  };
}

/** Whether relaxed is on (or turning on), as the operator last set it. */
export const isRelaxed = (state: EngineState): boolean => state.relaxed?.to === 1;

/** How far relaxed is on right now, 0 to 1: it eases in and out like the sound mute. */
export function relaxedLevel(state: EngineState, now: number): number {
  return state.relaxed ? tweenValue(state.relaxed, now) : 0;
}

/** How bright outputs may be now: 1 untouched, down to the show's relaxed brightness. */
export function relaxedBrightness(show: Show, state: EngineState, now: number): number {
  return 1 - (1 - relaxedSettings(show).brightness) * relaxedLevel(state, now);
}

/**
 * Every sound's level on top of its own fades: PANIC's blackout and the mute silence it, and a
 * relaxed performance caps it.
 */
export function soundLevel(show: Show, state: EngineState, now: number): number {
  const mute = state.mute ? tweenValue(state.mute, now) : 0;
  const cap = 1 - (1 - relaxedSettings(show).volume) * relaxedLevel(state, now);
  return (1 - tweenValue(state.blackout, now)) * (1 - mute) * cap;
}

/** Marked intense, itself or through a frame around it: a relaxed performance leaves it out. */
export function isIntense(
  show: Show,
  layerId: string,
  tree: LayerTree = layerTree(show.layers),
): boolean {
  const layer = show.layers.find((l) => l.id === layerId);
  if (!layer) return false;
  return !!layer.intense || ancestorsOf(tree, layerId).some((f) => f.intense);
}

/** What a cue does now: its gentler version during a relaxed performance, when it has one. */
export function cueActions(cue: Cue, state: EngineState): Action[] {
  return isRelaxed(state) && cue.gentle ? cue.gentle : cue.actions;
}
