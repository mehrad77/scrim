import { ancestorsOf, createShow, layerTree, type Layer, type Show } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import {
  duplicateLayers,
  frameLayers,
  moveLayers,
  ungroupFrame,
  type Measure,
  handlesFor,
  isLocked,
  layerPath,
  moveToOutput,
  outermost,
  pickLayer,
  pinShift,
  placeAt,
  putInFrame,
  reorderLayers,
  resizeOutput,
  stepLayer,
} from './frames.js';
import { alignBoxes, distributeBoxes } from './layerActions.js';

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

describe('frames on the canvas', () => {
  const frameOf = (show: Show) =>
    show.layers.find((l) => l.id === 'f') as Extract<Layer, { kind: 'frame' }>;

  it('places a layer by what is drawn, relative to its frame, and leaves rows to place theirs', () => {
    const show = stack();
    const free = frameOf(show);
    expect(
      placeAt(free, { x: 150.4, y: 90, w: 99.6, h: 50 }, { x: 100, y: 40, w: 0, h: 0 }),
    ).toEqual({
      x: 50,
      y: 50,
      w: 100,
      h: 50,
    });
    expect(placeAt(undefined, { x: 12, y: 8, w: 30, h: 20 }, undefined)).toEqual({
      x: 12,
      y: 8,
      w: 30,
      h: 20,
    });
    const row = { ...free, layout: { ...free.layout, mode: 'row' as const } };
    expect(placeAt(row, { x: 150, y: 90, w: 100, h: 50 }, { x: 100, y: 40, w: 0, h: 0 })).toEqual({
      w: 100,
      h: 50,
    });
  });

  it('gives rows’ children only far-edge handles and hugging axes none', () => {
    const show = stack();
    const f = frameOf(show);
    const x = show.layers.find((l) => l.id === 'x')!;
    expect(handlesFor(x, f)).toEqual({
      drag: true,
      dirs: ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'],
    });
    const row = { ...f, layout: { ...f.layout, mode: 'row' as const } };
    expect(handlesFor(x, row)).toEqual({ drag: false, dirs: ['e', 's', 'se'] });
    expect(handlesFor({ ...x, sizing: 'autoWidth' } as Layer, undefined).dirs).toEqual([]);
    expect(handlesFor({ ...x, sizing: 'autoHeight' } as Layer, undefined).dirs).toEqual(['w', 'e']);
  });

  it('picks the outermost frame, then neighbours, and goes deeper on double-click', () => {
    const tree = layerTree(stack().layers);
    expect(pickLayer(tree, 'x', [])).toBe('f');
    expect(pickLayer(tree, 'x', ['y'])).toBe('x');
    expect(pickLayer(tree, 'x', ['f'])).toBe('f');
    expect(pickLayer(tree, 'x', ['f'], true)).toBe('x');
    expect(pickLayer(tree, 'a', ['x'])).toBe('a');
  });

  it('keeps pinned layers’ distance to their edges when the output changes size', () => {
    const from = { width: 1920, height: 1080 };
    const to = { width: 1280, height: 720 };
    expect(pinShift({ x: 'right', y: 'bottom' }, from, to)).toEqual({ dx: -640, dy: -360 });
    expect(pinShift({ x: 'center', y: 'top' }, from, to)).toEqual({ dx: -320, dy: 0 });
    expect(pinShift(undefined, from, to)).toEqual({ dx: 0, dy: 0 });

    const show = stack();
    const out = show.outputs[0]!;
    show.layers.find((l) => l.id === 'b')!.pin = { x: 'right', y: 'bottom' };
    resizeOutput(show, out.id, to);
    expect(out).toMatchObject(to);
    expect(show.layers.find((l) => l.id === 'b')).toMatchObject({ x: 10 - 640, y: 10 - 360 });
    expect(show.layers.find((l) => l.id === 'x')).toMatchObject({ x: 10, y: 10 });
    resizeOutput(show, out.id, from);
    expect(show.layers.find((l) => l.id === 'b')).toMatchObject({ x: 10, y: 10 });
  });

  it('moves a frame and its content to another output', () => {
    const show = stack();
    show.outputs.push({ ...show.outputs[0]!, id: 'small', width: 960, height: 540 });
    frameOf(show).pin = { x: 'center', y: 'center' };
    moveToOutput(show, 'f', 'small');
    expect(show.layers.filter((l) => l.outputId === 'small').map((l) => l.id)).toEqual([
      'f',
      'x',
      'y',
    ]);
    expect(frameOf(show)).toMatchObject({ x: 10 - 480, y: 10 - 270 });
    moveToOutput(show, 'x', show.outputs[0]!.id);
    expect(show.layers.find((l) => l.id === 'x')!.outputId).toBe('small');
  });

  it('puts a new layer last in a row and in front in a free frame', () => {
    const show = stack();
    const t = { ...show.layers[0]!, id: 'new', parentId: undefined, visible: false };
    show.layers.push(t);
    putInFrame(show, t, 'f');
    expect(t).toMatchObject({ parentId: 'f', visible: true, z: 3 });
    const f = frameOf(show);
    f.layout = { ...f.layout, mode: 'row' };
    const u = { ...show.layers[0]!, id: 'new2', parentId: undefined };
    show.layers.push(u);
    putInFrame(show, u, 'f');
    expect(u).toMatchObject({ parentId: 'f', z: -1, sizing: 'autoWidth' });
  });

  it('locks what is inside a locked frame', () => {
    const show = stack();
    frameOf(show).locked = true;
    const tree = layerTree(show.layers);
    expect(['f', 'x', 'a'].map((id) => isLocked(tree, id))).toEqual([true, true, false]);
  });

  it('names layers by their frames', () => {
    expect(layerPath(layerTree(stack().layers), 'x')).toBe('f › x');
  });
});

