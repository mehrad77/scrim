import { duplicateLayers } from '../../lib/frames.js';
import { removeLayer } from '../../lib/refs.js';
import { useEditor } from '../../state/editor.js';
import { toast } from '../../ui/toast.js';

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
  toast(`Deleted ${ids.length === 1 ? (first?.name ?? 'layer') : `${ids.length} layers`}`, 'info', {
    label: 'Undo',
    run: () => useEditor.getState().undo(),
  });
}

/** Duplicate layers with what is inside them, and select the copies. */
export function duplicateSelection(ids: string[]): void {
  const { update, select } = useEditor.getState();
  if (!ids.length) return;
  let copies: string[] = [];
  update((d) => void (copies = duplicateLayers(d, ids)));
  select({ layerId: copies[0] ?? null, extra: copies.slice(1) });
}

/** Rename: the layer's name lives in the inspector, so go there. */
export function focusLayerName(): void {
  const el = document.getElementById('layer-name');
  if (el instanceof HTMLInputElement) {
    el.focus();
    el.select();
  }
}
