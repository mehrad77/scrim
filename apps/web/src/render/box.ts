import type { EngineState } from '@scrim/engine';
import { hugAxes, type FrameLayer, type Layer, type LayerTree, type Output } from '@scrim/format';
import type { CSSProperties } from 'react';

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' } as const;
const JUSTIFY = { ...ALIGN, between: 'space-between' } as const;

/**
 * Where a layer's box sits and how big it is, in its container's pixels: the output for a
 * top-level layer, the frame for one inside a frame. Pure, so it is tested without a DOM.
 *
 * - In a row or column frame the layer is laid out in flow and its x and y are ignored.
 * - On an axis that hugs its content, x/w (or y/h) only fix the edge it grows from: a top-level
 *   layer grows away from its pin; inside a free frame it grows right and down.
 */
export function boxStyle(
  layer: Layer,
  parent: FrameLayer | undefined,
  output: Pick<Output, 'width' | 'height'>,
): CSSProperties {
  const hug = hugAxes(layer);
  const style: CSSProperties = {
    width: hug.w ? 'max-content' : layer.w,
    height: hug.h ? 'max-content' : layer.h,
    zIndex: layer.z,
    ...frameStyle(layer),
    ...cropStyle(layer),
  };
  if (parent && parent.layout.mode !== 'free')
    return { ...style, position: 'relative', flexShrink: 0 };

  style.position = 'absolute';
  const pin = parent ? undefined : layer.pin;
  const shift: string[] = [];
  for (const axis of ['x', 'y'] as const) {
    const across = axis === 'x';
    const start = across ? 'left' : 'top';
    const end = across ? 'right' : 'bottom';
    const size = across ? layer.w : layer.h;
    const room = across ? output.width : output.height;
    const edge = pin?.[axis];
    if (!(across ? hug.w : hug.h) || !edge || edge === start) style[start] = layer[axis];
    else if (edge === 'center') {
      style[start] = layer[axis] + size / 2;
      shift.push(axis);
    } else style[end] = room - (layer[axis] + size);
  }
  // `transform`, not `translate`, so the editor can move a centred layer with `translate`.
  if (shift.length)
    style.transform = `translate(${shift.includes('x') ? '-50%' : '0'}, ${shift.includes('y') ? '-50%' : '0'})`;
  return style;
}

function frameStyle(layer: Layer): CSSProperties {
  if (layer.kind !== 'frame') return {};
  const { mode, gap, padX, padY, align, justify } = layer.layout;
  return {
    background: layer.fill,
    borderRadius: layer.radius || undefined,
    overflow: layer.clip ? 'hidden' : undefined,
    ...(mode === 'free'
      ? {}
      : {
          display: 'flex',
          flexDirection: mode,
          gap,
          padding: `${padY}px ${padX}px`,
          alignItems: ALIGN[align],
          justifyContent: JUSTIFY[justify],
        }),
  };
}

function cropStyle(layer: Layer): CSSProperties {
  const { top, right, bottom, left } = layer.crop;
  return top || right || bottom || left
    ? { clipPath: `inset(${top * 100}% ${right * 100}% ${bottom * 100}% ${left * 100}%)` }
    : {};
}

/**
 * The opacity each editor node gets, so the stage shows the layers' resting opacity and, with
 * `ghost`, every layer at 25% or more however deep it sits. Opacity multiplies down the tree in
 * CSS, so each node's value is what it needs on top of its frames.
 */
export function editorOpacities(
  tree: LayerTree,
  state: EngineState,
  ghost: boolean,
): Map<string, number> {
  const out = new Map<string, number>();
  const visit = (l: Layer, above: number) => {
    const own = state.layers[l.id]?.opacity.to ?? 0;
    const seen = ghost ? Math.max(above * own, 0.25) : above * own;
    out.set(l.id, above > 0 ? Math.min(1, seen / above) : own);
    for (const c of tree.children(l.id)) visit(c, seen);
  };
  for (const r of tree.roots) visit(r, 1);
  return out;
}
