import { ancestorsOf, isFrame, layerTree, type Layer } from '@scrim/format';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  LockOpen,
} from 'lucide-react';
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import {
  Button as AriaButton,
  Collection,
  DropIndicator,
  Tree,
  TreeItem,
  TreeItemContent,
  useDragAndDrop,
  type Selection as AriaSelection,
} from 'react-aria-components';
import { cn } from '../../lib/cn.js';
import { moveLayers, stepLayer } from '../../lib/frames.js';
import { layerKindLabel } from '../../lib/layers.js';
import { checkLogic } from '../../lib/logic.js';
import { useEditor, useShow } from '../../state/editor.js';
import { IconButton } from '../../ui/Button.js';
import {
  deleteLayers,
  duplicateSelection,
  focusLayerName,
  frameSelection,
  toggleLock,
  ungroupSelection,
} from './layerCommands.js';
import { measureLayer } from './measure.js';

/**
 * One output's layers as a tree, front first; frames fold open to show what is inside them.
 * Drag to restack or nest, or Alt+↑/↓ among siblings. Enter, double-click or F2 renames in the
 * inspector; Delete, ⌘D, ⌘G, ⇧⌘G and ⇧⌘L work here as on the canvas.
 */
export function LayersTree({ outputId }: { outputId: string }) {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const { layerId, extra } = useEditor((s) => s.selection);
  const collapsed = useEditor((s) => s.collapsed);
  const setCollapsed = useEditor((s) => s.setCollapsed);

  const tree = useMemo(
    () => layerTree(show.layers.filter((l) => l.outputId === outputId && l.kind !== 'audio')),
    [show.layers, outputId],
  );
  const frames = useMemo(() => [...tree.byId.values()].filter(isFrame).map((f) => f.id), [tree]);
  const selected = useMemo(
    () => [layerId, ...extra].filter((id): id is string => !!id && tree.byId.has(id)),
    [layerId, extra, tree],
  );
  const problems = useMemo(
    () =>
      new Map(
        checkLogic(show).flatMap((i) =>
          i.area === 'stage' && i.layerId ? [[i.layerId, i.text]] : [],
        ),
      ),
    [show],
  );

  // Selecting a layer on the canvas opens the frames around it; folding one later still works.
  useEffect(() => {
    const around = new Set(selected.flatMap((id) => ancestorsOf(tree, id).map((f) => f.id)));
    const { collapsed: now, setCollapsed: set } = useEditor.getState();
    if (now.some((id) => around.has(id))) set(now.filter((id) => !around.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.join()]);

  // Dragging restacks, moves a layer in or out of a frame, or drops it onto a frame to nest it;
  // it stays where it is drawn. Never into itself.
  const dragged = useRef<string[]>([]);
  const inside = (key: string) =>
    dragged.current.some((id) => id === key || ancestorsOf(tree, key).some((f) => f.id === id));
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ 'text/plain': String(k) })),
    onDragStart: (e) => void (dragged.current = [...e.keys].map(String)),
    getDropOperation: (target) =>
      target.type === 'item' && !inside(String(target.key)) ? 'move' : 'cancel',
    shouldAcceptItemDrop: (target) => isFrame(tree.byId.get(String(target.key))),
    onMove: (e) =>
      update(
        (d) =>
          void moveLayers(
            d,
            [...e.keys].map(String),
            String(e.target.key),
            e.target.dropPosition,
            measureLayer,
          ),
      ),
    renderDropIndicator: (target) => <DropIndicator target={target} className="h-0.5 bg-accent" />,
  });

  const onSelect = (keys: AriaSelection) => {
    const next = keys === 'all' ? [...tree.byId.keys()] : [...keys].map(String);
    // The layer just added to the selection is the one the inspector shows.
    const primary =
      next.find((k) => !selected.includes(k)) ??
      (layerId && next.includes(layerId) ? layerId : next[0]) ??
      null;
    select({ layerId: primary, extra: next.filter((k) => k !== primary) });
  };

  const onKeys = (e: KeyboardEvent) => {
    if ((e.target as Element).closest('input, textarea')) return;
    const primary = layerId && tree.byId.has(layerId) ? layerId : null;
    const handled = () => (e.preventDefault(), e.stopPropagation());
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      if (!primary) return;
      handled();
      update((d) => stepLayer(d, primary, e.key === 'ArrowUp' ? 1 : -1));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      handled();
      deleteLayers(selected);
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
      handled();
      duplicateSelection(selected);
    } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
      handled();
      toggleLock(selected);
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
      handled();
      (e.shiftKey ? ungroupSelection : frameSelection)(selected);
    } else if (e.key === 'F2') {
      handled();
      focusLayerName();
    }
  };

  const toggleVisible = (id: string) =>
    update((d) => {
      const x = d.layers.find((y) => y.id === id);
      if (x) x.visible = !x.visible;
    });

  const row = (l: Layer) => {
    // Under a frame that starts hidden: on at the start, but not seen until the frame is.
    const dim = ancestorsOf(tree, l.id).some((f) => !f.visible);
    const problem = problems.get(l.id);
    const lockedAbove = !l.locked && ancestorsOf(tree, l.id).some((f) => f.locked);
    return (
      <TreeItem
        id={l.id}
        textValue={l.name}
        className={({ isSelected, isFocusVisible }) =>
          cn(
            'group flex cursor-default items-center outline-none',
            isSelected ? 'bg-control-active' : 'hover:bg-control-hover',
            isFocusVisible && 'outline-2 -outline-offset-2 outline-focus',
          )
        }
      >
        <TreeItemContent>
          {({ level, isExpanded, hasChildItems }) => (
            <div
              className="flex min-w-0 flex-1 items-center gap-1 py-1 pr-1"
              style={{ paddingInlineStart: 4 + (level - 1) * 14 }}
            >
              <AriaButton
                slot="drag"
                aria-label={`Drag ${l.name}`}
                className="cursor-grab text-fg-icon opacity-40 outline-none group-hover:opacity-100"
              >
                <GripVertical size={14} />
              </AriaButton>
              {hasChildItems ? (
                <AriaButton
                  slot="chevron"
                  aria-label={`${isExpanded ? 'Fold' : 'Open'} ${l.name}`}
                  className="flex size-5 shrink-0 items-center justify-center text-fg-icon outline-none hover:text-fg"
                >
                  <ChevronRight size={13} className={cn(isExpanded && 'rotate-90')} />
                </AriaButton>
              ) : (
                <span className="w-5 shrink-0" />
              )}
              <IconButton
                label={l.visible ? 'On at the start' : 'Hidden at the start'}
                icon={
                  l.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-fg-subtle" />
                }
                onClick={() => toggleVisible(l.id)}
              />
              <div className={cn('min-w-0 flex-1', dim && 'text-fg-muted')}>
                <div className="truncate text-ui">{l.name}</div>
                <div className="text-caption text-fg-subtle">
                  {isFrame(l) && l.layout.mode !== 'free'
                    ? `Frame · ${l.layout.mode}`
                    : layerKindLabel(l)}
                </div>
              </div>
              {lockedAbove ? (
                <span data-info="Locked with its frame" className="px-1.5 text-fg-subtle">
                  <Lock size={12} aria-hidden />
                  <span className="sr-only">Locked with its frame</span>
                </span>
              ) : (
                <IconButton
                  label={l.locked ? `Unlock ${l.name}` : `Lock ${l.name}`}
                  shortcut="⇧⌘L"
                  aria-pressed={!!l.locked}
                  icon={l.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                  onClick={() => toggleLock([l.id])}
                  className={cn(
                    !l.locked &&
                      'text-fg-subtle opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
                  )}
                />
              )}
              {problem && (
                <span data-info={problem} className="text-warn">
                  <AlertTriangle size={13} aria-hidden />
                  <span className="sr-only">{problem}</span>
                </span>
              )}
              <div className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                <IconButton
                  label="Bring forward"
                  shortcut="⌥↑"
                  icon={<ArrowUp size={12} />}
                  onClick={() => update((d) => stepLayer(d, l.id, 1))}
                />
                <IconButton
                  label="Send backward"
                  shortcut="⌥↓"
                  icon={<ArrowDown size={12} />}
                  onClick={() => update((d) => stepLayer(d, l.id, -1))}
                />
              </div>
            </div>
          )}
        </TreeItemContent>
        <Collection items={tree.children(l.id)}>{row}</Collection>
      </TreeItem>
    );
  };

  return (
    <div onKeyDownCapture={onKeys}>
      <Tree
        aria-label="Layers, front first"
        items={tree.roots}
        dependencies={[selected, problems, tree]}
        selectionMode="multiple"
        selectionBehavior="replace"
        selectedKeys={selected}
        onSelectionChange={onSelect}
        expandedKeys={frames.filter((id) => !collapsed.includes(id))}
        onExpandedChange={(keys) => setCollapsed(frames.filter((id) => !keys.has(id)))}
        onAction={() => focusLayerName()}
        dragAndDropHooks={dragAndDropHooks}
        className="outline-none"
      >
        {row}
      </Tree>
    </div>
  );
}
