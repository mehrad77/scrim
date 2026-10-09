import { cueOrder, descendantsOf, layerTree, type Layer, type Output } from '@scrim/format';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ChevronLeft,
  ChevronRight,
  Copy,
  Maximize2,
  Minus,
  Plus,
  Replace,
  StretchHorizontal,
  StretchVertical,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Moveable from 'react-moveable';
import { isTyping, overlayOpen } from '../../host/inputs.js';
import { cn } from '../../lib/cn.js';
import { readPrefs } from '../../lib/prefs.js';
import { bounds, handlesFor, outermost, pickLayer, type Box } from '../../lib/frames.js';
import {
  alignBoxes,
  cueBringingIn,
  distributeBoxes,
  insertCueAfter,
  nudgeLayers,
  type Align,
} from '../../lib/layerActions.js';
import { layerForMedia } from '../../lib/layers.js';
import { Stage } from '../../render/Stage.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { Select, Toggle } from '../../ui/Field.js';
import { MenuButton } from '../../ui/Menu.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { toast } from '../../ui/toast.js';
import { previewState } from '../../lib/simulate.js';
import {
  deleteLayers,
  duplicateSelection,
  frameSelection,
  ungroupSelection,
} from './layerCommands.js';
import { CANVAS_ATTR, measureLayer, placeDrawn } from './measure.js';

const PAD = 32;
const RULER = 16;
const clampZoom = (z: number) => Math.min(8, Math.max(0.1, z));

/**
 * The Stage canvas (UX principle 6, "Touch the work"): the stage at the selected cue, with the
 * designer's precision kit. Direct manipulation is 1:1 and never animated.
 */
