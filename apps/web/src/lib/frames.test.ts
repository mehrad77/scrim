import { createShow, layerTree, type Layer, type Show } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import { duplicateLayers, outermost, reorderLayers, stepLayer } from './frames.js';

const crop = { top: 0, right: 0, bottom: 0, left: 0 };
const layout = {
  mode: 'free',
  gap: 0,
  padX: 0,
  padY: 0,
  align: 'center',
  justify: 'start',
  hugW: false,
  hugH: false,
} as const;

/** a, b and frame f on the output (front first: f, b, a); f holds x and y (front first: y, x). */
function stack(): Show {
  const show = createShow('Stack');
  const out = show.outputs[0]!.id;
  const base = { outputId: out, x: 10, y: 10, w: 100, h: 100, opacity: 1, visible: true, crop };
  const text = (id: string, z: number, parentId?: string): Layer =>
    ({
      ...base,
      id,
      name: id,
      kind: 'text',
      text: id,
      z,
      ...(parentId ? { parentId } : {}),
      fontSize: 10,
      color: '#fff',
      fontFamily: 'x',
      fontWeight: 400,
      align: 'center',
      background: 'transparent',
    }) as Layer;
  show.layers = [
    text('a', 1),
    text('b', 2),
    {
      ...base,
      id: 'f',
      name: 'f',
      kind: 'frame',
      z: 3,
      fill: '#000',
      radius: 0,
      clip: false,
      layout,
    },
    text('x', 1, 'f'),
    text('y', 2, 'f'),
  ];
  return show;
}
const order = (show: Show, parent?: string) => {
  const tree = layerTree(show.layers);
  return (parent ? tree.children(parent) : tree.roots).map((l) => l.id);
};

describe('frames in the editor', () => {
  it('keeps only the outermost of a selection', () => {
    expect(outermost(layerTree(stack().layers), ['x', 'f', 'a'])).toEqual(['f', 'a']);
  });

  it('reorders among siblings and refuses to move a layer into another frame', () => {
    const show = stack();
    reorderLayers(show, ['a'], 'f', 'before');
    expect(order(show)).toEqual(['a', 'f', 'b']);
    reorderLayers(show, ['x'], 'f', 'after');
    expect(order(show)).toEqual(['a', 'f', 'b']);
    expect(order(show, 'f')).toEqual(['y', 'x']);
  });

  it('steps a layer forward and back within its frame', () => {
    const show = stack();
    stepLayer(show, 'x', 1);
    expect(order(show, 'f')).toEqual(['x', 'y']);
    stepLayer(show, 'x', 1);
    expect(order(show, 'f')).toEqual(['x', 'y']);
    stepLayer(show, 'b', -1);
    expect(order(show)).toEqual(['f', 'a', 'b']);
  });

  it('duplicates a frame with everything in it, just in front of the original', () => {
    const show = stack();
    const [copy] = duplicateLayers(show, ['f', 'x']);
    expect(order(show)).toEqual([copy, 'f', 'b', 'a']);
    const inside = order(show, copy);
    expect(inside).toHaveLength(2);
    expect(inside).not.toContain('x');
    const head = show.layers.find((l) => l.id === copy)!;
    expect(head).toMatchObject({ name: 'f copy', x: 50, y: 50 });
  });
});
