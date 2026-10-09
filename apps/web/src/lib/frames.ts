import {
  descendantsOf,
  layerTree,
  uid,
  type Layer,
  type LayerTree,
  type Show,
} from '@scrim/format';

/**
 * Editing frames and the order of layers. Lists are front first, like the layers panel; `z`
 * only orders a layer among its siblings.
 */

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
