import { runOrder } from '@scrim/engine';
import type { Cue, Moment } from '@scrim/format';
import { ChevronLeft, ChevronRight, Monitor, Pause, Play, Radio, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { openAllOutputs } from '../../host/goLive.js';
import { epochNow } from '../../lib/clock.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../../ui/Button.js';
import { Lamp } from '../../ui/Lamp.js';
import { toast } from '../../ui/toast.js';
import { GoButton, PanicButton } from './GoPanel.js';
import { useHost } from './Operator.js';

/**
 * The simple operator view (UX_PRINCIPLES › simple modes): one huge GO, what is on now and next
 * in plain words, Hold and Back, and PANIC in its own corner. Everything is sized for touch, so
 * a teacher, a volunteer or a leader facing the group can run the show from a tablet. Only GO
 * fires: sections and scenes are put on standby, and the open moment can be counted by hand.
 */
export function SimpleOperator() {
  const [host, snap] = useHost();
  const { show, state } = snap;
  const playing = runOrder(show, state.order ?? null);
  const live = playing.find((c) => c.id === state.lastFired) ?? null;
  const next = playing.find((c) => c.id === state.standby) ?? null;
  const goKey = show.inputs.keys.find((k) => k.command.type === 'go')?.key;
  const open = show.moments.filter((m) => state.moments[m.id]?.status === 'open');

  return (
    <main className="simple-operator min-h-0 flex-1 overflow-auto p-4" aria-label="Simple operator">
      <section className="[grid-area:now] flex min-w-0 flex-col gap-3" aria-label="Now and next">
        <NowNext label="Now" cue={live} empty="Nothing yet" />
        <NowNext label="Next" cue={next} empty="The end" strong />
        {next?.notes && <p className="text-body text-fg-muted">{next.notes}</p>}
      </section>

      <div className="[grid-area:panic] w-56 max-w-full justify-self-end">
        <PanicButton className="h-14" />
      </div>

      <div className="[grid-area:go] flex flex-col gap-3">
        <Readiness />
        <GoButton
          className="min-h-52 flex-1"
          ready={!!next}
          goKey={goKey}
          fired={state.fired}
          lockedUntil={snap.goLockedUntil}
          droppedAt={snap.goDroppedAt}
          holdMs={show.operator?.goHoldMs ?? 0}
          hold={snap.goHold}
          shortAt={snap.goHoldShortAt}
          onGo={() => host.command({ type: 'go' }, 'operator')}
          onPress={() => host.press({ type: 'go' }, 'operator', 'button:go')}
          onRelease={() => host.release('button:go')}
        />
      </div>

      <div className="[grid-area:ctl] grid grid-cols-2 gap-3">
        <Button
          size="lg"
          className="h-14"
          variant={state.held ? 'primary' : 'secondary'}
          icon={state.held ? <Play size={20} /> : <Pause size={20} />}
          onClick={() => host.dispatch({ type: 'hold' })}
        >
          {state.held ? 'Resume' : 'Hold'}
        </Button>
        <Button
          size="lg"
          className="h-14"
          icon={<Undo2 size={20} />}
          disabled={!state.back}
          onClick={() => host.command({ type: 'back' }, 'operator')}
        >
          Back
        </Button>
      </div>

      <div className="[grid-area:side] flex min-w-0 flex-col gap-4">
        <Places live={live} />
        {open.map((m) => (
          <MomentCount key={m.id} moment={m} />
        ))}
      </div>
    </main>
  );
}

function NowNext({
  label,
  cue,
  empty,
  strong,
}: {
  label: string;
  cue: Cue | null;
  empty: string;
  strong?: boolean;
}) {
  const [, snap] = useHost();
  const scene =
    cue && snap.show.scenes.length > 1
      ? snap.show.scenes.find((s) => s.id === cue.sceneId)?.name
      : undefined;
  return (
    // The cue's name gets its full width before the scene's name gets any.
    <div className="grid min-w-0 grid-cols-[3rem_minmax(0,max-content)_minmax(0,1fr)] items-baseline gap-3">
      <span className={cn('label-caps', strong ? 'text-standby' : 'text-fg-subtle')}>{label}</span>
      <span
        className={cn(
          'min-w-0 truncate',
          strong ? 'text-cue font-semibold' : 'text-heading text-fg-muted',
          !cue && 'text-fg-subtle',
        )}
      >
        {cue ? cue.name : empty}
      </span>
      {scene && <span className="min-w-0 truncate text-ui text-fg-subtle">{scene}</span>}
    </div>
  );
}

/** What stops GO from reaching the room: the screens aren't open, the phones can't join yet. */
function Readiness() {
  const [host, snap] = useHost();
  const { show } = snap;
  const closed = show.outputs.filter((o) => snap.health[o.id] !== 'ok');
  const needsRoom = show.moments.length > 0 && snap.relay.status === 'off';
  const standby = show.cues.find((c) => c.id === snap.state.standby);
  const waitFor = standby?.waitFor && show.triggers.find((t) => t.id === standby.waitFor);
  if (!closed.length && !needsRoom && !waitFor) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {closed.length > 0 && (
        <Button
          size="lg"
          icon={<Monitor size={18} />}
          onClick={async () => {
            if (!(await openAllOutputs(show)))
              toast(
                'The browser blocked a screen. Allow pop-ups for Scrim and try again.',
                'error',
              );
          }}
        >
          {closed.length === show.outputs.length
            ? `Open the screen${show.outputs.length > 1 ? 's' : ''}`
            : `Reopen ${closed.map((o) => o.name).join(', ')}`}
        </Button>
      )}
      {needsRoom && (
        <Button size="lg" icon={<Radio size={18} />} onClick={() => void host.connectRelay()}>
          Let phones join
        </Button>
      )}
      {waitFor && (
        <Lamp tone={snap.performerReady ? 'go' : 'off'}>
          {snap.performerReady ? `${waitFor.name} is ready` : `Waiting for ${waitFor.name}`}
        </Lamp>
      )}
    </div>
  );
}

