import { cueOrder, type Layer } from '@scrim/format';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Hash,
  Music,
  Plus,
  Timer,
  Type,
  Variable,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Moveable from 'react-moveable';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { cn } from '../../lib/cn.js';
import { layerKindLabel, syntheticLayer, type SyntheticKind } from '../../lib/layers.js';
import { Stage } from '../../render/Stage.js';
import { useEditor, useShow } from '../../state/editor.js';
import { IconButton } from '../../ui/Button.js';
import { Select, Toggle } from '../../ui/Field.js';
import { Columns, Divider, FOCUS_CANVAS_EVENT, Pane } from '../../ui/Layout.js';
import { MenuButton } from '../../ui/Menu.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { LayerInspector } from './LayerInspector.js';
import { MediaPanel, useDropMedia } from './MediaPanel.js';
import { previewState } from './preview.js';

export function StageTab() {
  const left = useRef<PanelImperativeHandle | null>(null);
  const right = useRef<PanelImperativeHandle | null>(null);

  // Focus canvas (Shift+\ or View › Focus canvas) hides both sides; again brings them back.
  useEffect(() => {
    const toggle = () => {
      const hidden = left.current?.isCollapsed() && right.current?.isCollapsed();
      for (const p of [left.current, right.current]) {
        if (hidden) p?.expand();
        else p?.collapse();
      }
    };
    window.addEventListener(FOCUS_CANVAS_EVENT, toggle);
    return () => window.removeEventListener(FOCUS_CANVAS_EVENT, toggle);
  }, []);

  return (
    <Columns id="editor.stage" preview>
      <Pane id="assets" size={260} min={200} side collapsible paneRef={left}>
        <div className="flex h-full min-h-0 flex-col gap-px bg-line-subtle">
          <MediaPanel />
          <LayersPanel />
        </div>
      </Pane>
      <Divider />
      <Pane id="canvas" min={320}>
        <Canvas />
      </Pane>
      <Divider />
      <Pane id="inspector" size={288} min={240} max={420} side collapsible paneRef={right}>
        <Panel title="Layer" className="h-full">
          <LayerInspector />
        </Panel>
      </Pane>
    </Columns>
  );
}

const ADD: { kind: SyntheticKind; label: string; icon: typeof Type }[] = [
  { kind: 'text', label: 'Text', icon: Type },
  { kind: 'countdown', label: 'Countdown', icon: Timer },
  { kind: 'counter', label: 'Counter', icon: Hash },
  { kind: 'state', label: 'State value', icon: Variable },
];

function LayersPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const { outputId, layerId } = useEditor((s) => s.selection);
  const output = show.outputs.find((o) => o.id === outputId) ?? show.outputs[0];
  const layers = show.layers.filter((l) => l.outputId === output?.id).sort((a, b) => b.z - a.z);
  const sounds = show.layers.filter((l) => l.kind === 'audio');

  const move = (layer: Layer, dir: 1 | -1) =>
    update((d) => {
      const sorted = d.layers
        .filter((l) => l.outputId === layer.outputId)
        .sort((a, b) => a.z - b.z);
      const i = sorted.findIndex((l) => l.id === layer.id);
      const other = sorted[i + dir];
      if (!other) return;
      const self = sorted[i]!;
      [self.z, other.z] = [other.z, self.z];
      if (self.z === other.z) self.z += dir;
    });

  const row = (l: Layer) => (
    <li
      key={l.id}
      onClick={() => select({ layerId: l.id })}
      className={cn(
        'group flex cursor-pointer items-center gap-1 rounded-control px-2 py-1',
        l.id === layerId ? 'bg-control-active' : 'hover:bg-control-hover',
      )}
    >
      <IconButton
        label={l.visible ? 'Visible at start' : 'Hidden at start'}
        icon={l.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-fg-subtle" />}
        onClick={(e) => {
          e.stopPropagation();
          update((d) => {
            const x = d.layers.find((y) => y.id === l.id);
            if (x) x.visible = !x.visible;
          });
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-ui">{l.name}</div>
        <div className="text-caption text-fg-subtle">{layerKindLabel(l)}</div>
      </div>
      {l.kind !== 'audio' && (
        <div className="flex opacity-0 group-hover:opacity-100">
          <IconButton
            label="Bring forward"
            icon={<ArrowUp size={12} />}
            onClick={(e) => (e.stopPropagation(), move(l, 1))}
          />
          <IconButton
            label="Send backward"
            icon={<ArrowDown size={12} />}
            onClick={(e) => (e.stopPropagation(), move(l, -1))}
          />
        </div>
      )}
    </li>
  );

  return (
    <Panel
      title={`Layers${output && show.outputs.length > 1 ? ` · ${output.name}` : ''}`}
      className="flex-1"
      bodyClassName="p-1"
      actions={
        output && (
          <MenuButton
            label="Add a layer"
            icon={<Plus size={14} />}
            items={ADD.map((a) => ({
              id: a.kind,
              label: a.label,
              icon: <a.icon size={14} />,
              onAction: () => {
                const layer = syntheticLayer(show, output, a.kind);
                update((d) => void d.layers.push(layer));
                select({ layerId: layer.id });
              },
            }))}
          >
            Add
          </MenuButton>
        )
      }
    >
      {layers.length === 0 && sounds.length === 0 ? (
        <Empty>
          Place media from the library, or add text, a countdown or a live state value with the
          buttons above.
        </Empty>
      ) : (
        <ul>{layers.map(row)}</ul>
      )}
      {sounds.length > 0 && (
        <>
          <div className="label-caps mt-2 flex items-center gap-1 px-2 text-fg-subtle">
            <Music size={12} /> Sound (plays from the show machine)
          </div>
          <ul>{sounds.map(row)}</ul>
        </>
      )}
      {layers.length > 0 && (
        <p className="mt-2 flex items-center gap-1 px-2 pb-1 text-caption text-fg-subtle">
          <Plus size={11} /> Top of the list is in front.
        </p>
      )}
    </Panel>
  );
}

function Canvas() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const { outputId, layerId } = useEditor((s) => s.selection);
  const output = show.outputs.find((o) => o.id === outputId) ?? show.outputs[0];
  const [previewCue, setPreviewCue] = useState<string>('__all');
  const [ghost, setGhost] = useState(true);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [guides, setGuides] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  const dropMedia = useDropMedia();
  const order = cueOrder(show);

  const state = useMemo(() => {
    if (previewCue === '__all') {
      const s = previewState(show, null);
      for (const l of show.layers) {
        const ls = s.layers[l.id];
        if (ls) ls.opacity = { ...ls.opacity, from: l.opacity, to: l.opacity };
      }
      return s;
    }
    return previewState(show, previewCue === '__top' ? null : previewCue);
  }, [show, previewCue]);

  const selected = show.layers.find((l) => l.id === layerId && l.outputId === output?.id);

  useEffect(() => {
    // The DOM node for the selected layer, for the transform handles.
    const id = requestAnimationFrame(() => {
      setTarget(
        selected
          ? (wrap.current?.querySelector<HTMLElement>(`[data-layer="${selected.id}"]`) ?? null)
          : null,
      );
    });
    return () => cancelAnimationFrame(id);
  }, [selected, output?.id, show.layers]);

  if (!output)
    return (
      <Panel>
        <Empty>Add an output in “Outputs & audio”.</Empty>
      </Panel>
    );

  const commit = (patch: Partial<Layer>) =>
    update((d) => {
      const l = d.layers.find((x) => x.id === selected?.id);
      if (l) Object.assign(l, patch);
    });

  const others = show.layers
    .filter((l) => l.outputId === output.id && l.id !== selected?.id)
    .map((l) => wrap.current?.querySelector<HTMLElement>(`[data-layer="${l.id}"]`))
    .filter((e): e is HTMLElement => !!e);

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel">
      <header className="flex h-panel-head shrink-0 items-center gap-2 border-b border-line-subtle px-3">
        {show.outputs.length > 1 && (
          <Select
            value={output.id}
            onChange={(e) => select({ outputId: e.target.value, layerId: null })}
            className="w-40"
          >
            {show.outputs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        )}
        <span className="text-caption text-fg-subtle">
          {output.name} · {output.width}×{output.height}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Toggle
            checked={guides}
            onChange={setGuides}
            label={<span className="text-caption">Guides</span>}
          />
          <Toggle
            checked={ghost}
            onChange={setGhost}
            label={<span className="text-caption">Show hidden faintly</span>}
          />
          <Select
            value={previewCue}
            onChange={(e) => setPreviewCue(e.target.value)}
            className="w-56"
            aria-label="Preview the stage at"
          >
            <option value="__all">Design view (every layer)</option>
            <option value="__top">Top of show</option>
            {order.map((c, i) => (
              <option key={c.id} value={c.id}>
                After cue {i + 1}: {c.name}
              </option>
            ))}
          </Select>
        </div>
      </header>
      <div
        ref={wrap}
        className="relative min-h-0 flex-1 bg-[radial-gradient(circle,#1f1f29_1px,transparent_1px)] [background-size:16px_16px] p-6"
        onDragOver={(e) =>
          e.dataTransfer.types.includes('application/x-scrim-media') && e.preventDefault()
        }
        onDrop={(e) => {
          const id = e.dataTransfer.getData('application/x-scrim-media');
          if (id) {
            e.preventDefault();
            dropMedia(id, output.id);
          }
        }}
      >
        <div className="relative size-full">
          <Stage
            show={show}
            state={state}
            outputId={output.id}
            variant="editor"
            ghostHidden={ghost}
            onBackgroundPointerDown={() => select({ layerId: null })}
            onLayerPointerDown={(id, e) => {
              e.stopPropagation();
              select({ layerId: id });
            }}
            overlay={() =>
              guides && (
                <div
                  className="pointer-events-none absolute border border-dashed border-info/50"
                  style={{
                    left: output.width * output.safeArea,
                    top: output.height * output.safeArea,
                    right: output.width * output.safeArea,
                    bottom: output.height * output.safeArea,
                  }}
                />
              )
            }
          />
        </div>
        {selected && target && (
          <Moveable
            target={target}
            dragArea
            draggable
            resizable
            snappable
            snapThreshold={8}
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
            verticalGuidelines={[0, output.width / 2, output.width]}
            horizontalGuidelines={[0, output.height / 2, output.height]}
            keepRatio={selected.kind === 'image' || selected.kind === 'video' ? undefined : false}
            origin={false}
            onDrag={(e) => {
              e.target.style.left = `${e.left}px`;
              e.target.style.top = `${e.top}px`;
            }}
            onDragEnd={(e) => {
              if (!e.lastEvent) return;
              commit({ x: Math.round(e.lastEvent.left), y: Math.round(e.lastEvent.top) });
            }}
            onResize={(e) => {
              e.target.style.width = `${e.width}px`;
              e.target.style.height = `${e.height}px`;
              e.target.style.left = `${selected.x + e.drag.beforeTranslate[0]!}px`;
              e.target.style.top = `${selected.y + e.drag.beforeTranslate[1]!}px`;
            }}
            onResizeEnd={(e) => {
              const last = e.lastEvent;
              if (!last) return;
              commit({
                w: Math.max(1, Math.round(last.width)),
                h: Math.max(1, Math.round(last.height)),
                x: Math.round(selected.x + last.drag.beforeTranslate[0]!),
                y: Math.round(selected.y + last.drag.beforeTranslate[1]!),
              });
            }}
          />
        )}
      </div>
    </section>
  );
}
