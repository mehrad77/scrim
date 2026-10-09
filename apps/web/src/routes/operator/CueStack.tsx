import { runOrder, sceneSequence } from '@scrim/engine';
import { cueOrder, type Cue, type Scene } from '@scrim/format';
import { Check, ChevronRight, Play, Timer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GridList, GridListItem } from 'react-aria-components';
import { cn } from '../../lib/cn.js';
import { notice } from '../../ui/notice.js';
import { Panel } from '../../ui/Panel.js';
import { useHost } from './Operator.js';

/**
 * The operator's cue list. Next, running and done differ by position and shape, not just hue:
 * a playhead bar for NEXT, a play icon for LIVE, a check and dimmed text for done.
 * Rehearsal: click puts a cue on standby, double-click fires it. Show: click only selects (to
 * read it); Enter puts the selected cue on standby, and the message strip confirms the change.
 * Scenes follow tonight's running order; skipped ones fold away at the bottom, and putting one
 * of their cues on standby brings the scene back. Numbers stay the show's own.
 */
export function CueStack({ toggle }: { toggle?: ReactNode }) {
  const [host, snap] = useHost();
  const { show, state, mode, lastRunAt } = snap;
  const order = useMemo(() => cueOrder(show), [show]);
  const index = useMemo(() => new Map(order.map((c, i) => [c.id, i])), [order]);
  const tonight = state.order ?? null;
  const playing = useMemo(() => runOrder(show, tonight), [show, tonight]);
  const runIndex = useMemo(() => new Map(playing.map((c, i) => [c.id, i])), [playing]);
  const [scenes, skippedScenes] = useMemo(() => {
    const all = sceneSequence(show, tonight).flatMap((id) => {
      const s = show.scenes.find((x) => x.id === id);
      return s ? [s] : [];
    });
    const skipped = new Set(tonight?.skipped ?? []);
    return [all.filter((s) => !skipped.has(s.id)), all.filter((s) => skipped.has(s.id))];
  }, [show, tonight]);
  const list = useRef<HTMLDivElement>(null);
  const rehearsal = mode === 'rehearsal';
  const [selected, setSelected] = useState<string | null>(null);
  const lastIndex = state.lastFired ? (runIndex.get(state.lastFired) ?? -1) : -1;

  // Keep the standby cue in view; instant, because standby moves come from keys and GO.
  useEffect(() => {
    list.current?.querySelector('[data-standby="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [state.standby]);

  const changed = (updatedAt: number) => rehearsal && lastRunAt !== null && updatedAt > lastRunAt;

  const setStandby = (cue: Cue) => {
    if (cue.id === state.standby) return;
    const was = order.find((c) => c.id === state.standby);
    host.dispatch({ type: 'standby', cueId: cue.id });
    if (!rehearsal) notice(`Next: ${cue.name}${was ? ` (was ${was.name})` : ''}`);
  };

  const renderScene = (scene: Scene) => {
    const cues = show.cues.filter((c) => c.sceneId === scene.id);
    if (!cues.length) return null;
    return (
      <div key={scene.id} className="mb-1">
        <button
          type="button"
          className="label-caps w-full px-2 pt-2 pb-1 text-left text-fg-subtle hover:text-fg-muted"
          onClick={() => setStandby(cues[0]!)}
          data-info="Put the first cue of this scene on standby"
        >
          {scene.name}
        </button>
        <GridList
          aria-label={`Cues in ${scene.name}`}
          items={cues}
          // Rows read engine state, not just the cue: re-render them when it changes.
          dependencies={[state.standby, state.lastFired, lastIndex, runIndex, rehearsal, lastRunAt]}
          selectionMode={rehearsal ? 'none' : 'single'}
          selectionBehavior="replace"
          selectedKeys={selected ? [selected] : []}
          onSelectionChange={(keys) => {
            const k = [...keys][0];
            setSelected(k === undefined ? null : String(k));
          }}
          onAction={(key) => {
            const cue = cues.find((c) => c.id === key);
            if (cue) setStandby(cue);
          }}
          className="outline-none"
        >
          {(cue) => {
            const isStandby = cue.id === state.standby;
            const isLive = cue.id === state.lastFired;
            const at = runIndex.get(cue.id);
            const done = !isLive && at !== undefined && at < lastIndex;
            return (
              <GridListItem
                id={cue.id}
                textValue={cue.name}
                data-standby={isStandby}
                data-info={
                  rehearsal
                    ? 'Click: standby · Double-click: fire now'
                    : 'Click: select to read · Enter: put on standby'
                }
                className={({ isFocusVisible, isSelected }) =>
                  cn(
                    'relative flex cursor-default items-center gap-2 py-2 pr-2 pl-3 outline-none',
                    isStandby
                      ? 'bg-lamp-standby-tint'
                      : isSelected
                        ? 'bg-control-active'
                        : 'hover:bg-control-hover',
                    isFocusVisible && 'outline-2 -outline-offset-2 outline-focus',
                  )
                }
              >
                <div
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onDoubleClick={() =>
                    rehearsal && host.dispatch({ type: 'fireCue', cueId: cue.id })
                  }
                >
                  {/* The playhead: a bar on the NEXT cue's edge. */}
                  {isStandby && (
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-lamp-standby" />
                  )}
                  <span
                    className={cn(
                      'w-6 text-right font-mono text-caption tabular-nums',
                      isStandby ? 'text-standby' : 'text-fg-subtle',
                    )}
                  >
                    {(index.get(cue.id) ?? 0) + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'flex items-center gap-1.5 truncate text-ui',
                        done && 'text-fg-subtle',
                        isStandby && 'font-semibold',
                      )}
                    >
                      {changed(cue.updatedAt) && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-info"
                          data-info="Changed since the last run"
                          aria-label="Changed since the last run"
                        />
                      )}
                      {cue.name}
                    </div>
                    {cue.notes && (
                      <div className="truncate text-caption text-fg-subtle">{cue.notes}</div>
                    )}
                  </div>
                  {cue.follow.auto && (
                    <span className="flex items-center gap-0.5 font-mono text-caption text-fg-muted tabular-nums">
                      <Timer size={11} />
                      {cue.follow.delay}s
                    </span>
                  )}
                  {isStandby && <span className="label-caps text-standby">Next</span>}
                  {isLive && (
                    <span className="label-caps flex items-center gap-1 text-go">
                      <Play size={11} /> Live
                    </span>
                  )}
                  {done && <Check size={13} className="text-fg-subtle" aria-label="Done" />}
                </div>
              </GridListItem>
            );
          }}
        </GridList>
      </div>
    );
  };

  return (
    <Panel title={toggle ? undefined : 'Cues'} actions={toggle} bodyClassName="p-1">
      <div ref={list}>
        {scenes.map(renderScene)}
        {skippedScenes.some((s) => show.cues.some((c) => c.sceneId === s.id)) && (
          <details className="group mt-2 border-t border-line-subtle pt-1 opacity-70">
            <summary className="label-caps flex cursor-default list-none items-center gap-1 px-2 py-1 text-fg-subtle [&::-webkit-details-marker]:hidden">
              <ChevronRight size={12} className="group-open:rotate-90" aria-hidden />
              Skipped tonight ({skippedScenes.length})
            </summary>
            {skippedScenes.map(renderScene)}
          </details>
        )}
        {show.cues.some((c) => changed(c.updatedAt)) && (
          <p className="flex items-center gap-1.5 px-2 py-2 text-caption text-fg-subtle">
            <span className="size-1.5 rounded-full bg-info" /> changed since the last run
          </p>
        )}
      </div>
    </Panel>
  );
}
