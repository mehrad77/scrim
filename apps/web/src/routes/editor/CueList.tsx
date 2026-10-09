import { createCue, cueOrder, uid, type Cue, type Scene, type Show } from '@scrim/format';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  FolderPlus,
  GripVertical,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Timer,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Button as AriaButton,
  Collection,
  DropIndicator,
  Tree,
  TreeItem,
  TreeItemContent,
  useDragAndDrop,
  type TreeItemRenderProps,
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
import { MenuButton } from '../../ui/Menu.js';
import { Panel } from '../../ui/Panel.js';
import { Tabs } from '../../ui/Tabs.js';
import { toast } from '../../ui/toast.js';
import { SceneMap } from './SceneMap.js';

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

/** Put a scene before or after another one. */
function moveSceneTo(d: Show, sceneId: string, targetId: string, position: 'before' | 'after') {
  const scene = d.scenes.find((s) => s.id === sceneId);
  if (!scene || sceneId === targetId) return;
  d.scenes = d.scenes.filter((s) => s.id !== sceneId);
  const i = d.scenes.findIndex((s) => s.id === targetId);
  d.scenes.splice(i === -1 ? d.scenes.length : position === 'after' ? i + 1 : i, 0, scene);
}

/**
 * The editor's cue list: a tree of scenes and their cues. Drag a cue by its grip (also into
 * another scene, or onto one), or a scene to reorder scenes; Alt+↑/↓ moves whichever is focused.
 * Each cue row says what the cue does. Scenes fold, and rename with F2 or a double-click.
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

  const moveScene = (sceneId: string, dir: -1 | 1) => {
    const scene = show.scenes.find((s) => s.id === sceneId);
    update((d) => {
      const i = d.scenes.findIndex((s) => s.id === sceneId);
      const j = i + dir;
      if (j < 0 || j >= d.scenes.length) return;
      [d.scenes[i], d.scenes[j]] = [d.scenes[j]!, d.scenes[i]!];
    });
    if (scene) setAnnounce(`Moved scene ${scene.name} ${dir < 0 ? 'up' : 'down'}`);
  };

  const renameScene = async (scene: Scene) => {
    const name = (await promptDialog('Rename scene', scene.name, 'Scene name'))?.trim();
    if (!name || name === scene.name) return;
    update((d) => {
      const s = d.scenes.find((x) => x.id === scene.id);
      if (s) s.name = name;
    });
  };

  const deleteScene = async (scene: Scene) => {
    const count = show.cues.filter((c) => c.sceneId === scene.id).length;
    if (
      !(await confirmDialog(
        `Delete scene “${scene.name}”?`,
        <>
          Its {count} cue{count === 1 ? '' : 's'} will be removed too.
        </>,
        'Delete scene',
        true,
      ))
    )
      return;
    const before = structuredClone(show);
    update((d) => removeScene(d, scene.id));
    toast(`Deleted “${scene.name}”`, 'info', {
      label: 'Undo',
      run: () => update((d) => void Object.assign(d, before)),
    });
  };

  const setTape = (sceneId: string, n: number | null) =>
    update((d) => {
      const s = d.scenes.find((x) => x.id === sceneId);
      if (!s) return;
      if (n === null) delete s.tape;
      else s.tape = n;
    });

  // Folded scenes share the editor's fold list with the layers tree's frames.
  const collapsed = useEditor((s) => s.collapsed);
  const setCollapsed = useEditor((s) => s.setCollapsed);
  const sceneIds = show.scenes.map((s) => s.id);
  // Picking a cue elsewhere (the canvas, the dock) opens its scene.
  const cueScene = show.cues.find((c) => c.id === cueId)?.sceneId;
  useEffect(() => {
    const { collapsed: now, setCollapsed: set } = useEditor.getState();
    if (cueScene && now.includes(cueScene)) set(now.filter((id) => id !== cueScene));
  }, [cueId, cueScene]);

  const isScene = (key: string) => show.scenes.some((s) => s.id === key);
  const dragged = useRef<string[]>([]);
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ 'text/plain': String(k) })),
    onDragStart: (e) => void (dragged.current = [...e.keys].map(String)),
    // Cues go next to cues or onto a scene; scenes go next to scenes.
    getDropOperation: (target) => {
      if (target.type !== 'item') return 'cancel';
      const scenes = dragged.current.every(isScene);
      const ontoScene = isScene(String(target.key));
      if (scenes) return ontoScene && target.dropPosition !== 'on' ? 'move' : 'cancel';
      return ontoScene === (target.dropPosition === 'on') ? 'move' : 'cancel';
    },
    shouldAcceptItemDrop: (target) => isScene(String(target.key)),
    onMove: (e) => {
      const target = String(e.target.key);
      const position = e.target.dropPosition;
      update((d) => {
        for (const k of [...e.keys].map(String)) {
          if (isScene(k)) {
            if (position !== 'on') moveSceneTo(d, k, target, position);
          } else if (position === 'on') moveCueTo(d, k, target, null);
          else {
            const sceneId = d.cues.find((c) => c.id === target)?.sceneId;
            if (sceneId) moveCueTo(d, k, sceneId, { key: target, position });
          }
        }
      });
    },
    renderDropIndicator: (target) => <DropIndicator target={target} className="h-0.5 bg-accent" />,
  });

  // Alt+↑/↓ moves the focused cue or scene; F2 renames a scene.
  const onKeys = (e: KeyboardEvent) => {
    const key = (document.activeElement?.closest('[role=row]') as HTMLElement | null)?.dataset.key;
    const scene = show.scenes.find((s) => s.id === key);
    if (scene && e.key === 'F2') {
      e.preventDefault();
      void renameScene(scene);
      return;
    }
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const dir = e.key === 'ArrowUp' ? -1 : 1;
    const cue = show.cues.find((c) => c.id === (key ?? cueId));
    if (!scene && !cue) return;
    e.preventDefault();
    e.stopPropagation();
    if (scene) moveScene(scene.id, dir);
    else if (cue) step(cue, dir);
  };

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
      {view === 'list' && (
        <div onKeyDownCapture={onKeys}>
          <Tree
            aria-label="Scenes and cues"
            items={show.scenes}
            dependencies={[show, numbers, reachable]}
            selectionMode="single"
            selectionBehavior="replace"
            selectedKeys={cueId ? [cueId] : []}
            onSelectionChange={(keys) => {
              const k = keys === 'all' ? undefined : [...keys][0];
              if (k !== undefined) select({ cueId: String(k) });
            }}
            // Scenes fold, move and rename, but the selection is always a cue.
            disabledKeys={sceneIds}
            disabledBehavior="selection"
            expandedKeys={sceneIds.filter((id) => !collapsed.includes(id))}
            onExpandedChange={(keys) =>
              setCollapsed([
                ...collapsed.filter((id) => !sceneIds.includes(id)),
                ...sceneIds.filter((id) => !keys.has(id)),
              ])
            }
            dragAndDropHooks={dragAndDropHooks}
            className="outline-none"
          >
            {(scene) => (
              <SceneRow
                scene={scene}
                cues={show.cues.filter((c) => c.sceneId === scene.id)}
                lost={show.cues.some((c) => c.sceneId === scene.id) && !reachable.has(scene.id)}
                numbers={numbers}
                onAdd={() => addCue(scene.id)}
                onRename={() => void renameScene(scene)}
                onDelete={() => void deleteScene(scene)}
                onTape={(n) => setTape(scene.id, n)}
                onMove={(dir) => moveScene(scene.id, dir)}
                onStep={step}
              />
            )}
          </Tree>
        </div>
      )}
    </Panel>
  );
}

const rowClass = ({ isSelected, isFocusVisible, isDragging }: TreeItemRenderProps) =>
  cn(
    'group flex cursor-default items-center outline-none',
    isSelected ? 'bg-control-active' : 'hover:bg-control-hover',
    isFocusVisible && 'outline-2 -outline-offset-2 outline-focus',
    isDragging && 'opacity-50',
  );

function SceneRow({
  scene,
  cues,
  lost,
  numbers,
  onAdd,
  onRename,
  onDelete,
  onTape,
  onMove,
  onStep,
}: {
  scene: Scene;
  cues: Cue[];
  lost: boolean;
  numbers: Map<string, number>;
  onAdd: () => void;
  onRename: () => void;
  onDelete: () => void;
  onTape: (n: number | null) => void;
  onMove: (dir: -1 | 1) => void;
  onStep: (cue: Cue, dir: -1 | 1) => void;
}) {
  const tape = tapeOf(undefined, scene);
  return (
    <TreeItem id={scene.id} textValue={scene.name} className={rowClass}>
      <TreeItemContent>
        {({ isExpanded }) => (
          <div className="flex min-w-0 flex-1 items-center gap-1 py-1 pr-1 pl-1">
            <AriaButton
              slot="drag"
              aria-label={`Drag scene ${scene.name}`}
              className="cursor-grab text-fg-icon opacity-40 outline-none group-hover:opacity-100"
            >
              <GripVertical size={14} />
            </AriaButton>
            <AriaButton
              slot="chevron"
              aria-label={`${isExpanded ? 'Fold' : 'Open'} ${scene.name}`}
              className="flex size-5 shrink-0 items-center justify-center text-fg-icon outline-none hover:text-fg"
            >
              <ChevronRight size={13} className={cn(isExpanded && 'rotate-90')} />
            </AriaButton>
            <span
              aria-hidden
              className={cn('h-4 w-1 shrink-0', tape ? tape.bg : 'bg-line-subtle')}
            />
            <span
              onDoubleClick={onRename}
              className={cn(
                'label-caps min-w-0 flex-1 truncate',
                lost ? 'text-fg-subtle' : 'text-fg-muted',
              )}
            >
              {scene.name}
              {!cues.length && <span className="ml-2 text-caption normal-case">No cues yet</span>}
            </span>
            {lost && (
              <TriangleAlert
                size={13}
                className="shrink-0 text-warn"
                aria-label="Unreachable: no cue or rule leads here"
                data-info="Unreachable: no cue or rule leads here"
              />
            )}
            {/* Out of the way until wanted, so the name has the room. */}
            <div className="hidden group-focus-within:flex group-hover:flex">
              <MenuButton
                label="Scene tape colour"
                icon={<Palette size={13} />}
                items={[
                  ...TAPES.map((t) => ({
                    id: String(t.n),
                    label: t.name,
                    icon: <span className={cn('block size-3', t.bg)} />,
                    onAction: () => onTape(t.n),
                  })),
                  'separator' as const,
                  { id: 'none', label: 'No colour', onAction: () => onTape(null) },
                ]}
              />
              <MenuButton
                label={`More for ${scene.name}`}
                icon={<MoreHorizontal size={13} />}
                items={[
                  {
                    id: 'rename',
                    label: 'Rename…',
                    icon: <Pencil size={13} />,
                    shortcut: 'F2',
                    onAction: onRename,
                  },
                  {
                    id: 'up',
                    label: 'Move scene up',
                    icon: <ArrowUp size={13} />,
                    shortcut: '⌥↑',
                    onAction: () => onMove(-1),
                  },
                  {
                    id: 'down',
                    label: 'Move scene down',
                    icon: <ArrowDown size={13} />,
                    shortcut: '⌥↓',
                    onAction: () => onMove(1),
                  },
                  'separator' as const,
                  {
                    id: 'delete',
                    label: 'Delete scene…',
                    icon: <Trash2 size={13} />,
                    onAction: onDelete,
                  },
                ]}
              />
            </div>
            <IconButton label="Add cue to scene" icon={<Plus size={13} />} onClick={onAdd} />
          </div>
        )}
      </TreeItemContent>
      <Collection items={cues}>
        {(cue) => <CueRow cue={cue} scene={scene} number={numbers.get(cue.id)} onStep={onStep} />}
      </Collection>
    </TreeItem>
  );
}

