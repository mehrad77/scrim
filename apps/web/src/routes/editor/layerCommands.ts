import { duplicateLayers, frameLayers, ungroupFrame } from '../../lib/frames.js';
import { layerUsage, removeLayer } from '../../lib/refs.js';
import { useEditor } from '../../state/editor.js';
import { toast } from '../../ui/toast.js';
import { measureLayer } from './measure.js';

/**
 * Layer commands shared by the canvas, the layers tree and the palette, so each works the same
 * wherever it starts.
 */

/** Delete layers, and everything inside frames among them, with Undo in a toast (no prompt). */
export function deleteLayers(ids: string[]): void {
  const { show, update, select } = useEditor.getState();
  if (!show || !ids.length) return;
  const first = show.layers.find((l) => l.id === ids[0]);
  update((d) => ids.forEach((id) => removeLayer(d, id)));
  select({ layerId: null });
  toast(
    `Deleted ${ids.length === 1 ? (first?.name ?? 'layer') : `${ids.length} layers`}`,
    'info',
    undo,
  );
}

/** Duplicate layers with what is inside them, and select the copies. */
export function duplicateSelection(ids: string[]): void {
  const { update, select } = useEditor.getState();
  if (!ids.length) return;
  let copies: string[] = [];
  update((d) => void (copies = duplicateLayers(d, ids)));
  select({ layerId: copies[0] ?? null, extra: copies.slice(1) });
}

const undo = { label: 'Undo', run: () => useEditor.getState().undo() };

/** ⌘G: wrap the selected layers in a frame, where they are drawn. */
export function frameSelection(ids: string[]): void {
  const { update, select } = useEditor.getState();
  let made: string | { why: string } = { why: 'Select the layers to frame first' };
  update((d) => void (made = frameLayers(d, ids, measureLayer)));
  if (typeof made === 'string') select({ layerId: made });
  else toast(made.why, 'info');
}

/** ⇧⌘G: take the content out of the selected frames and remove them, with Undo. */
export function ungroupSelection(ids: string[]): void {
  const { show, update, select } = useEditor.getState();
  const frames = (show?.layers ?? []).filter((l) => ids.includes(l.id) && l.kind === 'frame');
  if (!show || !frames.length) return void toast('Select a frame to ungroup', 'info');
  const uses = frames.reduce((n, f) => n + layerUsage(show, f.id), 0);
  const freed: string[] = [];
  update((d) => frames.forEach((f) => freed.push(...ungroupFrame(d, f.id, measureLayer))));
  select({ layerId: freed[0] ?? null, extra: freed.slice(1) });
  const what = frames.length === 1 ? `“${frames[0]!.name}”` : `${frames.length} frames`;
  toast(
    uses
      ? `Ungrouped ${what}. ${uses} cue or rule action${uses === 1 ? '' : 's'} on it went with it.`
      : `Ungrouped ${what}`,
    'info',
    undo,
  );
}

/** Rename: the layer's name lives in the inspector, so go there. */
export function focusLayerName(): void {
  const el = document.getElementById('layer-name');
  if (el instanceof HTMLInputElement) {
    el.focus();
    el.select();
  }
}