/**
 * Where to go next without hunting through a cue list: the previous or next scene (song), and
 * the parts of the one playing (Verse, Chorus). They put it on standby; GO plays it.
 */
function Places({ live }: { live: Cue | null }) {
  const [host, snap] = useHost();
  const { show } = snap;
  const scenes = new Set(show.cues.map((c) => c.sceneId)).size;
  const sceneId = live?.sceneId ?? show.cues.find((c) => c.id === snap.state.standby)?.sceneId;
  const sections = [
    ...new Map(
      show.cues
        .filter((c) => c.sceneId === sceneId && c.section?.trim())
        .map((c) => [c.section!.trim().toLowerCase(), c.section!.trim()]),
    ).values(),
  ];
  if (scenes < 2 && !sections.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {sections.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Parts of this scene">
          {sections.map((section) => (
            <Button
              key={section}
              size="lg"
              onClick={() => host.dispatch({ type: 'jump', target: { to: 'section', section } })}
            >
              {section}
            </Button>
          ))}
        </div>
      )}
      {scenes > 1 && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            icon={<ChevronLeft size={18} />}
            onClick={() => host.dispatch({ type: 'jump', target: { to: 'prevScene' } })}
          >
            Previous scene
          </Button>
          <Button
            size="lg"
            icon={<ChevronRight size={18} />}
            onClick={() => host.dispatch({ type: 'jump', target: { to: 'nextScene' } })}
          >
            Next scene
          </Button>
        </div>
      )}
    </div>
  );
}

/** The open moment, counted by hand when the room has no phones: +1 for each raised hand. */
function MomentCount({ moment: m }: { moment: Moment }) {
  const [host, snap] = useHost();
  const ms = snap.state.moments[m.id]!;
  const [now, setNow] = useState(epochNow);
  useEffect(() => {
    if (ms.closesAt === null) return;
    const id = setInterval(() => setNow(epochNow()), 250);
    return () => clearInterval(id);
  }, [ms.closesAt]);
  const left = ms.closesAt !== null ? Math.max(0, Math.ceil((ms.closesAt - now) / 1000)) : null;
  const add = (optionId?: string) =>
    host.dispatch({
      type: 'countVote',
      momentId: m.id,
      amount: 1,
      source: 'counted',
      ...(optionId ? { optionId } : {}),
    });
  return (
    <section
      className="rounded-control border-2 border-go bg-lamp-go-tint p-3"
      aria-label={`Open: ${m.name}`}
    >
      <div className="flex items-baseline gap-2">
        <span className="label-caps text-go">Open</span>
        <span className="min-w-0 flex-1 truncate text-heading font-semibold">
          {m.prompt || m.name}
        </span>
        {left !== null && <span className="font-mono text-ui text-standby">{left}s</span>}
      </div>
      {m.type === 'vote' && (
        <ul className="mt-3 flex flex-col gap-2">
          {m.options.map((o) => (
            <li key={o.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-body">{o.label}</span>
              <span
                className="w-10 text-right font-mono text-heading tabular-nums"
                data-testid="simple-tally"
              >
                {ms.tally[o.id] ?? 0}
              </span>
              <Button
                size="lg"
                className="w-20"
                onClick={() => add(o.id)}
                aria-label={`Count one for ${o.label}`}
              >
                +1
              </Button>
            </li>
          ))}
        </ul>
      )}
      {m.type === 'tap' && (
        <div className="mt-3 flex items-center gap-3">
          <span className="flex-1 font-mono text-heading tabular-nums">{ms.count} taps</span>
          <Button size="lg" className="w-20" onClick={() => add()}>
            +1
          </Button>
        </div>
      )}
      {m.type !== 'vote' && m.type !== 'tap' && (
        <p className="mt-2 text-ui text-fg-muted">{ms.n} answered</p>
      )}
      <Button
        size="lg"
        className="mt-3 w-full"
        onClick={() => host.dispatch({ type: 'closeMoment', momentId: m.id })}
      >
        Close it now
      </Button>
    </section>
  );
}