function CueRow({
  cue,
  scene,
  number,
  onStep,
}: {
  cue: Cue;
  scene: Scene;
  number: number | undefined;
  onStep: (cue: Cue, dir: -1 | 1) => void;
}) {
  const show = useShow();
  const tape = tapeOf(cue, scene);
  const exits = cueExits(show, cue).join(' | ');
  return (
    <TreeItem id={cue.id} textValue={cue.name} className={rowClass}>
      <TreeItemContent>
        <div
          className={cn(
            'ml-4 flex min-w-0 flex-1 items-center gap-2 border-l-4 py-1.5 pr-1 pl-1',
            tape ? tape.border : 'border-transparent',
          )}
        >
          <AriaButton
            slot="drag"
            aria-label={`Drag ${cue.name}`}
            className="cursor-grab text-fg-icon opacity-40 outline-none group-hover:opacity-100"
          >
            <GripVertical size={14} />
          </AriaButton>
          <span className="w-6 text-right font-mono text-caption text-fg-subtle tabular-nums">
            {number}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-ui">{cue.name}</div>
            <div className="truncate text-caption text-fg-subtle">
              {summarizeCue(show, cue)}
              {exits && <span className="text-fg-muted"> → {exits}</span>}
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
          <div className="hidden group-focus-within:flex group-hover:flex">
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
        </div>
      </TreeItemContent>
    </TreeItem>
  );
}
