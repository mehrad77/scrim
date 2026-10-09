import { tweenValue, type EngineState } from '@scrim/engine';
import { useShowFonts } from './useShowFonts.js';
import type { Layer, Show } from '@scrim/format';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { epochNow } from '../lib/clock.js';
import { cornerPinMatrix, hasPin } from './cornerPin.js';
import { LayerView } from './layers/LayerView.js';

export type StageVariant = 'output' | 'thumb' | 'editor';

export interface StageProps {
  show: Show;
  state: EngineState;
  outputId: string;
  variant: StageVariant;
  clock?: () => number;
  /** Called when a non-looping video reaches its end (output windows only). */
  onMediaEnded?: (layerId: string) => void;
  onAudioBlocked?: () => void;
  /** Editor: draw layers that are hidden at this point faintly. */
  ghostHidden?: boolean;
  /** Rendered inside the scaled canvas, above the layers (editor handles). */
  overlay?: (scale: number) => ReactNode;
  onBackgroundPointerDown?: () => void;
  onLayerPointerDown?: (layerId: string, e: React.PointerEvent) => void;
}

/**
 * Draws one output: layers placed in output pixels, scaled to fit the parent.
 * Opacity fades run in a frame loop straight on the DOM, so React re-renders
 * only when the show or engine state changes.
 */
export function Stage(props: StageProps) {
  const { show, state, outputId, variant, clock = epochNow } = props;
  const output = show.outputs.find((o) => o.id === outputId);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const layerEls = useRef(new Map<string, HTMLDivElement>());
  useShowFonts(show);
  const blackoutEl = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layers = useMemo(
    () =>
      show.layers
        .filter((l) => l.outputId === outputId && l.kind !== 'audio')
        .sort((a, b) => a.z - b.z),
    [show.layers, outputId],
  );

  // Frame loop for fades. requestAnimationFrame stops in hidden or occluded
  // windows, so a slow timer keeps the picture right there too.
  useEffect(() => {
    if (variant === 'editor') return;
    const apply = () => {
      const now = clock();
      for (const layer of layers) {
        const el = layerEls.current.get(layer.id);
        const ls = state.layers[layer.id];
        if (!el || !ls) continue;
        const v = tweenValue(ls.opacity, now);
        el.style.opacity = String(v);
        el.style.visibility = v <= 0.001 ? 'hidden' : 'visible';
      }
      if (blackoutEl.current) {
        const b = tweenValue(state.blackout, now);
        blackoutEl.current.style.opacity = String(b);
        blackoutEl.current.style.visibility = b <= 0.001 ? 'hidden' : 'visible';
      }
    };
    let raf = 0;
    const loop = () => {
      apply();
      raf = requestAnimationFrame(loop);
    };
    loop();
    const backup = setInterval(apply, 250);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(backup);
    };
  }, [variant, layers, state, clock]);

  if (!output) {
    return (
      <div className="flex size-full items-center justify-center bg-black text-xs text-fg-subtle">
        No such output
      </div>
    );
  }

  const topZ = layers.reduce((z, l) => Math.max(z, l.z), 0);
  const scale = size.w && size.h ? Math.min(size.w / output.width, size.h / output.height) : 0;
  const offX = (size.w - output.width * scale) / 2;
  const offY = (size.h - output.height * scale) / 2;
  const pin =
    variant === 'output' && hasPin(output.cornerPin)
      ? ` ${cornerPinMatrix(output.width, output.height, output.cornerPin)}`
      : '';

  return (
    <div
      ref={box}
      className="relative size-full overflow-hidden"
      style={{ background: variant === 'output' ? '#000' : undefined }}
    >
      {scale > 0 && (
        <div
          className="absolute top-0 left-0 overflow-hidden"
          style={{
            width: output.width,
            height: output.height,
            background: output.background,
            transformOrigin: '0 0',
            transform: `translate(${offX}px, ${offY}px) scale(${scale})${pin}`,
          }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) props.onBackgroundPointerDown?.();
          }}
        >
          {layers.map((layer) => (
            <LayerBox
              key={layer.id}
              layer={layer}
              ref={(el) => {
                if (el) layerEls.current.set(layer.id, el);
                else layerEls.current.delete(layer.id);
              }}
              initialOpacity={editorOpacity(layer, state, variant, props.ghostHidden)}
              onPointerDown={
                props.onLayerPointerDown && ((e) => props.onLayerPointerDown!(layer.id, e))
              }
            >
              <LayerView
                layer={layer}
                show={show}
                state={state}
                variant={variant}
                clock={clock}
                onMediaEnded={props.onMediaEnded}
                onAudioBlocked={props.onAudioBlocked}
              />
            </LayerBox>
          ))}
          {variant !== 'editor' && (
            <div
              ref={blackoutEl}
              className="pointer-events-none absolute inset-0 bg-black"
              // Above every layer, since layers carry their own z-index: PANIC covers everything.
              style={{ opacity: 0, visibility: 'hidden', zIndex: topZ + 1 }}
            />
          )}
          {props.overlay?.(scale)}
        </div>
      )}
    </div>
  );
}

function editorOpacity(
  layer: Layer,
  state: EngineState,
  variant: StageVariant,
  ghost?: boolean,
): number {
  if (variant !== 'editor') return 0;
  const v = state.layers[layer.id]?.opacity.to ?? 0;
  return ghost ? Math.max(v, 0.25) : v;
}

function LayerBox({
  layer,
  initialOpacity,
  children,
  onPointerDown,
  ref,
}: {
  layer: Layer;
  initialOpacity: number;
  children: ReactNode;
  onPointerDown?: ((e: React.PointerEvent) => void) | undefined;
  ref: (el: HTMLDivElement | null) => void;
}) {
  const { top, right, bottom, left } = layer.crop;
  const cropped = top || right || bottom || left;
  return (
    <div
      ref={ref}
      data-layer={layer.id}
      className="absolute"
      onPointerDown={onPointerDown}
      style={{
        left: layer.x,
        top: layer.y,
        width: layer.w,
        height: layer.h,
        zIndex: layer.z,
        opacity: initialOpacity,
        visibility: initialOpacity <= 0.001 && !onPointerDown ? 'hidden' : 'visible',
        clipPath: cropped
          ? `inset(${top * 100}% ${right * 100}% ${bottom * 100}% ${left * 100}%)`
          : undefined,
      }}
    >
      {children}
    </div>
  );
}
