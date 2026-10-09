import {
  ancestorsOf,
  descendantsOf,
  hugAxes,
  isFrame,
  layerTree,
  uid,
  type FrameLayer,
  type Layer,
  type LayerTree,
  type Output,
  type Pin,
  type Show,
} from '@scrim/format';
import { removeLayer } from './refs.js';

/**
 * Editing frames and the order of layers. Lists are front first, like the layers panel; `z`
 * only orders a layer among its siblings.
 */

/** Locked itself or inside a locked frame: the canvas leaves it alone. */
export function isLocked(tree: LayerTree, id: string): boolean {
  return !!tree.byId.get(id)?.locked || ancestorsOf(tree, id).some((f) => f.locked);
}

/** The selected layers that aren't inside another selected layer, in the order given. */
export function outermost(tree: LayerTree, ids: string[]): string[] {
  const picked = new Set(ids);
  return ids.filter((id) => {
    for (let p = tree.parent(id); p; p = tree.parent(p.id)) if (picked.has(p.id)) return false;
    return true;
  });
}

/** A layer's siblings, itself included, front first: its frame's children, or its output's. */
export function siblingsOf(tree: LayerTree, layer: Layer): Layer[] {
  const p = tree.parent(layer.id);
  return p
    ? tree.children(p.id)
    : tree.roots.filter((l) => l.outputId === layer.outputId && l.kind !== 'audio');
}

/**
 * Move `ids` next to `targetId`, keeping their order. Only among siblings: moving into another
 * frame changes where things are drawn, which needs their measured boxes.
 */
export function reorderLayers(
  show: Show,
  ids: string[],
  targetId: string,
  position: 'before' | 'after',
): void {
  const tree = layerTree(show.layers);
  const target = tree.byId.get(targetId);
  if (!target) return;
  const list = siblingsOf(tree, target).map((l) => l.id);
  const moving = list.filter((id) => ids.includes(id));
  if (moving.length !== ids.length || moving.includes(targetId)) return;
  const order = list.filter((id) => !moving.includes(id));
  order.splice(order.indexOf(targetId) + (position === 'after' ? 1 : 0), 0, ...moving);
  restack(show, order);
}

/** Bring a layer forward (1) or send it backward (-1) one place among its siblings. */
export function stepLayer(show: Show, id: string, dir: 1 | -1): void {
  const tree = layerTree(show.layers);
  const layer = tree.byId.get(id);
  if (!layer) return;
  const list = siblingsOf(tree, layer).map((l) => l.id);
  const i = list.indexOf(id);
  const j = i - dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j]!, list[i]!];
  restack(show, list);
}

/** Give a front-first list of siblings dense z values, the front highest. */
function restack(show: Show, order: string[]): void {
  order.forEach((id, i) => {
    const l = show.layers.find((x) => x.id === id);
    if (l) l.z = order.length - i;
  });
}

/**
 * Copy layers and everything inside them, with new ids. Each copy sits just in front of its
 * original, 40 px down and right unless its frame lays it out. Returns the copies' ids.
 */
export function duplicateLayers(show: Show, ids: string[]): string[] {
  const tree = layerTree(show.layers);
  const tops: string[] = [];
  for (const id of outermost(tree, ids)) {
    const top = tree.byId.get(id);
    if (!top) continue;
    const all = [top, ...descendantsOf(tree, id)];
    const fresh = new Map(all.map((l) => [l.id, uid('lyr')]));
    // JSON, not structuredClone: these may be Immer drafts.
    const copies = all.map((l) => {
      const copy = JSON.parse(JSON.stringify(l)) as Layer;
      copy.id = fresh.get(l.id)!;
      if (copy.parentId && fresh.has(copy.parentId)) copy.parentId = fresh.get(copy.parentId);
      return copy;
    });
    const head = copies[0]!;
    head.name = `${top.name} copy`;
    const mode = tree.parent(id)?.layout.mode;
    if (!mode || mode === 'free') {
      head.x += 40;
      head.y += 40;
    }
    show.layers.push(...copies);
    const list = siblingsOf(tree, top).map((l) => l.id);
    list.splice(list.indexOf(id), 0, head.id);
    restack(show, list);
    tops.push(head.id);
  }
  return tops;
}

