import type { Layer } from '@scrim/format';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  Hash,
  Music,
  Plus,
  Timer,
  Type,
  Variable,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import {
  Button as AriaButton,
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
} from 'react-aria-components';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { cn } from '../../lib/cn.js';
import { layerKindLabel, syntheticLayer, type SyntheticKind } from '../../lib/layers.js';
import { useEditor, useShow } from '../../state/editor.js';
import { IconButton } from '../../ui/Button.js';
import { Columns, Divider, FOCUS_CANVAS_EVENT, Pane } from '../../ui/Layout.js';
import { MenuButton } from '../../ui/Menu.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { Canvas } from './Canvas.js';
import { CueDock } from './CueDock.js';
import { LayerInspector } from './LayerInspector.js';
import { MediaPanel } from './MediaPanel.js';

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
        <Columns id="editor.stage.dock" vertical>
          <Pane id="view" min={200}>
            <Canvas />
          </Pane>
          <Divider vertical />
          <Pane id="dock" size="28%" min={120} max="60%" collapsible>
            <CueDock />
          </Pane>
        </Columns>
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

  // Dragging a layer, or Alt+↑/↓, rewrites the stacking order (top of the list is in front).
  const reorder = (ids: string[], target: string, position: 'before' | 'after') =>
    update((d) => {
      const order = d.layers
        .filter((l) => l.outputId === output?.id)
        .sort((a, b) => b.z - a.z)
        .map((l) => l.id)
        .filter((id) => !ids.includes(id));
      const at = order.indexOf(target) + (position === 'after' ? 1 : 0);
      order.splice(at, 0, ...ids);
      order.forEach((id, i) => {
        const l = d.layers.find((x) => x.id === id);
        if (l) l.z = order.length - i;
      });
    });
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ 'text/plain': String(k) })),
    onReorder: (e) =>
      reorder(
        [...e.keys].map(String),
        String(e.target.key),
        e.target.dropPosition === 'after' ? 'after' : 'before',
      ),
    renderDropIndicator: (target) => <DropIndicator target={target} className="h-0.5 bg-accent" />,
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
        <Empty title="Nothing on stage yet">
          Drop images or video from the media library onto the canvas, or use Add for text, a
          countdown or a live value.
        </Empty>
      ) : (
        <div
          onKeyDownCapture={(e) => {
            const l = layers.find((x) => x.id === layerId);
            if (!l || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
            e.preventDefault();
            e.stopPropagation();
            move(l, e.key === 'ArrowUp' ? 1 : -1);
          }}
        >
          <GridList
            aria-label="Layers, front first"
            items={layers}
            dependencies={[layerId]}
            selectionMode="single"
            selectedKeys={layerId ? [layerId] : []}
            onSelectionChange={(keys) => {
              const k = [...keys][0];
              if (k !== undefined) select({ layerId: String(k) });
            }}
            dragAndDropHooks={dragAndDropHooks}
            className="outline-none"
          >
            {(l) => (
              <GridListItem
                id={l.id}
                textValue={l.name}
                className={({ isSelected, isFocusVisible }) =>
                  cn(
                    'group flex cursor-default items-center gap-1 px-1 py-1 outline-none',
                    isSelected ? 'bg-control-active' : 'hover:bg-control-hover',
                    isFocusVisible && 'outline-2 -outline-offset-2 outline-focus',
                  )
                }
              >
                <AriaButton
                  slot="drag"
                  aria-label={`Drag ${l.name}`}
                  className="cursor-grab text-fg-icon opacity-40 outline-none group-hover:opacity-100"
                >
                  <GripVertical size={14} />
                </AriaButton>
                <IconButton
                  label={l.visible ? 'Visible at start' : 'Hidden at start'}
                  icon={
                    l.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-fg-subtle" />
                  }
                  onClick={() =>
                    update((d) => {
                      const x = d.layers.find((y) => y.id === l.id);
                      if (x) x.visible = !x.visible;
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ui">{l.name}</div>
                  <div className="text-caption text-fg-subtle">{layerKindLabel(l)}</div>
                </div>
                <div className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton
                    label="Bring forward"
                    shortcut="⌥↑"
                    icon={<ArrowUp size={12} />}
                    onClick={() => move(l, 1)}
                  />
                  <IconButton
                    label="Send backward"
                    shortcut="⌥↓"
                    icon={<ArrowDown size={12} />}
                    onClick={() => move(l, -1)}
                  />
                </div>
              </GridListItem>
            )}
          </GridList>
        </div>
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
