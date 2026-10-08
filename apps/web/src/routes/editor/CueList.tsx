import { createCue, cueOrder, uid, type Cue, type Show } from '@scrim/format';
import {
  ArrowDown,
  ArrowUp,
  FolderPlus,
  GripVertical,
  Palette,
  Plus,
  Timer,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Button as AriaButton,
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
} from 'react-aria-components';
import { cn } from '../../lib/cn.js';
import { summarizeCue } from '../../lib/cueSummary.js';
import { readLocal, writeLocal } from '../../lib/local.js';
import { cueExits, sceneGraph } from '../../lib/logic.js';
import { removeScene } from '../../lib/refs.js';
import { TAPES, tapeOf } from '../../lib/tape.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { confirmDialog, promptDialog } from '../../ui/dialog.js';
import { CommitInput } from '../../ui/Field.js';
import { MenuButton } from '../../ui/Menu.js';
import { Panel } from '../../ui/Panel.js';
import { Tabs } from '../../ui/Tabs.js';
import { toast } from '../../ui/toast.js';
import { SceneMap } from './SceneMap.js';

const CUE_TYPE = 'application/x-scrim-cue';

/** Move a cue before or after another cue (possibly in another scene), or to the end of a scene. */
function moveCueTo(
  d: Show,
  cueId: string,
  sceneId: string,
  target: { key: string; position: 'before' | 'after' } | null,
): void {
  const cue = d.cues.find((c) => c.id === cueId);
  if (!cue || target?.key === cueId) return;
  d.cues = d.cues.filter((c) => c.id !== cueId);
  cue.sceneId = sceneId;
  let at: number;
  if (target) {
    const i = d.cues.findIndex((c) => c.id === target.key);
    at = i === -1 ? d.cues.length : target.position === 'after' ? i + 1 : i;
  } else {
    const last = d.cues.findLastIndex((c) => c.sceneId === sceneId);
    at = last === -1 ? d.cues.length : last + 1;
  }
  d.cues.splice(at, 0, cue);
}

/**
 * The editor's cue list: scenes of cues. Drag a cue by its grip (also between scenes), or move
 * it with Alt+↑/↓ or its menu; each row says what the cue does.
 */
