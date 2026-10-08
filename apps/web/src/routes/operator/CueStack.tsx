import { cueOrder } from '@scrim/format';
import { Timer } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { cn } from '../../lib/cn.js';
import { Panel } from '../../ui/Panel.js';
import { useHost } from './Operator.js';

export function CueStack() {
  const [host, snap] = useHost();
  const { show, state, mode, lastRunAt } = snap;
  const order = useMemo(() => cueOrder(show), [show]);
  const numbers = useMemo(() => new Map(order.map((c, i) => [c.id, i + 1])), [order]);
  const list = useRef<HTMLDivElement>(null);
  const rehearsal = mode === 'rehearsal';

  // Keep the standby cue in view.
  useEffect(() => {
    list.current?.querySelector('[data-standby="true"]')?.scrollIntoView({ block: 'nearest' }); // instant: standby moves come from keys and GO
  }, [state.standby]);

  const changed = (updatedAt: number) => rehearsal && lastRunAt !== null && updatedAt > lastRunAt;

  return (
    <Panel title="Cues" bodyClassName="p-1">
      <div ref={list}>
        {show.scenes.map((scene) => {
          const cues = show.cues.filter((c) => c.sceneId === scene.id);
          if (!cues.length) return null;
          return (
            <div key={scene.id} className="mb-1">
              <button
                className="w-full px-2 pt-2 pb-1 text-left text-[11px] font-semibold tracking-wide text-ink-400 uppercase hover:text-ink-200"
                onClick={() => host.dispatch({ type: 'standby', cueId: cues[0]!.id })}
                title="Put the first cue of this scene on standby"
              >
                {scene.name}
              </button>
              {cues.map((cue) => {
                const isStandby = cue.id === state.standby;
                const isLast = cue.id === state.lastFired;
                return (
                  <div
                    key={cue.id}
                    data-standby={isStandby}
                    role="button"
                    tabIndex={-1}
                    onClick={() => host.dispatch({ type: 'standby', cueId: cue.id })}
                    onDoubleClick={() =>
                      rehearsal && host.dispatch({ type: 'fireCue', cueId: cue.id })
                    }
                    title={rehearsal ? 'Click: standby · Double-click: fire now' : 'Click: standby'}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2',
                      isStandby
                        ? 'border-standby bg-amber-500/10'
                        : isLast
                          ? 'border-go/50 bg-green-500/10'
                          : 'border-transparent hover:bg-ink-800',
                    )}
                  >
                    <span className="w-6 text-right font-mono text-xs text-ink-400">
                      {numbers.get(cue.id)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate text-sm">
                        {changed(cue.updatedAt) && (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-sky-400"
                            title="Changed since the last run"
                          />
                        )}
                        {cue.name}
                      </div>
                      {cue.notes && (
                        <div className="truncate text-[11px] text-ink-400">{cue.notes}</div>
                      )}
                    </div>
                    {cue.follow.auto && (
                      <span className="flex items-center gap-0.5 text-[11px] text-standby">
                        <Timer size={11} />
                        {cue.follow.delay}s
                      </span>
                    )}
                    {isStandby && (
                      <span className="rounded bg-standby px-1 text-[10px] font-bold text-ink-950">
                        NEXT
                      </span>
                    )}
                    {isLast && (
                      <span className="rounded bg-go px-1 text-[10px] font-bold text-ink-950">
                        LIVE
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {show.cues.some((c) => changed(c.updatedAt)) && (
          <p className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-ink-500">
            <span className="size-1.5 rounded-full bg-sky-400" /> changed since the last run
          </p>
        )}
      </div>
    </Panel>
  );
}
