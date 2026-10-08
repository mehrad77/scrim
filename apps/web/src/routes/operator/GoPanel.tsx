import { cueOrder } from '@scrim/format';
import { Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { keyLabel, PANIC_KEY } from '../../host/inputs.js';
import { epochNow } from '../../lib/clock.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../../ui/Button.js';
import { Kbd } from '../../ui/Panel.js';
import { useHost } from './Operator.js';

export function GoPanel() {
  const [host, snap] = useHost();
  const { show, state } = snap;
  const order = useMemo(() => cueOrder(show), [show]);
  const standby = order.find((c) => c.id === state.standby);
  const last = order.find((c) => c.id === state.lastFired);
  const [now, setNow] = useState(epochNow);
  // Follow the blackout's target, not its tween: the clock below only ticks while a follow or
  // hold is running, so a tween read here could stay stale after Release.
  const blackedOut = state.blackout.to === 1;

  useEffect(() => {
    if (!state.follow && !state.held) return;
    const id = setInterval(() => setNow(epochNow()), 100);
    return () => clearInterval(id);
  }, [state.follow, state.held]);

  const keyFor = (type: string) => show.inputs.keys.find((k) => k.command.type === type)?.key;
  const goKey = keyFor('go');
  const followIn = state.follow
    ? Math.max(0, (state.follow.at - (state.held ? (state.heldAt ?? now) : now)) / 1000)
    : null;

  return (
    <section
      className={cn(
        'rounded-control border bg-panel p-4',
        blackedOut ? 'border-lamp-fault' : 'border-line-subtle',
      )}
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="label-caps text-fg-subtle">Live</div>
          <div className="truncate text-lg text-fg-muted">{last ? last.name : '—'}</div>
          <div className="label-caps mt-3 text-standby">Standby</div>
          <div className="truncate text-3xl font-semibold">
            {standby ? standby.name : 'End of show'}
          </div>
          {standby?.notes && <div className="mt-1 text-ui text-fg-muted">{standby.notes}</div>}
          {followIn !== null && (
            <div className="mt-2 text-ui text-standby">
              {state.held ? 'Held — auto-follow paused' : `Auto-follow in ${followIn.toFixed(1)}s`}
            </div>
          )}
          {state.held && followIn === null && (
            <div className="mt-2 text-ui text-standby">Held — timers paused</div>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2">
          <button
            onClick={() => host.command({ type: 'go' }, 'operator')}
            disabled={!standby}
            className="flex h-28 w-48 flex-col items-center justify-center rounded-control bg-lamp-go text-on-lamp transition-transform active:scale-[.97] active:transition-none disabled:opacity-30"
          >
            <span className="text-5xl font-black tracking-tight">GO</span>
            {goKey !== undefined && (
              <span className="text-caption opacity-70">{keyLabel(goKey)}</span>
            )}
          </button>
          <div className="flex gap-1">
            <Button
              size="sm"
              className="flex-1"
              title="Previous cue"
              icon={<SkipBack size={14} />}
              onClick={() => host.dispatch({ type: 'standbyPrev' })}
            />
            <Button
              size="sm"
              className="flex-1"
              variant={state.held ? 'primary' : 'secondary'}
              icon={state.held ? <Play size={14} /> : <Pause size={14} />}
              onClick={() => host.dispatch({ type: 'hold' })}
            >
              {state.held ? 'Resume' : 'Hold'}
            </Button>
            <Button
              size="sm"
              className="flex-1"
              title="Next cue"
              icon={<SkipForward size={14} />}
              onClick={() => host.dispatch({ type: 'standbyNext' })}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {blackedOut ? (
          <Button
            variant="danger"
            size="lg"
            className="flex-1"
            onClick={() => host.dispatch({ type: 'release', fade: 1 })}
          >
            Blacked out — release (fade back in 1s)
          </Button>
        ) : (
          <Button
            variant="danger"
            size="lg"
            className="flex-1"
            icon={<Square size={16} />}
            onClick={() => host.dispatch({ type: 'panic' })}
          >
            PANIC — black & mute everything <Kbd>{keyLabel(PANIC_KEY)}</Kbd>
          </Button>
        )}
      </div>
    </section>
  );
}