export function CueList() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const cueId = useEditor((s) => s.selection.cueId);
  const numbers = useMemo(() => new Map(cueOrder(show).map((c, i) => [c.id, i + 1])), [show]);
  const reachable = useMemo(() => sceneGraph(show).reachable, [show]);
  const [announce, setAnnounce] = useState('');
  const [view, setViewState] = useState<'list' | 'map'>(() => readLocal('scrim.cues.view', 'list'));
  const setView = (v: 'list' | 'map') => {
    setViewState(v);
    writeLocal('scrim.cues.view', v);
  };

  const addScene = async () => {
    const name = await promptDialog('New scene', `Scene ${show.scenes.length + 1}`, 'Scene name');
    if (!name) return;
    const scene = { id: uid('scn'), name };
    const cue = createCue(scene.id, 'New cue');
    update((d) => {
      d.scenes.push(scene);
      d.cues.push(cue);
    });
    select({ cueId: cue.id });
  };

  const addCue = (sceneId: string) => {
    const cue = createCue(sceneId, 'New cue');
    update((d) => {
      d.cues.push(cue);
      moveCueTo(d, cue.id, sceneId, null);
    });
    select({ cueId: cue.id });
  };

  /** Alt+↑/↓ and the Move menu: one step, crossing into the next scene at an edge. */
  const step = (cue: Cue, dir: -1 | 1) => {
    update((d) => {
      const inScene = d.cues.filter((c) => c.sceneId === cue.sceneId);
      const i = inScene.findIndex((c) => c.id === cue.id);
      const other = inScene[i + dir];
      if (other) {
        moveCueTo(d, cue.id, cue.sceneId, {
          key: other.id,
          position: dir > 0 ? 'after' : 'before',
        });
        return;
      }
      const si = d.scenes.findIndex((s) => s.id === cue.sceneId);
      const target = d.scenes[si + dir];
      if (!target) return;
      const targetCues = d.cues.filter((x) => x.sceneId === target.id);
      const anchor = dir > 0 ? targetCues[0] : targetCues.at(-1);
      moveCueTo(
        d,
        cue.id,
        target.id,
        anchor ? { key: anchor.id, position: dir > 0 ? 'before' : 'after' } : null,
      );
    });
    setAnnounce(`Moved ${cue.name} ${dir < 0 ? 'up' : 'down'}`);
  };

  const moveScene = (sceneId: string, dir: -1 | 1) =>
    update((d) => {
      const i = d.scenes.findIndex((s) => s.id === sceneId);
      const j = i + dir;
      if (j < 0 || j >= d.scenes.length) return;
      [d.scenes[i], d.scenes[j]] = [d.scenes[j]!, d.scenes[i]!];
    });

  return (
    <Panel
      title="Cues"
      className="h-full"
      bodyClassName={view === 'list' ? 'p-1' : ''}
      actions={
        <>
          <Tabs
            label="Cue list view"
            value={view}
            onChange={setView}
            tabs={[
              { id: 'list', label: 'List' },
              { id: 'map', label: 'Map' },
            ]}
          />
          <Button size="sm" icon={<FolderPlus size={13} />} onClick={addScene}>
            Scene
          </Button>
        </>
      }
    >
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
      {view === 'map' && <SceneMap show={show} />}
      {view === 'list' &&
        show.scenes.map((scene) => {
          const cues = show.cues.filter((c) => c.sceneId === scene.id);
          const tape = tapeOf(undefined, scene);
          const lost = cues.length > 0 && !reachable.has(scene.id);
          return (
            <div key={scene.id} className="mb-2">
              <div className="group flex items-center gap-1 px-1 py-1">
                <span
                  aria-hidden
                  className={cn('h-4 w-1 shrink-0', tape ? tape.bg : 'bg-line-subtle')}
                />
                <CommitInput
                  aria-label="Scene name"
                  value={scene.name}
                  onCommit={(name) =>
                    update((d) => {
                      const s = d.scenes.find((x) => x.id === scene.id);
                      if (s && name.trim()) s.name = name.trim();
                    })
                  }
                  className={cn(
                    'label-caps h-7 border-transparent bg-transparent hover:border-line-subtle',
                    lost ? 'text-fg-subtle' : 'text-fg-muted',
                  )}
                />
                {lost && (
                  <TriangleAlert
                    size={13}
                    className="shrink-0 text-warn"
                    aria-label="Unreachable: no cue or rule leads here"
                    data-info="Unreachable: no cue or rule leads here"
                  />
                )}
                <div className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                  <MenuButton
                    label="Scene tape colour"
                    icon={<Palette size={13} />}
                    items={[
                      ...TAPES.map((t) => ({
                        id: String(t.n),
                        label: t.name,
                        icon: <span className={cn('block size-3', t.bg)} />,
                        onAction: () =>
                          update((d) => {
                            const s = d.scenes.find((x) => x.id === scene.id);
                            if (s) s.tape = t.n;
                          }),
                      })),
                      'separator' as const,
                      {
                        id: 'none',
                        label: 'No colour',
                        onAction: () =>
                          update((d) => {
                            const s = d.scenes.find((x) => x.id === scene.id);
                            if (s) delete s.tape;
                          }),
                      },
                    ]}
                  />
                  <IconButton
                    label="Move scene up"
                    icon={<ArrowUp size={12} />}
                    onClick={() => moveScene(scene.id, -1)}
                  />
                  <IconButton
                    label="Move scene down"
                    icon={<ArrowDown size={12} />}
                    onClick={() => moveScene(scene.id, 1)}
                  />
                  <IconButton
                    label="Delete scene"
                    icon={<Trash2 size={12} />}
                    onClick={async () => {
                      if (
                        await confirmDialog(
                          `Delete scene “${scene.name}”?`,
                          <>
                            Its {cues.length} cue{cues.length === 1 ? '' : 's'} will be removed too.
                          </>,
                          'Delete scene',
                          true,
                        )
                      ) {
                        const before = structuredClone(show);
                        update((d) => removeScene(d, scene.id));
                        toast(`Deleted “${scene.name}”`, 'info', {
                          label: 'Undo',
                          run: () => update((d) => void Object.assign(d, before)),
                        });
                      }
                    }}
                  />
                </div>
                <IconButton
                  label="Add cue to scene"
                  icon={<Plus size={13} />}
                  onClick={() => addCue(scene.id)}
                />
              </div>
              <SceneCues
                sceneId={scene.id}
                cues={cues}
                selected={cueId ?? null}
                numbers={numbers}
                onSelect={(id) => select({ cueId: id })}
                onMove={(id, target) => update((d) => moveCueTo(d, id, scene.id, target))}
                onStep={step}
              />
            </div>
          );
        })}
    </Panel>
  );
}

