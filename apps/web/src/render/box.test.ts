import { initialState } from '@scrim/engine';
import { createShow, layerTree, type FrameLayer, type Layer } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import { boxStyle, editorOpacities } from './box.js';

const output = { width: 1920, height: 1080 };
const crop = { top: 0, right: 0, bottom: 0, left: 0 };
const text = (extra: Partial<Layer> = {}): Layer =>
  ({
    id: 't',
    name: 'Text',
    kind: 'text',
    outputId: 'out',
    text: 'Hi',
    x: 100,
    y: 200,
    w: 400,
    h: 100,
    z: 2,
    opacity: 1,
    visible: true,
    crop,
    fontSize: 72,
    color: '#fff',
    fontFamily: 'x',
    fontWeight: 600,
    align: 'center',
    background: 'transparent',
    ...extra,
  }) as Layer;
const frame = (layout: Partial<FrameLayer['layout']> = {}, extra: Partial<FrameLayer> = {}) =>
  ({
    ...text(),
    id: 'f',
    kind: 'frame',
    fill: '#123',
    radius: 8,
    clip: true,
    layout: {
      mode: 'free',
      gap: 0,
      padX: 0,
      padY: 0,
      align: 'center',
      justify: 'start',
      hugW: false,
      hugH: false,
      ...layout,
    },
    ...extra,
  }) as FrameLayer;

describe('boxStyle', () => {
  it('places a fixed top-level box at its x and y, whatever its pin', () => {
    const style = boxStyle(text({ pin: { x: 'right', y: 'bottom' } }), undefined, output);
    expect(style).toMatchObject({
      position: 'absolute',
      left: 100,
      top: 200,
      width: 400,
      height: 100,
      zIndex: 2,
    });
    expect(style.right).toBeUndefined();
  });

  it('grows a hugging box away from its pin', () => {
    const right = boxStyle(
      text({ sizing: 'autoWidth', pin: { x: 'right', y: 'bottom' } }),
      undefined,
      output,
    );
    expect(right).toMatchObject({
      width: 'max-content',
      height: 'max-content',
      right: 1420,
      bottom: 780,
    });
    expect(right.left).toBeUndefined();

    const centred = boxStyle(
      text({ sizing: 'autoWidth', pin: { x: 'center', y: 'top' } }),
      undefined,
      output,
    );
    expect(centred).toMatchObject({ left: 300, top: 200, transform: 'translate(-50%, 0)' });

    const tall = boxStyle(text({ sizing: 'autoHeight' }), undefined, output);
    expect(tall).toMatchObject({ width: 400, height: 'max-content', left: 100, top: 200 });
  });

  it('places children of a free frame relative to it and ignores their pin', () => {
    const style = boxStyle(
      text({ sizing: 'autoWidth', pin: { x: 'right', y: 'top' } }),
      frame(),
      output,
    );
    expect(style).toMatchObject({ position: 'absolute', left: 100, top: 200 });
    expect(style.right).toBeUndefined();
  });

  it('lays children of a row or column frame out in flow', () => {
    const style = boxStyle(text(), frame({ mode: 'row' }), output);
    expect(style).toMatchObject({ position: 'relative', flexShrink: 0, width: 400, height: 100 });
    expect(style.left).toBeUndefined();
  });

  it('draws a frame’s fill and auto layout, and hugs only in a row or column', () => {
    const row = frame({
      mode: 'row',
      gap: 12,
      padX: 24,
      padY: 8,
      align: 'end',
      justify: 'between',
      hugW: true,
    });
    expect(boxStyle(row, undefined, output)).toMatchObject({
      display: 'flex',
      flexDirection: 'row',
      gap: 12,
      padding: '8px 24px',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      background: '#123',
      borderRadius: 8,
      overflow: 'hidden',
      width: 'max-content',
      height: 100,
    });
    const free = boxStyle(frame({ hugW: true }), undefined, output);
    expect(free).toMatchObject({ width: 400 });
    expect(free.display).toBeUndefined();
  });

  it('crops', () => {
    const style = boxStyle(text({ crop: { ...crop, left: 0.25 } }), undefined, output);
    expect(style.clipPath).toBe('inset(0% 0% 0% 25%)');
  });
});

describe('editorOpacities', () => {
  it('shows resting opacity, and with ghosting keeps every layer at 25% however deep', () => {
    const show = createShow('Ghosts');
    const f = frame({}, { visible: false, outputId: show.outputs[0]!.id });
    const child = text({ id: 'c', parentId: 'f', visible: true, outputId: show.outputs[0]!.id });
    const hiddenChild = text({
      id: 'h',
      parentId: 'f',
      visible: false,
      outputId: show.outputs[0]!.id,
    });
    show.layers = [f, child, hiddenChild];
    const tree = layerTree(show.layers);
    const state = initialState(show);

    const plain = editorOpacities(tree, state, false);
    expect(plain.get('f')).toBe(0);

    const ghost = editorOpacities(tree, state, true);
    expect(ghost.get('f')).toBe(0.25);
    expect(ghost.get('c')).toBe(1); // 0.25 × 1 on screen
    expect(ghost.get('h')).toBe(1); // already at 0.25 through the frame, not 0.0625
  });
});
