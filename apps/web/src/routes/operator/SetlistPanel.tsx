import { sceneSequence } from '@scrim/engine';
import { ArrowDown, ArrowUp, ListMusic, Play, RotateCcw } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { DropIndicator, GridList, GridListItem, useDragAndDrop } from 'react-aria-components';
import { cn } from '../../lib/cn.js';
import { Button, IconButton } from '../../ui/Button.js';
import { promptDialog } from '../../ui/dialog.js';
import { MenuButton, type MenuAction } from '../../ui/Menu.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { useHost } from './Operator.js';

/**
 * Tonight's running order. Scenes (songs) are reordered and skipped live, in Show mode too,
 * without editing the show: it is performance state, journaled like standby. Rehearsal can keep
 * an order in the show as a setlist.
 */
export function SetlistPanel({ toggle }: { toggle?: ReactNode }) {
  const [host, snap] = useHost();
  const { show, state, mode } = snap;
  const order = state.order ?? null;
  const seq = useMemo(() => sceneSequence(show, order), [show, order]);
  const skipped = useMemo(() => new Set(order?.skipped ?? []), [order]);
  const rows = useMemo(
    () =>
      seq.flatMap((id) => {
        const scene = show.scenes.find((s) => s.id === id);
        const cues = show.cues.filter((c) => c.sceneId === id).length;
        return scene && cues ? [{ ...scene, cues }] : [];
      }),
    [seq, show],
  );
  // Places count only the scenes that play.
  const places = useMemo(() => {
    let n = 0;
    return new Map(rows.flatMap((r) => (skipped.has(r.id) ? [] : [[r.id, ++n] as const])));
  }, [rows, skipped]);
  const live = show.cues.find((c) => c.id === state.lastFired)?.sceneId ?? null;
  const next = show.cues.find((c) => c.id === state.standby)?.sceneId ?? null;
  const rehearsal = mode === 'rehearsal';

  const apply = (scenes: string[], skip: Set<string>) =>
    host.setOrder({ scenes, skipped: [...skip].filter((id) => scenes.includes(id)) });

  /** Put `ids` just before or after `target`, keeping every other scene where it is. */
  const moveTo = (ids: string[], target: string, position: 'before' | 'after') => {
    const rest = seq.filter((id) => !ids.includes(id));
    const at = rest.indexOf(target) + (position === 'after' ? 1 : 0);
    apply([...rest.slice(0, at), ...ids, ...rest.slice(at)], skipped);
  };
  const step = (id: string, dir: -1 | 1) => {
    const i = rows.findIndex((r) => r.id === id);
    const other = rows[i + dir];
    if (other) moveTo([id], other.id, dir < 0 ? 'before' : 'after');
  };
  const toggleSkip = (id: string) => {
    const skip = new Set(skipped);
    if (!skip.delete(id)) skip.add(id);
    apply(seq, skip);
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ 'text/plain': String(k) })),
    onReorder: (e) => {
      if (e.target.dropPosition === 'on') return;
      moveTo([...e.keys].map(String), String(e.target.key), e.target.dropPosition);
    },
    renderDropIndicator: (target) => <DropIndicator target={target} className="h-0.5 bg-focus" />,
  });

  const setlists = show.setlists ?? [];
  const menu: (MenuAction | 'separator')[] = [
    ...setlists.map((l) => ({
      id: `use:${l.id}`,
      label: `Play “${l.name}”`,
      onAction: () => host.useSetlist(l.id),
    })),
    ...(rehearsal
      ? [
          ...(setlists.length ? ['separator' as const] : []),
          {
            id: 'save',
            label: 'Keep this order as a setlist…',
            onAction: async () => {
              const name = await promptDialog(
                'Keep as a setlist',
                `Setlist ${setlists.length + 1}`,
                'Name',
              );
              if (name?.trim()) await host.saveSetlist(name.trim());
            },
          },
          ...setlists.map((l) => ({
            id: `delete:${l.id}`,
            label: `Delete “${l.name}”`,
            danger: true,
            onAction: () => void host.deleteSetlist(l.id),
          })),
        ]
      : []),
  ];

  return (
    <Panel
      className="h-full"
      bodyClassName="p-1"
      actions={
        <>
          {toggle}
          <span className="flex-1" />
          <IconButton
            label="Back to the show’s own order, with nothing skipped"
            icon={<RotateCcw size={13} />}
            disabled={!order}
            onClick={() => host.setOrder(null)}
          />
          {menu.length > 0 && (
            <MenuButton label="Setlists" icon={<ListMusic size={14} />} items={menu} />
          )}
        </>
      }
    >
      {rows.length < 2 ? (
        <Empty title="One scene">
          With more scenes (songs), reorder and skip them here, even in Show mode.
        </Empty>
      ) : (
        <GridList
          aria-label="Tonight’s running order"
          items={rows}
          dependencies={[skipped, live, next, rows, places]}
          dragAndDropHooks={dragAndDropHooks}
          className="outline-none"
        >
          {(row) => {
            const off = skipped.has(row.id);
            const isLive = row.id === live;
            const i = rows.indexOf(row);
            return (
              <GridListItem
                id={row.id}
                textValue={row.name}
                className={({ isFocusVisible, isDragging }) =>
                  cn(
                    'flex cursor-default items-center gap-2 rounded-control py-1.5 pr-1 pl-2 outline-none hover:bg-control-hover',
                    isFocusVisible && 'outline-2 -outline-offset-2 outline-focus',
                    isDragging && 'opacity-50',
                  )
                }
              >
                <span className="w-5 text-right font-mono text-caption text-fg-subtle tabular-nums">
                  {places.get(row.id) ?? '–'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-ui', off && 'text-fg-subtle line-through')}>
                    {row.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-caption text-fg-subtle">
                    {row.cues} cue{row.cues > 1 ? 's' : ''}
                    {off && ' · skipped'}
                    {isLive && (
                      <span className="label-caps flex items-center gap-1 text-go">
                        <Play size={11} /> Live
                      </span>
                    )}
                    {!isLive && row.id === next && (
                      <span className="label-caps text-standby">Next</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isLive}
                  aria-pressed={off}
                  onClick={() => toggleSkip(row.id)}
                  title={
                    isLive
                      ? 'What is live can’t be skipped'
                      : off
                        ? 'Play it again'
                        : 'Leave it out tonight'
                  }
                >
                  {off ? 'Play' : 'Skip'}
                </Button>
                <IconButton
                  label={`Move “${row.name}” up`}
                  icon={<ArrowUp size={13} />}
                  disabled={i === 0}
                  onClick={() => step(row.id, -1)}
                />
                <IconButton
                  label={`Move “${row.name}” down`}
                  icon={<ArrowDown size={13} />}
                  disabled={i === rows.length - 1}
                  onClick={() => step(row.id, 1)}
                />
              </GridListItem>
            );
          }}
        </GridList>
      )}
    </Panel>
  );
}
