import { relaxedBrightness, tweenValue, type EngineState } from '@scrim/engine';
import {
  descendantsOf,
  isFrame,
  layerTree,
  type FrameLayer,
  type Layer,
  type Show,
} from '@scrim/format';
import { useShowFonts } from './useShowFonts.js';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { JoinInfo } from '@scrim/protocol';
import { epochNow } from '../lib/clock.js';
import { boxStyle, editorOpacities } from './box.js';
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
  /** How phones join, for {{join_code}} and join QR codes; absent in the editor. */
  join?: JoinInfo | null;
  /** Editor: draw layers that are hidden at this point faintly. */
  ghostHidden?: boolean;
  /** Rendered inside the scaled canvas, above the layers (editor handles). */
  overlay?: (scale: number) => ReactNode;
  onBackgroundPointerDown?: () => void;
  onLayerPointerDown?: (layerId: string, e: React.PointerEvent) => void;
}

/**
 * Draws one output: layers placed in output pixels, scaled to fit the parent, with each frame's
 * content nested inside it. Opacity fades run in a frame loop straight on the DOM, so React
 * re-renders only when the show or engine state changes.
 */
export function Stage(props: StageProps) {
  const { show, state, outputId, variant, clock = epochNow } = props;
  const output = show.outputs.find((o) => o.id === outputId);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const layerEls = useRef(new Map<string, HTMLDivElement>());
  useShowFonts(show);
  const blackoutEl = useRef<HTMLDivElement>(null);
  const dimEl = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tree = useMemo(
    () => layerTree(show.layers.filter((l) => l.outputId === outputId && l.kind !== 'audio')),
    [show.layers, outputId],
  );
  const layers = useMemo(
    () => tree.roots.flatMap((r) => [r, ...descendantsOf(tree, r.id)]),
    [tree],
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
        // Never 'visible': that would show a layer inside a frame that is hidden.
        el.style.visibility = v <= 0.001 ? 'hidden' : '';
      }
      if (blackoutEl.current) {
        const b = tweenValue(state.blackout, now);
        blackoutEl.current.style.opacity = String(b);
        blackoutEl.current.style.visibility = b <= 0.001 ? 'hidden' : 'visible';
      }
      if (dimEl.current) {
        const d = 1 - relaxedBrightness(show, state, now);
        dimEl.current.style.opacity = String(d);
        dimEl.current.style.visibility = d <= 0.001 ? 'hidden' : 'visible';
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
  }, [variant, layers, state, show, clock]);

  if (!output) {
    return (
      <div className="flex size-full items-center justify-center bg-black text-xs text-fg-subtle">
        No such output
      </div>
    );
  }

  const topZ = tree.roots.reduce((z, l) => Math.max(z, l.z), 0);
  const resting =
    variant === 'editor' ? editorOpacities(tree, state, !!props.ghostHidden) : undefined;
  const draw = (layer: Layer, parent?: FrameLayer): ReactNode => (
    <LayerBox
      key={layer.id}
      layer={layer}
      style={{
        ...boxStyle(layer, parent, output),
        // On the editor canvas clicks pass through a locked layer, and through what it holds.
        ...(props.onLayerPointerDown && layer.locked ? { pointerEvents: 'none' as const } : {}),
      }}
      ref={(el) => {
        if (el) layerEls.current.set(layer.id, el);
        else layerEls.current.delete(layer.id);
      }}
      initialOpacity={resting?.get(layer.id) ?? 0}
      onPointerDown={props.onLayerPointerDown && ((e) => props.onLayerPointerDown!(layer.id, e))}
    >
      {isFrame(layer) ? (
        inDrawingOrder(tree.children(layer.id), layer).map((c) => draw(c, layer))
      ) : (
        <LayerView
          layer={layer}
          show={show}
          state={state}
          variant={variant}
          clock={clock}
          onMediaEnded={props.onMediaEnded}
          onAudioBlocked={props.onAudioBlocked}
          join={props.join}
        />
      )}
    </LayerBox>
  );

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
          data-stage-canvas
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
          {inDrawingOrder(tree.roots).map((l) => draw(l))}
          {variant !== 'editor' && (
            <div
              ref={dimEl}
              data-relaxed-dim
              className="pointer-events-none absolute inset-0 bg-black"
              // A relaxed performance dims everything on the output, its background too.
              style={{ opacity: 0, visibility: 'hidden', zIndex: topZ + 1 }}
            />
          )}
          {variant !== 'editor' && (
            <div
              ref={blackoutEl}
              data-blackout
              className="pointer-events-none absolute inset-0 bg-black"
              // Above every layer, since layers carry their own z-index: PANIC covers everything.
              style={{ opacity: 0, visibility: 'hidden', zIndex: topZ + 2 }}
            />
          )}
          {props.overlay?.(scale)}
        </div>
      )}
    </div>
  );
}

/**
 * Lists come front first. Rows and columns lay out in that order; everywhere else the back is
 * drawn first, so on equal z the front of the list still wins.
 */
function inDrawingOrder(list: Layer[], frame?: FrameLayer): Layer[] {
  return frame && frame.layout.mode !== 'free' ? list : [...list].reverse();
}

function LayerBox({
  layer,
  style,
  initialOpacity,
  children,
  onPointerDown,
  ref,
}: {
  layer: Layer;
  style: CSSProperties;
  initialOpacity: number;
  children: ReactNode;
  onPointerDown?: ((e: React.PointerEvent) => void) | undefined;
  ref: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={ref}
      data-layer={layer.id}
      onPointerDown={onPointerDown}
      style={{
        ...style,
        opacity: initialOpacity,
        // Hidden or inherited, never 'visible', so a hidden frame hides what is inside it.
        visibility: initialOpacity <= 0.001 && !onPointerDown ? 'hidden' : undefined,
      }}
    >
      {children}
    </div>
  );
}
