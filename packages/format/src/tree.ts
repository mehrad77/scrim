import type { FrameLayer, Layer } from './schema.js';

/**
 * Layers as a tree of frames. Broken links never throw: a layer whose frame is missing, is not a
 * frame, sits on another output, or closes a loop is drawn on the output instead, and audio is
 * never inside a frame. The logic check reports the same problems so they can be fixed.
 */
export interface LayerTree {
  byId: ReadonlyMap<string, Layer>;
  /** Layers drawn straight on their output, in list order: front first. */
  roots: Layer[];
  /** A frame's children in list order (front first); empty for anything else. */
  children(id: string): Layer[];
  /** The frame a layer is drawn in, after repairs. */
  parent(id: string): FrameLayer | undefined;
}

export function isFrame(layer: Layer | undefined): layer is FrameLayer {
  return layer?.kind === 'frame';
}

/**
 * Front first: higher z first, and on a tie the later layer first, so reversing a list gives the
 * back-to-front drawing order the renderer has always used.
 */
function frontFirst(layers: Layer[]): Layer[] {
  return layers
    .map((l, i) => ({ l, i }))
    .sort((a, b) => b.l.z - a.l.z || b.i - a.i)
    .map(({ l }) => l);
}

export function layerTree(layers: readonly Layer[]): LayerTree {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const parents = new Map<string, FrameLayer>();
  const settled = new Set<string>();
  const visiting = new Set<string>();

  // Returns false only while `layer` is part of a loop still being walked.
  const settle = (layer: Layer): boolean => {
    if (settled.has(layer.id)) return true;
    if (visiting.has(layer.id)) return false;
    visiting.add(layer.id);
    const p = layer.parentId ? byId.get(layer.parentId) : undefined;
    if (isFrame(p) && p.outputId === layer.outputId && layer.kind !== 'audio' && settle(p))
      parents.set(layer.id, p);
    visiting.delete(layer.id);
    settled.add(layer.id);
    return true;
  };
  for (const l of layers) settle(l);

  const kids = new Map<string, Layer[]>();
  const top: Layer[] = [];
  for (const l of layers) {
    const p = parents.get(l.id);
    if (!p) top.push(l);
    else kids.set(p.id, [...(kids.get(p.id) ?? []), l]);
  }
  for (const [id, list] of kids) kids.set(id, frontFirst(list));
  return {
    byId,
    roots: frontFirst(top),
    children: (id) => kids.get(id) ?? [],
    parent: (id) => parents.get(id),
  };
}

/** The frames around a layer, nearest first. */
export function ancestorsOf(tree: LayerTree, id: string): FrameLayer[] {
  const out: FrameLayer[] = [];
  for (let p = tree.parent(id); p; p = tree.parent(p.id)) out.push(p);
  return out;
}

/** Everything inside a frame, depth first in list order; empty for anything else. */
export function descendantsOf(tree: LayerTree, id: string): Layer[] {
  return tree.children(id).flatMap((c) => [c, ...descendantsOf(tree, c.id)]);
}

/** Which axes follow the content instead of the layer's w and h. */
export function hugAxes(layer: Layer): { w: boolean; h: boolean } {
  switch (layer.kind) {
    case 'frame': {
      const flow = layer.layout.mode !== 'free';
      return { w: flow && layer.layout.hugW, h: flow && layer.layout.hugH };
    }
    case 'text':
    case 'counter':
    case 'state':
      if (layer.kind === 'state' && layer.display === 'bars') break;
      return { w: layer.sizing === 'autoWidth', h: !!layer.sizing && layer.sizing !== 'fixed' };
  }
  return { w: false, h: false };
}