function SceneCues({
  sceneId,
  cues,
  selected,
  numbers,
  onSelect,
  onMove,
  onStep,
}: {
  sceneId: string;
  cues: Cue[];
  selected: string | null;
  numbers: Map<string, number>;
  onSelect: (id: string) => void;
  onMove: (id: string, target: { key: string; position: 'before' | 'after' } | null) => void;
  onStep: (cue: Cue, dir: -1 | 1) => void;
}) {
  const show = useShow();
  const scene = show.scenes.find((s) => s.id === sceneId);
  const exits = (cue: Cue) => cueExits(show, cue).join(' | ');
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((k) => ({
        [CUE_TYPE]: String(k),
        'text/plain': cues.find((c) => c.id === k)?.name ?? '',
      })),
    acceptedDragTypes: [CUE_TYPE],
    getDropOperation: () => 'move',
    onReorder: (e) => {
      for (const k of e.keys)
        onMove(String(k), {
          key: String(e.target.key),
          position: e.target.dropPosition === 'after' ? 'after' : 'before',
        });
    },
    onInsert: async (e) => {
      for (const item of e.items)
        if (item.kind === 'text')
          onMove(await item.getText(CUE_TYPE), {
            key: String(e.target.key),
            position: e.target.dropPosition === 'after' ? 'after' : 'before',
          });
    },
    onRootDrop: async (e) => {
      for (const item of e.items)
        if (item.kind === 'text') onMove(await item.getText(CUE_TYPE), null);
    },
    renderDropIndicator: (target) => (
      <DropIndicator target={target} className="h-0.5 bg-accent data-[drop-target]:bg-accent" />
    ),
  });

  return (
    <div
      onKeyDownCapture={(e) => {
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        const cue = cues.find((c) => c.id === selected);
        if (!cue) return;
        e.preventDefault();
        e.stopPropagation();
        onStep(cue, e.key === 'ArrowUp' ? -1 : 1);
      }}
    >
      <GridList
        aria-label={`Cues in ${scene?.name ?? 'scene'}`}
        items={cues}
        dependencies={[show, numbers]}
        selectionMode="single"
        disallowEmptySelection={false}
        selectedKeys={selected ? [selected] : []}
        onSelectionChange={(keys) => {
          const k = [...keys][0];
          if (k !== undefined) onSelect(String(k));
        }}
        dragAndDropHooks={dragAndDropHooks}
        renderEmptyState={() => (
          <div className="px-3 py-2 text-caption text-fg-subtle">Drop a cue here</div>
        )}
        className="outline-none"
      >
        {(cue) => {
          const tape = tapeOf(cue, scene);
          return (
            <GridListItem
              id={cue.id}
              textValue={cue.name}
              className={({ isSelected, isFocusVisible, isDragging }) =>
                cn(
                  'group flex cursor-default items-center gap-2 border-l-4 py-1.5 pr-1 pl-2 outline-none',
                  tape ? tape.border : 'border-transparent',
                  isSelected ? 'bg-control-active' : 'hover:bg-control-hover',
                  isFocusVisible && 'outline-2 -outline-offset-2 outline-focus',
                  isDragging && 'opacity-50',
                )
              }
            >
              <AriaButton
                slot="drag"
                aria-label={`Drag ${cue.name}`}
                className="cursor-grab text-fg-icon opacity-40 outline-none group-hover:opacity-100"
              >
                <GripVertical size={14} />
              </AriaButton>
              <span className="w-6 text-right font-mono text-caption text-fg-subtle tabular-nums">
                {numbers.get(cue.id)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-ui">{cue.name}</div>
                <div className="truncate text-caption text-fg-subtle">
                  {summarizeCue(show, cue)}
                  {exits(cue) && <span className="text-fg-muted"> → {exits(cue)}</span>}
                </div>
              </div>
              {cue.follow.auto && (
                <span
                  className="flex items-center gap-0.5 font-mono text-caption text-fg-muted tabular-nums"
                  data-info="Auto-follows into the next cue"
                  aria-label={`Auto-follows after ${cue.follow.delay} seconds`}
                >
                  <Timer size={11} />
                  {cue.follow.delay}s
                </span>
              )}
              <div className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                <IconButton
                  label="Move up"
                  shortcut="⌥↑"
                  icon={<ArrowUp size={12} />}
                  onClick={() => onStep(cue, -1)}
                />
                <IconButton
                  label="Move down"
                  shortcut="⌥↓"
                  icon={<ArrowDown size={12} />}
                  onClick={() => onStep(cue, 1)}
                />
              </div>
            </GridListItem>
          );
        }}
      </GridList>
    </div>
  );
}
