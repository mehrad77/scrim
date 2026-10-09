import { ancestorsOf, type LayerTree } from '@scrim/format';
import type { EngineState } from './state.js';
import { tweenValue } from './tween.js';

/**
 * How opaque a layer looks: its own opacity times every frame around it. Frames fade their
 * content with them, so a video's sound follows its frame too.
 */
export function effectiveOpacity(
  tree: LayerTree,
  state: EngineState,
  layerId: string,
  now: number,
): number {
  let v = state.layers[layerId] ? tweenValue(state.layers[layerId].opacity, now) : 0;
  for (const f of ancestorsOf(tree, layerId))
    v *= state.layers[f.id] ? tweenValue(state.layers[f.id]!.opacity, now) : 0;
  return v;
}
