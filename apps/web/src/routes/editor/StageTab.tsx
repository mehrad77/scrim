import type { Layer } from '@scrim/format';
import { Eye, EyeOff, Hash, Music, Plus, Timer, Type, Variable } from 'lucide-react';
import { useEffect, useRef } from 'react';
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
import { LayersTree } from './LayersTree.js';
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
  const layers = show.layers.filter((l) => l.outputId === output?.id);
  const sounds = show.layers.filter((l) => l.kind === 'audio');

  const sound = (l: Layer) => (
    <li
      key={l.id}
      onClick={() => select({ layerId: l.id })}
      className={cn(
        'group flex cursor-pointer items-center gap-1 rounded-control px-2 py-1',
        l.id === layerId ? 'bg-control-active' : 'hover:bg-control-hover',
      )}
    >
      <IconButton
        label={l.visible ? 'On at the start' : 'Hidden at the start'}
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
        output && <LayersTree outputId={output.id} />
      )}
      {sounds.length > 0 && (
        <>
          <div className="label-caps mt-2 flex items-center gap-1 px-2 text-fg-subtle">
            <Music size={12} /> Sound (plays from the show machine)
          </div>
          <ul>{sounds.map(sound)}</ul>
        </>
      )}
      {layers.length > 0 && (
        <p className="mt-2 px-2 pb-1 text-caption text-fg-subtle">
          The top of the list is in front. Rows and columns line up in list order.
        </p>
      )}
    </Panel>
  );
}
