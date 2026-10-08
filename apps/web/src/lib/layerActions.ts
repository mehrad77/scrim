import { createCue, uid, type Cue, type Layer, type Output, type Show } from '@scrim/format';

type Placed = Extract<Layer, { x: number }>;

/** A cue that brings `layer` in, placed after `afterCueId` (or at the end). */
export function cueBringingIn(show: Show, layer: Layer, afterCueId: string | null): Cue | null {
  const after = show.cues.find((c) => c.id === afterCueId) ?? show.cues.at(-1);
  const sceneId = after?.sceneId ?? show.scenes[0]?.id;
  if (!sceneId) return null;
  const cue = createCue(sceneId, `${layer.kind === 'audio' ? 'Sound' : 'Show'}: ${layer.name}`);
  const fade = show.defaultFade ?? { duration: 1, easing: 'easeInOut' as const };
  cue.actions.push({ type: 'show', layerId: layer.id, ...fade });
  if (layer.kind === 'video' || layer.kind === 'audio')
    cue.actions.push({ type: 'play', layerId: layer.id, restart: true });
  return cue;
}

export function insertCueAfter(d: Show, cue: Cue, afterCueId: string | null): void {
  const i = afterCueId ? d.cues.findIndex((c) => c.id === afterCueId) : d.cues.length - 1;
  d.cues.splice(i + 1, 0, cue);
}

export function duplicateOf(layer: Layer): Layer {
  const copy = structuredClone(layer);
  copy.id = uid('lyr');
  copy.name = `${layer.name} copy`;
  if ('x' in copy) {
    copy.x += 40;
    copy.y += 40;
    copy.z += 1;
  }
  return copy;
}

export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/**
 * Align layers. One layer aligns to the output; several align to their shared bounds, like
 * Figma.
 */
export function alignLayers(d: Show, ids: string[], output: Output, how: Align): void {
  const layers = d.layers.filter((l): l is Placed => ids.includes(l.id) && 'x' in l);
  if (!layers.length) return;
  const box =
    layers.length === 1
      ? { x0: 0, y0: 0, x1: output.width, y1: output.height }
      : {
          x0: Math.min(...layers.map((l) => l.x)),
          y0: Math.min(...layers.map((l) => l.y)),
          x1: Math.max(...layers.map((l) => l.x + l.w)),
          y1: Math.max(...layers.map((l) => l.y + l.h)),
        };
  for (const l of layers) {
    if (how === 'left') l.x = box.x0;
    if (how === 'right') l.x = box.x1 - l.w;
    if (how === 'center') l.x = Math.round((box.x0 + box.x1 - l.w) / 2);
    if (how === 'top') l.y = box.y0;
    if (how === 'bottom') l.y = box.y1 - l.h;
    if (how === 'middle') l.y = Math.round((box.y0 + box.y1 - l.h) / 2);
  }
}

/** Spread three or more layers so the gaps between them are equal. */
export function distributeLayers(d: Show, ids: string[], axis: 'x' | 'y'): void {
  const layers = d.layers
    .filter((l): l is Placed => ids.includes(l.id) && 'x' in l)
    .sort((a, b) => a[axis] - b[axis]);
  if (layers.length < 3) return;
  const size = (l: Placed) => (axis === 'x' ? l.w : l.h);
  const first = layers[0]!;
  const last = layers.at(-1)!;
  const span = last[axis] + size(last) - first[axis];
  const gap = (span - layers.reduce((n, l) => n + size(l), 0)) / (layers.length - 1);
  let at = first[axis];
  for (const l of layers) {
    l[axis] = Math.round(at);
    at += size(l) + gap;
  }
}

/** Move layers by a number of output pixels (arrow-key nudge). */
export function nudgeLayers(d: Show, ids: string[], dx: number, dy: number): void {
  for (const l of d.layers) {
    if (!ids.includes(l.id) || !('x' in l)) continue;
    l.x += dx;
    l.y += dy;
  }
}