export function Canvas() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const { outputId, layerId, extra, cueId } = useEditor((s) => s.selection);
  const output = show.outputs.find((o) => o.id === outputId) ?? show.outputs[0];
  const order = useMemo(() => cueOrder(show), [show]);

  // What the canvas shows: the selected cue by default; the picker can pin another one.
  const [pinned, setPinned] = useState<string | null>(null);
  const at = pinned ?? cueId ?? '__top';
  const [everyLayer, setEveryLayer] = useState(false);
  const [ghost, setGhost] = useState(true);
  const [guides, setGuides] = useState(true);

  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [space, setSpace] = useState(false);
  const [noSnap, setNoSnap] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [targets, setTargets] = useState<HTMLElement[]>([]);

  const state = useMemo(() => {
    if (everyLayer) {
      const s = previewState(show, null);
      for (const l of show.layers) {
        const ls = s.layers[l.id];
        if (ls) ls.opacity = { ...ls.opacity, from: l.opacity, to: l.opacity };
      }
      return s;
    }
    return previewState(show, at === '__top' ? null : at);
  }, [show, at, everyLayer]);

  const selectedIds = useMemo(
    () =>
      [layerId, ...extra].filter(
        (id): id is string =>
          !!id && show.layers.some((l) => l.id === id && l.outputId === output?.id),
      ),
    [layerId, extra, show.layers, output?.id],
  );
  const primary = show.layers.find((l) => l.id === selectedIds[0]);
  const tree = useMemo(() => layerTree(show.layers), [show.layers]);
  // Moving a frame moves what is inside it, so only the outermost selected layers get handles.
  const movable = useMemo(() => outermost(tree, selectedIds), [tree, selectedIds]);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(
      ([e]) => e && setVp({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit =
    output && vp.w
      ? Math.min((vp.w - PAD * 2) / output.width, (vp.h - PAD * 2) / output.height)
      : 0;
  const scale = fit * zoom;
  const boxW = output ? output.width * scale : 0;
  const boxH = output ? output.height * scale : 0;
  const contentW = Math.max(vp.w, boxW + PAD * 2);
  const contentH = Math.max(vp.h, boxH + PAD * 2);
  const boxLeft = (contentW - boxW) / 2;
  const boxTop = (contentH - boxH) / 2;

  // What the selected layers look like on the canvas, in output pixels. Layers that hug their
  // content or sit in a row have no size or place of their own, so handles, the task bar and
  // zoom go by what is drawn. Moveable drives flat stand-ins for them; the layers follow.
  const [drawn, setDrawn] = useState<Map<string, Box>>(new Map());
  const remeasure = () => {
    const next = new Map<string, Box>();
    for (const id of movable) {
      const b = measureLayer(id);
      if (b) next.set(id, b);
    }
    setDrawn((prev) => (JSON.stringify([...prev]) === JSON.stringify([...next]) ? prev : next));
  };
  useLayoutEffect(remeasure);
  useEffect(() => {
    document.fonts.addEventListener('loadingdone', remeasure);
    return () => document.fonts.removeEventListener('loadingdone', remeasure);
  });
  const proxies = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setTargets(
        movable.map((sid) => proxies.current.get(sid)).filter((e): e is HTMLDivElement => !!e),
      ),
    );
    return () => cancelAnimationFrame(id);
  }, [movable, drawn]);
  const nodeOf = (id: string | null) =>
    id ? box.current?.querySelector<HTMLElement>(`[data-layer="${CSS.escape(id)}"]`) : null;
  // During a gesture the layer follows its stand-in by `translate`, which React never sets.
  const follow = (proxy: HTMLElement | SVGElement, dx: number, dy: number) => {
    const el = nodeOf(proxy.getAttribute('data-proxy'));
    if (el) el.style.translate = `${dx}px ${dy}px`;
  };
  // Once the move is in the show the layer is drawn in its new place; drop the offsets then.
  const settle = () =>
    requestAnimationFrame(() =>
      box.current
        ?.querySelectorAll<HTMLElement>('[data-layer]')
        .forEach((el) => el.style.translate && (el.style.translate = '')),
    );
  const start = (id: string | null) => (id && drawn.get(id)) || null;
  const handles = primary ? handlesFor(primary, tree.parent(primary.id)) : null;
  const canDrag = movable.every((id) => {
    const l = tree.byId.get(id);
    return !!l && handlesFor(l, tree.parent(id)).drag;
  });

  const zoomTo = (z: number, focus?: { x: number; y: number }) => {
    const el = viewport.current;
    const next = clampZoom(z);
    if (!el || !output) return setZoom(next);
    // Keep the point under `focus` (output px) where it is, or the view centred.
    const f = focus ?? {
      x: (el.scrollLeft + vp.w / 2 - boxLeft) / scale,
      y: (el.scrollTop + vp.h / 2 - boxTop) / scale,
    };
    setZoom(next);
    requestAnimationFrame(() => {
      const s = fit * next;
      const cw = Math.max(vp.w, output.width * s + PAD * 2);
      const ch = Math.max(vp.h, output.height * s + PAD * 2);
      el.scrollLeft = (cw - output.width * s) / 2 + f.x * s - vp.w / 2;
      el.scrollTop = (ch - output.height * s) / 2 + f.y * s - vp.h / 2;
    });
  };

  const sel = bounds([...drawn.values()]);
  const zoomToSelection = () => {
    if (!sel || !output) return;
    const z = Math.min((vp.w * 0.8) / (sel.w * fit), (vp.h * 0.8) / (sel.h * fit));
    zoomTo(z, { x: sel.x + sel.w / 2, y: sel.y + sel.h / 2 });
  };

  // ⌘/Ctrl + scroll zooms around the pointer.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = box.current?.getBoundingClientRect();
      const focus =
        r && scale
          ? { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
          : undefined;
      zoomTo(zoom * Math.exp(-e.deltaY * 0.002), focus);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const deleteSelected = () => deleteLayers(selectedIds);
  const duplicate = () => duplicateSelection(selectedIds);

  // Keyboard: arrows nudge (Shift ×10); Shift+1 fit, Shift+2 selection, Shift+0 100%;
  // Space-drag pans; hold ⌘/Ctrl while dragging to suspend snapping; ⌫ deletes; ⌘D duplicates.
  useEffect(() => {
    const inList = (t: EventTarget | null) =>
      !!(t as Element | null)?.closest?.(
        '[role=grid],[role=treegrid],[role=listbox],[role=tablist],[role=menu],[role=slider]',
      );
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setNoSnap(true);
      if (isTyping(e.target) || overlayOpen() || inList(e.target)) return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpace(true);
        return;
      }
      // Shift+digit types a character, so it obeys the single-key setting (WCAG 2.1.4).
      const keys = readPrefs().singleKeys;
      if (keys && e.shiftKey && e.code === 'Digit1') return (e.preventDefault(), zoomTo(1));
      if (keys && e.shiftKey && e.code === 'Digit0')
        return (e.preventDefault(), fit && zoomTo(1 / fit));
      if (keys && e.shiftKey && e.code === 'Digit2') return (e.preventDefault(), zoomToSelection());
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd')
        return (e.preventDefault(), duplicate());
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g')
        return (e.preventDefault(), (e.shiftKey ? ungroupSelection : frameSelection)(movable));
      if (!selectedIds.length) return;
      if (e.key === 'Delete' || e.key === 'Backspace')
        return (e.preventDefault(), deleteSelected());
      const step = e.shiftKey ? 10 : 1;
      const d = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }[e.key];
      if (!d || e.altKey) return;
      e.preventDefault();
      update((s) => nudgeLayers(s, movable, d[0]!, d[1]!), {
        coalesce: `nudge:${movable.join(',')}`,
      });
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setNoSnap(false);
      if (e.code === 'Space') setSpace(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const pan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!space && e.button !== 1) return;
    e.preventDefault();
    const el = viewport.current!;
    const start = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
    const move = (ev: PointerEvent) => {
      el.scrollLeft = start.l - (ev.clientX - start.x);
      el.scrollTop = start.t - (ev.clientY - start.y);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  if (!output)
    return (
      <Panel className="h-full">
        <Empty>Add an output in “Outputs & audio” to start laying out the stage.</Empty>
      </Panel>
    );

  const commitOne = (id: string, patch: Partial<Layer>) =>
    update((d) => {
      const l = d.layers.find((x) => x.id === id);
      if (l) Object.assign(l, patch);
    });

  const setGuidesOf = (fn: (g: { x: number[]; y: number[] }) => void) =>
    update((d) => {
      const o = d.outputs.find((x) => x.id === output.id);
      if (!o) return;
      o.guides ??= { x: [], y: [] };
      fn(o.guides);
    });

  // Snap to everything but what is moving, frames around it included.
  const moving = new Set(
    movable.flatMap((id) => [id, ...descendantsOf(tree, id).map((l) => l.id)]),
  );
  const others = show.layers
    .filter((l) => l.outputId === output.id && l.kind !== 'audio' && !moving.has(l.id))
    .map((l) => nodeOf(l.id))
    .filter((e): e is HTMLElement => !!e);

  /** Line the selection up by what is drawn: one layer within its frame or the output. */
  const lineUp = (how: Align | 'x' | 'y') => {
    const ids = movable.filter((id) => handlesFor(tree.byId.get(id)!, tree.parent(id)).drag);
    const boxes = new Map<string, Box>();
    for (const id of ids) {
      const b = measureLayer(id);
      if (b) boxes.set(id, b);
    }
    const frame = ids.length === 1 ? tree.parent(ids[0]!) : undefined;
    const within = (frame && measureLayer(frame.id)) || {
      x: 0,
      y: 0,
      w: output.width,
      h: output.height,
    };
    const next =
      how === 'x' || how === 'y' ? distributeBoxes(boxes, how) : alignBoxes(boxes, within, how);
    update((d) => next.forEach((b, id) => placeDrawn(d, id, b)));
  };
  const gx = output.guides?.x ?? [];
  const gy = output.guides?.y ?? [];
  const atIndex = order.findIndex((c) => c.id === at);

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel">
      <header className="flex h-panel-head shrink-0 items-center gap-2 border-b border-line-subtle px-2">
        {show.outputs.length > 1 && (
          <Select
            aria-label="Output"
            value={output.id}
            onChange={(e) => select({ outputId: e.target.value, layerId: null })}
            className="w-36"
          >
            {show.outputs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        )}
        <div className="flex items-center gap-0.5">
          <IconButton
            label="Previous cue"
            icon={<ChevronLeft size={14} />}
            disabled={atIndex <= 0 && at !== '__top' ? false : atIndex <= 0}
            onClick={() => setPinned(atIndex <= 0 ? '__top' : order[atIndex - 1]!.id)}
          />
          <Select
            aria-label="Show the stage at"
            value={at}
            onChange={(e) => setPinned(e.target.value)}
            className="w-56"
          >
            <option value="__top">Top of show</option>
            {order.map((c, i) => (
              <option key={c.id} value={c.id}>
                After cue {i + 1}: {c.name}
              </option>
            ))}
          </Select>
          <IconButton
            label="Next cue"
            icon={<ChevronRight size={14} />}
            disabled={atIndex >= order.length - 1}
            onClick={() => setPinned(order[Math.min(order.length - 1, atIndex + 1)]!.id)}
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Toggle
            checked={everyLayer}
            onChange={setEveryLayer}
            label={<span className="text-caption">Every layer</span>}
          />
          <Toggle
            checked={ghost}
            onChange={setGhost}
            label={<span className="text-caption">Hidden faintly</span>}
          />
          <Toggle
            checked={guides}
            onChange={setGuides}
            label={<span className="text-caption">Guides</span>}
          />
          <div className="flex items-center rounded-control border border-line-control">
            <IconButton
              label="Zoom out"
              icon={<Minus size={13} />}
              onClick={() => zoomTo(zoom / 1.25)}
            />
            <MenuButton
              label="Zoom"
              className="min-w-14 font-mono tabular-nums"
              items={[
                { id: 'fit', label: 'Zoom to fit', shortcut: '⇧1', onAction: () => zoomTo(1) },
                {
                  id: 'sel',
                  label: 'Zoom to selection',
                  shortcut: '⇧2',
                  disabled: !sel,
                  onAction: zoomToSelection,
                },
                {
                  id: '100',
                  label: 'Actual size (100%)',
                  shortcut: '⇧0',
                  onAction: () => fit && zoomTo(1 / fit),
                },
              ]}
            >
              {Math.round(scale * 100)}%
            </MenuButton>
            <IconButton
              label="Zoom in"
              icon={<Plus size={13} />}
              onClick={() => zoomTo(zoom * 1.25)}
            />
          </div>
        </div>
      </header>

      <div
        ref={viewport}
        className={cn('relative min-h-0 flex-1 overflow-auto bg-canvas', space && 'cursor-grab')}
        onPointerDownCapture={pan}
        onDragOver={(e) =>
          e.dataTransfer.types.includes('application/x-scrim-media') && e.preventDefault()
        }
        onDrop={(e) => {
          const id = e.dataTransfer.getData('application/x-scrim-media');
          const media = show.media.find((m) => m.id === id);
          if (!media) return;
          e.preventDefault();
          // Onto a layer of the same kind: replace its media, keeping position and crop.
          const hit = (e.target as Element).closest('[data-layer]')?.getAttribute('data-layer');
          const target = show.layers.find((l) => l.id === hit);
          if (target && 'mediaId' in target && target.kind === media.kind) {
            commitOne(target.id, { mediaId: media.id } as Partial<Layer>);
            toast(`Replaced the media of ${target.name}`, 'info', {
              label: 'Undo',
              run: () => useEditor.getState().undo(),
            });
            return;
          }
          // Elsewhere: a new layer, centred where it was dropped.
          const layer = layerForMedia(show, output, media);
          const r = box.current?.getBoundingClientRect();
          if (r && scale && 'x' in layer) {
            layer.x = Math.round((e.clientX - r.left) / scale - layer.w / 2);
            layer.y = Math.round((e.clientY - r.top) / scale - layer.h / 2);
          }
          update((d) => void d.layers.push(layer));
          select({ layerId: layer.id });
        }}
      >
        <div className="relative" style={{ width: contentW, height: contentH }}>
          {/* Rulers: click to add a guide; double-click a guide to remove it. */}
          {guides && scale > 0 && (
            <>
              <Ruler
                axis="x"
                output={output}
                scale={scale}
                left={boxLeft}
                top={boxTop - RULER}
                onAdd={(v) => setGuidesOf((g) => void g.x.push(v))}
              />
              <Ruler
                axis="y"
                output={output}
                scale={scale}
                left={boxLeft - RULER}
                top={boxTop}
                onAdd={(v) => setGuidesOf((g) => void g.y.push(v))}
              />
            </>
          )}
          <div
            ref={box}
            {...{ [CANVAS_ATTR]: '' }}
            className="absolute"
            style={{ left: boxLeft, top: boxTop, width: boxW, height: boxH }}
          >
            <Stage
              show={show}
              state={state}
              outputId={output.id}
              variant="editor"
              ghostHidden={ghost}
              onBackgroundPointerDown={() => !space && select({ layerId: null })}
              onLayerPointerDown={(hit, e) => {
                if (space) return;
                e.stopPropagation();
                // The outermost frame first, like Figma; double-click goes inside.
                const id = pickLayer(tree, hit, selectedIds);
                if (e.shiftKey && layerId) {
                  // Shift-click adds or removes a layer from the selection.
                  const all = [layerId, ...extra];
                  const next = all.includes(id) ? all.filter((x) => x !== id) : [...all, id];
                  select({ layerId: next[0] ?? null, extra: next.slice(1) });
                } else if (!selectedIds.includes(id)) select({ layerId: id });
              }}
              overlay={() => (
                <>
                  {movable.map((id) => {
                    const b = drawn.get(id);
                    return (
                      b && (
                        <div
                          key={id}
                          data-proxy={id}
                          ref={(el) => {
                            if (el) proxies.current.set(id, el);
                            else proxies.current.delete(id);
                          }}
                          className="pointer-events-none absolute"
                          style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
                        />
                      )
                    );
                  })}
                  {guides && (
                    <>
                      <div
                        className="pointer-events-none absolute border border-dashed border-info/50"
                        style={{
                          left: output.width * output.safeArea,
                          top: output.height * output.safeArea,
                          right: output.width * output.safeArea,
                          bottom: output.height * output.safeArea,
                        }}
                      />
                      {gx.map((x, i) => (
                        <Guide
                          key={`x${i}`}
                          style={{ left: x, top: 0, bottom: 0, width: 1 }}
                          scale={scale}
                          onRemove={() => setGuidesOf((g) => void g.x.splice(i, 1))}
                        />
                      ))}
                      {gy.map((y, i) => (
                        <Guide
                          key={`y${i}`}
                          style={{ top: y, left: 0, right: 0, height: 1 }}
                          scale={scale}
                          onRemove={() => setGuidesOf((g) => void g.y.splice(i, 1))}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            />
          </div>

          {targets.length > 0 && !space && (
            <Moveable
              target={targets.length === 1 ? targets[0] : targets}
              dragArea
              draggable={canDrag}
              resizable={targets.length === 1 && !!handles?.dirs.length}
              renderDirections={handles?.dirs ?? []}
              snappable={!noSnap}
              snapThreshold={8}
              snapGap
              isDisplaySnapDigit
              snapDirections={{
                left: true,
                top: true,
                right: true,
                bottom: true,
                center: true,
                middle: true,
              }}
              elementSnapDirections={{
                left: true,
                top: true,
                right: true,
                bottom: true,
                center: true,
                middle: true,
              }}
              elementGuidelines={others}
              verticalGuidelines={[0, output.width / 2, output.width, ...gx]}
              horizontalGuidelines={[0, output.height / 2, output.height, ...gy]}
              keepRatio={
                primary && (primary.kind === 'image' || primary.kind === 'video')
                  ? undefined
                  : false
              }
              origin={false}
              onClick={(e) => {
                // Double-click goes one frame deeper, to what is under the pointer.
                if (!e.isDouble) return;
                const { clientX, clientY } = e.inputEvent as MouseEvent;
                const hit = document
                  .elementsFromPoint(clientX, clientY)
                  .map((el) => el.closest('[data-layer]'))
                  .find((el) => el && box.current?.contains(el))
                  ?.getAttribute('data-layer');
                if (hit) select({ layerId: pickLayer(tree, hit, selectedIds, true) });
              }}
              onDragStart={() => setDragging(true)}
              onDrag={(e) => {
                const b = start(e.target.getAttribute('data-proxy'));
                e.target.style.left = `${e.left}px`;
                e.target.style.top = `${e.top}px`;
                if (b) follow(e.target, e.left - b.x, e.top - b.y);
              }}
              onDragEnd={(e) => {
                setDragging(false);
                const id = e.target.getAttribute('data-proxy');
                const b = start(id);
                if (e.lastEvent && id && b)
                  update((d) =>
                    placeDrawn(d, id, { ...b, x: e.lastEvent.left, y: e.lastEvent.top }),
                  );
                settle();
              }}
              onDragGroupStart={() => setDragging(true)}
              onDragGroup={(e) =>
                e.events.forEach((ev) => {
                  const b = start(ev.target.getAttribute('data-proxy'));
                  ev.target.style.left = `${ev.left}px`;
                  ev.target.style.top = `${ev.top}px`;
                  if (b) follow(ev.target, ev.left - b.x, ev.top - b.y);
                })
              }
              onDragGroupEnd={(e) => {
                setDragging(false);
                update((d) => {
                  for (const ev of e.events) {
                    const id = ev.target.getAttribute('data-proxy');
                    const b = start(id);
                    if (id && b && ev.lastEvent)
                      placeDrawn(d, id, { ...b, x: ev.lastEvent.left, y: ev.lastEvent.top });
                  }
                });
                settle();
              }}
              onResizeStart={() => setDragging(true)}
              onResize={(e) => {
                const b = start(e.target.getAttribute('data-proxy'));
                if (!b) return;
                const [dx, dy] = e.drag.beforeTranslate as [number, number];
                Object.assign(e.target.style, {
                  width: `${e.width}px`,
                  height: `${e.height}px`,
                  left: `${b.x + dx}px`,
                  top: `${b.y + dy}px`,
                });
                const el = nodeOf(e.target.getAttribute('data-proxy'));
                if (el) Object.assign(el.style, { width: `${e.width}px`, height: `${e.height}px` });
                follow(e.target, dx, dy);
              }}
              onResizeEnd={(e) => {
                setDragging(false);
                const id = e.target.getAttribute('data-proxy');
                const b = start(id);
                const last = e.lastEvent;
                if (id && b && last) {
                  const [dx, dy] = last.drag.beforeTranslate as [number, number];
                  update((d) =>
                    placeDrawn(d, id, { x: b.x + dx, y: b.y + dy, w: last.width, h: last.height }),
                  );
                }
                settle();
              }}
            />
          )}

          {primary && sel && !dragging && !space && (
            <TaskBar
              ids={movable}
              layer={primary}
              style={{
                left: boxLeft + Math.max(0, sel.x * scale),
                top: Math.max(4, boxTop + sel.y * scale - 40),
              }}
              onLineUp={lineUp}
              onDuplicate={duplicate}
              onDelete={deleteSelected}
            />
          )}
        </div>
      </div>

      {show.outputs.length > 1 && (
        <div className="flex h-24 shrink-0 gap-2 overflow-x-auto border-t border-line-subtle p-2">
          {show.outputs.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => select({ outputId: o.id, layerId: null })}
              className={cn(
                'flex aspect-video h-full shrink-0 flex-col overflow-hidden rounded-control border',
                o.id === output.id
                  ? 'border-accent'
                  : 'border-line-subtle hover:border-line-control',
              )}
              data-info={`Edit ${o.name}`}
            >
              <div className="min-h-0 flex-1 bg-black">
                <Stage show={show} state={state} outputId={o.id} variant="thumb" />
              </div>
              <span className="truncate px-1 text-left text-caption text-fg-muted">{o.name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Ruler({
  axis,
  output,
  scale,
  left,
  top,
  onAdd,
}: {
  axis: 'x' | 'y';
  output: Output;
  scale: number;
  left: number;
  top: number;
  onAdd: (v: number) => void;
}) {
  const len = (axis === 'x' ? output.width : output.height) * scale;
  const step = 100 * scale;
  const labels = Array.from(
    { length: Math.floor((axis === 'x' ? output.width : output.height) / 100) + 1 },
    (_, i) => i * 100,
  );
  return (
    <div
      className="absolute cursor-copy overflow-hidden bg-panel"
      data-info={`Click to add a ${axis === 'x' ? 'vertical' : 'horizontal'} guide`}
      style={{
        left,
        top,
        width: axis === 'x' ? len : RULER,
        height: axis === 'x' ? RULER : len,
        backgroundImage: `linear-gradient(${axis === 'x' ? 'to right' : 'to bottom'}, var(--line-strong) 1px, transparent 1px)`,
        backgroundSize: axis === 'x' ? `${step}px 100%` : `100% ${step}px`,
      }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = axis === 'x' ? e.clientX - r.left : e.clientY - r.top;
        onAdd(Math.round(px / scale));
      }}
    >
      {step >= 48 &&
        labels.map((v) => (
          <span
            key={v}
            className="label-caps pointer-events-none absolute leading-none text-fg-subtle"
            style={axis === 'x' ? { left: v * scale + 2, top: 2 } : { top: v * scale + 2, left: 1 }}
          >
            {v}
          </span>
        ))}
    </div>
  );
}

function Guide({
  style,
  scale,
  onRemove,
}: {
  style: React.CSSProperties;
  scale: number;
  onRemove: () => void;
}) {
  // A wider invisible hit area around the 1 px line, independent of zoom.
  const pad = 4 / (scale || 1);
  const vertical = style.width === 1;
  return (
    <div
      className="absolute bg-accent/70"
      style={{
        ...style,
        ...(vertical ? { width: 1 / (scale || 1) } : { height: 1 / (scale || 1) }),
      }}
    >
      <div
        className="absolute cursor-pointer"
        data-info="Double-click to remove this guide"
        style={
          vertical
            ? { left: -pad, right: -pad, top: 0, bottom: 0 }
            : { top: -pad, bottom: -pad, left: 0, right: 0 }
        }
        onDoubleClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      />
    </div>
  );
}

/** The contextual task bar above the selection: the next likely actions, in words. */
function TaskBar({
  ids,
  layer,
  style,
  onLineUp,
  onDuplicate,
  onDelete,
}: {
  ids: string[];
  layer: Layer;
  style: React.CSSProperties;
  onLineUp: (how: Align | 'x' | 'y') => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const media = 'mediaId' in layer ? show.media.filter((m) => m.kind === layer.kind) : [];
  const align = onLineUp;
  return (
    <div
      role="toolbar"
      aria-label="Layer actions"
      className="absolute z-10 flex items-center gap-0.5 rounded-overlay border border-line-strong bg-raised p-0.5 shadow-overlay"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {ids.length === 1 && 'mediaId' in layer && media.length > 1 && (
        <MenuButton
          label="Replace media"
          icon={<Replace size={13} />}
          items={media.map((m) => ({
            id: m.id,
            label: m.name,
            disabled: m.id === layer.mediaId,
            onAction: () =>
              update((d) => {
                const l = d.layers.find((x) => x.id === layer.id);
                if (l && 'mediaId' in l) l.mediaId = m.id;
              }),
          }))}
        >
          Replace
        </MenuButton>
      )}
      {ids.length === 1 && 'fit' in layer && (
        <Button
          size="sm"
          variant="ghost"
          icon={<Maximize2 size={13} />}
          title={
            layer.fit === 'cover' ? 'Fit the whole picture (contain)' : 'Fill the frame (cover)'
          }
          onClick={() =>
            update((d) => {
              const l = d.layers.find((x) => x.id === layer.id);
              if (l && 'fit' in l) l.fit = l.fit === 'cover' ? 'contain' : 'cover';
            })
          }
        >
          {layer.fit === 'cover' ? 'Fill' : 'Fit'}
        </Button>
      )}
      {ids.length === 1 && (
        <Button
          size="sm"
          variant="ghost"
          icon={<Zap size={13} />}
          title="Add a cue that brings this layer in"
          onClick={() => {
            const after = useEditor.getState().selection.cueId;
            const cue = cueBringingIn(show, layer, after);
            if (!cue) return;
            update((d) => insertCueAfter(d, cue, after ?? d.cues.at(-1)?.id ?? null));
            select({ cueId: cue.id });
            toast(`Added cue “${cue.name}”`, 'good');
          }}
        >
          Cue it in
        </Button>
      )}
      <MenuButton
        label="Align"
        icon={<AlignCenterHorizontal size={13} />}
        items={[
          {
            id: 'left',
            label: 'Align left',
            icon: <AlignStartVertical size={13} />,
            onAction: () => align('left'),
          },
          {
            id: 'center',
            label: 'Align centre',
            icon: <AlignCenterVertical size={13} />,
            onAction: () => align('center'),
          },
          {
            id: 'right',
            label: 'Align right',
            icon: <AlignEndVertical size={13} />,
            onAction: () => align('right'),
          },
          'separator',
          {
            id: 'top',
            label: 'Align top',
            icon: <AlignStartHorizontal size={13} />,
            onAction: () => align('top'),
          },
          {
            id: 'middle',
            label: 'Align middle',
            icon: <AlignCenterHorizontal size={13} />,
            onAction: () => align('middle'),
          },
          {
            id: 'bottom',
            label: 'Align bottom',
            icon: <AlignEndHorizontal size={13} />,
            onAction: () => align('bottom'),
          },
          'separator',
          {
            id: 'dx',
            label: 'Distribute horizontally',
            icon: <StretchHorizontal size={13} />,
            disabled: ids.length < 3,
            onAction: () => onLineUp('x'),
          },
          {
            id: 'dy',
            label: 'Distribute vertically',
            icon: <StretchVertical size={13} />,
            disabled: ids.length < 3,
            onAction: () => onLineUp('y'),
          },
        ]}
      >
        Align
      </MenuButton>
      <IconButton label="Duplicate" shortcut="⌘D" icon={<Copy size={13} />} onClick={onDuplicate} />
      <IconButton
        label="Delete"
        shortcut="⌫"
        icon={<Trash2 size={13} />}
        className="text-fault"
        onClick={onDelete}
      />
    </div>
  );
}
