import { ancestorsOf, createCue, layerTree, type Cue, type Layer, type Show } from '@scrim/format';
import { bounds, type Box } from './frames.js';

/** A cue that brings `layer` in, placed after `afterCueId` (or at the end). */
export function cueBringingIn(show: Show, layer: Layer, afterCueId: string | null): Cue | null {
  const after = show.cues.find((c) => c.id === afterCueId) ?? show.cues.at(-1);
  const sceneId = after?.sceneId ?? show.scenes[0]?.id;
  if (!sceneId) return null;
  const cue = createCue(sceneId, `${layer.kind === 'audio' ? 'Sound' : 'Show'}: ${layer.name}`);
  const fade = show.defaultFade ?? { duration: 1, easing: 'easeInOut' as const };
  // Frames around it that start hidden come in with it, or it would stay unseen.
  for (const f of ancestorsOf(layerTree(show.layers), layer.id).reverse())
    if (!f.visible) cue.actions.push({ type: 'show', layerId: f.id, ...fade });
  cue.actions.push({ type: 'show', layerId: layer.id, ...fade });
  if (layer.kind === 'video' || layer.kind === 'audio')
    cue.actions.push({ type: 'play', layerId: layer.id, restart: true });
  return cue;
}

export function insertCueAfter(d: Show, cue: Cue, afterCueId: string | null): void {
  const i = afterCueId ? d.cues.findIndex((c) => c.id === afterCueId) : d.cues.length - 1;
  d.cues.splice(i + 1, 0, cue);
}

export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/**
 * Where boxes go to line up. One aligns to its container (the output, or the frame it is in);
 * several align to their shared bounds, like Figma. Boxes are what is drawn, so a layer that
 * hugs its content lines up by its content.
 */
export function alignBoxes(boxes: Map<string, Box>, container: Box, how: Align): Map<string, Box> {
  const list = [...boxes.values()];
  const b = list.length === 1 ? container : bounds(list)!;
  const x = (r: Box) =>
    how === 'left'
      ? b.x
      : how === 'right'
        ? b.x + b.w - r.w
        : how === 'center'
          ? b.x + (b.w - r.w) / 2
          : r.x;
  const y = (r: Box) =>
    how === 'top'
      ? b.y
      : how === 'bottom'
        ? b.y + b.h - r.h
        : how === 'middle'
          ? b.y + (b.h - r.h) / 2
          : r.y;
  return new Map([...boxes].map(([id, r]) => [id, { ...r, x: x(r), y: y(r) }]));
}

/** Spread three or more boxes so the gaps between them are equal. */
export function distributeBoxes(boxes: Map<string, Box>, axis: 'x' | 'y'): Map<string, Box> {
  const size = axis === 'x' ? 'w' : 'h';
  const list = [...boxes].sort(([, a], [, b]) => a[axis] - b[axis]);
  if (list.length < 3) return boxes;
  const first = list[0]![1];
  const last = list.at(-1)![1];
  const span = last[axis] + last[size] - first[axis];
  const gap = (span - list.reduce((n, [, r]) => n + r[size], 0)) / (list.length - 1);
  let at = first[axis];
  return new Map(
    list.map(([id, r]) => {
      const placed = { ...r, [axis]: at };
      at += r[size] + gap;
      return [id, placed];
    }),
  );
}

/** Move layers by a number of output pixels (arrow-key nudge). */
export function nudgeLayers(d: Show, ids: string[], dx: number, dy: number): void {
  for (const l of d.layers) {
    if (!ids.includes(l.id) || !('x' in l)) continue;
    l.x += dx;
    l.y += dy;
  }
}