/** A box in output pixels. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const isFlow = (frame: FrameLayer | undefined) => !!frame && frame.layout.mode !== 'free';

/**
 * The fields that put a layer where `drawn` is, given where its frame is drawn. A layer laid out
 * by a row or column keeps its x and y; on an axis that hugs, w and h take the drawn size so the
 * edge it grows from stays put.
 */
export function placeAt(
  parent: FrameLayer | undefined,
  drawn: Box,
  frameAt: Box | undefined,
): Partial<Pick<Layer, 'x' | 'y' | 'w' | 'h'>> {
  const size = { w: Math.max(1, Math.round(drawn.w)), h: Math.max(1, Math.round(drawn.h)) };
  if (isFlow(parent)) return size;
  return {
    x: Math.round(drawn.x - (frameAt?.x ?? 0)),
    y: Math.round(drawn.y - (frameAt?.y ?? 0)),
    ...size,
  };
}

/**
 * What the canvas lets you do to a layer: a row or column places its children, so they only
 * resize, from the far edges; an axis that hugs its content has no handles.
 */
export function handlesFor(layer: Layer, parent: FrameLayer | undefined) {
  const hug = hugAxes(layer);
  const all = isFlow(parent) ? ['e', 's', 'se'] : ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
  return {
    drag: !isFlow(parent),
    dirs: all.filter((d) => !(hug.w && /[ew]/.test(d)) && !(hug.h && /[ns]/.test(d))),
  };
}

/**
 * What a click on the canvas selects. Like Figma, it picks the outermost frame around what was
 * hit, unless the selection is already inside that frame: then it picks among the selection's
 * neighbours. A double-click (`deeper`) goes one level into the selected frame.
 */
export function pickLayer(
  tree: LayerTree,
  hitId: string,
  selected: string[],
  deeper = false,
): string {
  const chain = [hitId, ...ancestorsOf(tree, hitId).map((f) => f.id)];
  if (deeper) {
    const i = chain.findIndex((id) => selected.includes(id));
    if (i > 0) return chain[i - 1]!;
  }
  const open = new Set(selected.flatMap((id) => ancestorsOf(tree, id).map((f) => f.id)));
  return (
    chain.find((id) => {
      const p = tree.parent(id);
      return !p || open.has(p.id);
    }) ?? hitId
  );
}

type Size = Pick<Output, 'width' | 'height'>;

/** How far a pinned layer moves when its output changes size: it keeps its pinned edges' distance. */
export function pinShift(pin: Pin | undefined, from: Size, to: Size): { dx: number; dy: number } {
  const by = (edge: string | undefined, a: number, b: number) =>
    edge === 'center' ? (b - a) / 2 : edge === 'right' || edge === 'bottom' ? b - a : 0;
  return { dx: by(pin?.x, from.width, to.width), dy: by(pin?.y, from.height, to.height) };
}

/** Resize an output; its top-level layers keep their place by their pins. */
export function resizeOutput(show: Show, outputId: string, to: Size): void {
  const out = show.outputs.find((o) => o.id === outputId);
  if (!out) return;
  for (const l of layerTree(show.layers).roots) {
    if (l.outputId !== outputId) continue;
    const { dx, dy } = pinShift(l.pin, out, to);
    l.x += dx;
    l.y += dy;
  }
  Object.assign(out, { width: to.width, height: to.height });
}