describe('lining up drawn boxes', () => {
  const boxes = new Map([
    ['a', { x: 10, y: 10, w: 100, h: 20 }],
    ['b', { x: 300, y: 50, w: 50, h: 40 }],
  ]);

  it('aligns one box in its container and several to their bounds', () => {
    const one = alignBoxes(
      new Map([['a', boxes.get('a')!]]),
      { x: 0, y: 0, w: 1000, h: 500 },
      'center',
    );
    expect(one.get('a')).toMatchObject({ x: 450 });
    const right = alignBoxes(boxes, { x: 0, y: 0, w: 1000, h: 500 }, 'right');
    expect(right.get('a')).toMatchObject({ x: 250 });
    expect(right.get('b')).toMatchObject({ x: 300 });
  });

  it('spreads three boxes evenly', () => {
    const three = new Map([...boxes, ['c', { x: 100, y: 0, w: 10, h: 10 }]]);
    const out = distributeBoxes(three, 'x');
    // Span 10–350 holds 160 of boxes, so each of the two gaps is 90.
    expect(out.get('c')).toMatchObject({ x: 200 });
  });
});

describe('framing and nesting', () => {
  /** Where layers are drawn, from the model: right for free frames, which is all stack() has. */
  const drawnIn =
    (show: Show): Measure =>
    (id) => {
      const tree = layerTree(show.layers);
      const l = tree.byId.get(id);
      if (!l) return null;
      const around = ancestorsOf(tree, id);
      return {
        x: l.x + around.reduce((n, f) => n + f.x, 0),
        y: l.y + around.reduce((n, f) => n + f.y, 0),
        w: l.w,
        h: l.h,
      };
    };
  const everywhere = (show: Show) => show.layers.map((l) => [l.id, drawnIn(show)(l.id)]);

  it('frames siblings where they are drawn, and ungrouping puts them back', () => {
    const show = stack();
    show.layers.find((l) => l.id === 'a')!.x = 300;
    const before = everywhere(show);
    const id = frameLayers(show, ['a', 'b'], drawnIn(show));
    expect(typeof id).toBe('string');
    const frame = show.layers.find((l) => l.id === id)!;
    expect(frame).toMatchObject({ kind: 'frame', x: 10, y: 10, w: 390, h: 100, visible: true });
    expect(order(show)).toEqual(['f', id]);
    expect(order(show, id as string)).toEqual(['b', 'a']);
    expect(everywhere(show).filter(([l]) => l !== id)).toEqual(before);

    expect(ungroupFrame(show, id as string, drawnIn(show))).toEqual(['b', 'a']);
    expect(everywhere(show)).toEqual(before);
    expect(order(show)).toEqual(['f', 'b', 'a']);
  });

  it('refuses to frame layers from different frames', () => {
    const show = stack();
    expect(frameLayers(show, ['a', 'x'], drawnIn(show))).toHaveProperty('why');
  });

  it('wraps one layer that fits its text in a row that hugs it and takes its pin', () => {
    const show = stack();
    Object.assign(
      show.layers.find((l) => l.id === 'a')!,
      {
        sizing: 'autoWidth',
        pin: { x: 'right', y: 'top' },
      },
    );
    const id = frameLayers(show, ['a'], drawnIn(show)) as string;
    expect(show.layers.find((l) => l.id === id)).toMatchObject({
      pin: { x: 'right', y: 'top' },
      layout: { mode: 'row', hugW: true, hugH: true },
    });
  });

  it('ungrouping keeps the content hidden if its frame started hidden', () => {
    const show = stack();
    Object.assign(
      show.layers.find((l) => l.id === 'f')!,
      { visible: false, opacity: 0.5 },
    );
    show.cues[0]!.actions.push({ type: 'show', layerId: 'f', duration: 0, easing: 'linear' });
    ungroupFrame(show, 'f', drawnIn(show));
    expect(show.layers.find((l) => l.id === 'x')).toMatchObject({ visible: false, opacity: 0.5 });
    expect(show.layers.some((l) => l.id === 'f')).toBe(false);
    expect(show.cues[0]!.actions).toEqual([]);
  });

  it('moves layers into and out of frames where they are drawn, but never into themselves', () => {
    const show = stack();
    const before = everywhere(show);
    expect(moveLayers(show, ['a'], 'f', 'on', drawnIn(show))).toBe(true);
    expect(order(show, 'f')).toEqual(['a', 'y', 'x']);
    expect(moveLayers(show, ['y'], 'b', 'after', drawnIn(show))).toBe(true);
    expect(order(show)).toEqual(['f', 'b', 'y']);
    expect(everywhere(show)).toEqual(before);
    expect(moveLayers(show, ['f'], 'x', 'before', drawnIn(show))).toBe(false);
    expect(moveLayers(show, ['f'], 'f', 'on', drawnIn(show))).toBe(false);
  });
});
