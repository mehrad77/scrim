import { layerTree, type Show } from '@scrim/format';
import { placeAt, type Box } from '../../lib/frames.js';

/**
 * Reading what the editor canvas draws. Layers that hug their content or sit in a row have no
 * model size or place of their own, so moving, aligning and switching layout go by what is drawn.
 */

/** Marks the editor canvas, as opposed to thumbnails, which draw the same layers. */
export const CANVAS_ATTR = 'data-editor-canvas';

/** A layer's drawn box on the editor canvas, in output pixels. */
export function measureLayer(id: string): Box | null {
  // The stage is drawn in output pixels and scaled, so its own box gives the scale.
  const canvas = document.querySelector<HTMLElement>(`[${CANVAS_ATTR}] [data-stage-canvas]`);
  const el = canvas?.querySelector<HTMLElement>(`[data-layer="${CSS.escape(id)}"]`);
  if (!canvas || !el) return null;
  const c = canvas.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const s = c.width / canvas.offsetWidth;
  if (!s) return null;
  return { x: (r.left - c.left) / s, y: (r.top - c.top) / s, w: r.width / s, h: r.height / s };
}

/** Put a layer where `drawn` is, in output pixels. For use inside `update`. */
export function placeDrawn(d: Show, id: string, drawn: Box): void {
  const tree = layerTree(d.layers);
  const layer = tree.byId.get(id);
  if (!layer) return;
  const parent = tree.parent(id);
  const frameAt = parent ? (measureLayer(parent.id) ?? undefined) : undefined;
  Object.assign(layer, placeAt(parent, drawn, frameAt));
}

/** Write a layer's drawn place and size into the show, so changing how it sizes doesn't move it. */
export function keepDrawn(d: Show, id: string): void {
  const drawn = measureLayer(id);
  if (drawn) placeDrawn(d, id, drawn);
}