/** Move a top-level layer, and everything inside it, to another output, keeping its pins. */
export function moveToOutput(show: Show, layerId: string, outputId: string): void {
  const tree = layerTree(show.layers);
  const layer = tree.byId.get(layerId);
  const from = show.outputs.find((o) => o.id === layer?.outputId);
  const to = show.outputs.find((o) => o.id === outputId);
  if (!layer || !from || !to || tree.parent(layerId)) return;
  const { dx, dy } = pinShift(layer.pin, from, to);
  layer.x += dx;
  layer.y += dy;
  for (const l of [layer, ...descendantsOf(tree, layerId)]) l.outputId = outputId;
}

/** A new layer goes into a frame: last in a row or column, in front in a free frame. */
export function putInFrame(show: Show, layer: Layer, frameId: string): void {
  const tree = layerTree(show.layers);
  const frame = tree.byId.get(frameId);
  if (!frame || frame.kind !== 'frame') return;
  const zs = tree.children(frameId).map((l) => l.z);
  const flow = isFlow(frame);
  Object.assign(layer, {
    parentId: frameId,
    outputId: frame.outputId,
    visible: true,
    z: flow ? Math.min(0, ...zs) - 1 : Math.max(0, ...zs) + 1,
    x: flow ? 0 : Math.max(0, Math.round((frame.w - layer.w) / 2)),
    y: flow ? 0 : Math.max(0, Math.round((frame.h - layer.h) / 2)),
  });
  // Text in a row or column sizes to its words, so the frame can hug it.
  if (flow && (layer.kind === 'text' || layer.kind === 'counter' || layer.kind === 'state'))
    layer.sizing = 'autoWidth';
}

/** "Lower third › Name": a layer's name with its frames', for pickers and summaries. */
export function layerPath(tree: LayerTree, id: string): string {
  const l = tree.byId.get(id);
  if (!l) return '';
  return [...ancestorsOf(tree, id).reverse(), l].map((x) => x.name).join(' › ');
}

/** The box around all of them; null for none. */
export function bounds(list: Box[]): Box | null {
  if (!list.length) return null;
  const x = Math.min(...list.map((r) => r.x));
  const y = Math.min(...list.map((r) => r.y));
  return {
    x,
    y,
    w: Math.max(...list.map((r) => r.x + r.w)) - x,
    h: Math.max(...list.map((r) => r.y + r.h)) - y,
  };
}

/** Reads where a layer is drawn, in output pixels: the editor canvas, or a test's stand-in. */
export type Measure = (id: string) => Box | null;

/**
 * Wrap sibling layers in a new frame that sits where they are drawn, so nothing moves on stage.
 * The frame takes the front layer's place and the topmost one's pin. A single layer that fits
 * its content gets a row that hugs it, so it still grows away from its pin.
 */
export function frameLayers(show: Show, ids: string[], measure: Measure): string | { why: string } {
  const tree = layerTree(show.layers);
  const picked = outermost(tree, ids).flatMap((id) => tree.byId.get(id) ?? []);
  const first = picked[0];
  if (!first) return { why: 'Select the layers to frame first' };
  const parent = tree.parent(first.id);
  if (picked.some((l) => l.kind === 'audio' || tree.parent(l.id)?.id !== parent?.id))
    return { why: 'Frame layers that sit together: in the same frame, or all on the output' };
  const drawn = picked.map((l) => measure(l.id));
  const around = bounds(drawn.filter((b): b is Box => !!b));
  if (!around || drawn.some((b) => !b))
    return { why: 'Show the layers on the canvas to frame them' };

  const list = siblingsOf(tree, first);
  const top = list.find((l) => picked.includes(l))!;
  const fit = picked.length === 1 ? hugAxes(first) : { w: false, h: false };
  const hugs = fit.w || fit.h;
  const frame: FrameLayer = {
    id: uid('lyr'),
    name: 'Frame',
    kind: 'frame',
    outputId: first.outputId,
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    z: top.z,
    opacity: 1,
    visible: true,
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    fill: 'transparent',
    radius: 0,
    clip: false,
    layout: {
      mode: hugs ? 'row' : 'free',
      gap: 0,
      padX: 0,
      padY: 0,
      align: 'start',
      justify: 'start',
      hugW: fit.w,
      hugH: fit.h,
    },
  };
  Object.assign(
    frame,
    placeAt(parent, around, parent ? (measure(parent.id) ?? undefined) : undefined),
  );
  if (parent) frame.parentId = parent.id;
  if (top.pin && !parent) frame.pin = top.pin;
  show.layers.push(frame);
  picked.forEach((l, i) => {
    Object.assign(l, placeAt(hugs ? frame : undefined, drawn[i]!, around));
    l.parentId = frame.id;
  });
  const order = list.map((l) => l.id).filter((id) => !picked.some((l) => l.id === id));
  order.splice(list.indexOf(top), 0, frame.id);
  restack(show, order);
  return frame.id;
}

/**
 * Take a frame's content out where it is drawn and remove the frame and the actions that used
 * it. The content keeps how it looked at the start: hidden if the frame was, at the frame's
 * opacity, and pinned like it. Returns the content's ids.
 */
export function ungroupFrame(show: Show, frameId: string, measure: Measure): string[] {
  const tree = layerTree(show.layers);
  const frame = tree.byId.get(frameId);
  if (!isFrame(frame)) return [];
  const parent = tree.parent(frameId);
  const parentAt = parent ? (measure(parent.id) ?? undefined) : undefined;
  const kids = tree.children(frameId);
  for (const c of kids) {
    const drawn = measure(c.id);
    if (drawn) Object.assign(c, placeAt(parent, drawn, parentAt));
    if (parent) c.parentId = parent.id;
    else {
      delete c.parentId;
      if (frame.pin) c.pin = frame.pin;
    }
    c.visible = c.visible && frame.visible;
    c.opacity *= frame.opacity;
  }
  restack(
    show,
    siblingsOf(tree, frame).flatMap((l) => (l.id === frameId ? kids : [l]).map((x) => x.id)),
  );
  removeLayer(show, frameId);
  return kids.map((c) => c.id);
}

/**
 * Move layers next to `targetId`, or into it when it is a frame and `position` is 'on', keeping
 * where they are drawn. Refuses a move into a layer's own content. Returns whether it moved.
 */
export function moveLayers(
  show: Show,
  ids: string[],
  targetId: string,
  position: 'before' | 'after' | 'on',
  measure: Measure,
): boolean {
  const tree = layerTree(show.layers);
  const target = tree.byId.get(targetId);
  if (!target) return false;
  const into = position === 'on' ? (isFrame(target) ? target : null) : tree.parent(targetId);
  if (into === null) return false;
  const moving = outermost(tree, ids).flatMap((id) => tree.byId.get(id) ?? []);
  const inside = new Set(
    moving.flatMap((l) => [l.id, ...descendantsOf(tree, l.id).map((d) => d.id)]),
  );
  if (
    !moving.length ||
    (into && inside.has(into.id)) ||
    (position !== 'on' && inside.has(targetId)) ||
    moving.some((l) => l.outputId !== target.outputId || l.kind === 'audio')
  )
    return false;
  const intoAt = into ? (measure(into.id) ?? undefined) : undefined;
  for (const l of moving) {
    if (tree.parent(l.id)?.id === into?.id) continue;
    const drawn = measure(l.id);
    if (drawn) Object.assign(l, placeAt(into, drawn, intoAt));
    if (into) l.parentId = into.id;
    else delete l.parentId;
  }
  const order = (into ? tree.children(into.id) : siblingsOf(tree, target))
    .map((l) => l.id)
    .filter((id) => !moving.some((l) => l.id === id));
  const at =
    position === 'on'
      ? isFlow(into)
        ? order.length
        : 0
      : order.indexOf(targetId) + (position === 'after' ? 1 : 0);
  order.splice(at, 0, ...moving.map((l) => l.id));
  restack(show, order);
  return true;
}
