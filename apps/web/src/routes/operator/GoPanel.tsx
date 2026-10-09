import { cueOrder, type Command } from '@scrim/format';
import {
  Check,
  Film,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Type,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { keyLabel, PANIC_KEY } from '../../host/inputs.js';
import { epochNow } from '../../lib/clock.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../../ui/Button.js';
import { Lamp } from '../../ui/Lamp.js';
import { notice } from '../../ui/notice.js';
import { Mappable } from './MapMode.js';
import { useHost } from './Operator.js';

/**
 * The GO panel, in fixed regions that never change size: standby (name and notes), GO with Hold
 * and Back, what is running, and PANIC in its own corner (UX_PRINCIPLES.md › GO is mechanical).
 */
export function GoPanel() {
  const [host, snap] = useHost();
  const { show, state } = snap;
  const order = useMemo(() => cueOrder(show), [show]);
  const standbyIndex = order.findIndex((c) => c.id === state.standby);
  const standby = order[standbyIndex];
  const last = order.find((c) => c.id === state.lastFired);
  // Follow the blackout's target, not its tween, so Release clears it at once.
  const blackedOut = state.blackout.to === 1;
  const [now, setNow] = useState(epochNow);

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
    <section className="flex shrink-0 flex-col gap-4 bg-panel p-4">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="label-caps text-standby">Standby</span>
            {standby?.waitFor && (
              <PerformerLamp
                name={show.triggers.find((t) => t.id === standby.waitFor)?.name ?? 'Performer'}
                ready={snap.performerReady}
              />
            )}
          </div>
          {/* The cue name gets its full width before the scene name gets any. */}
          <div className="mt-1 grid grid-cols-[auto_minmax(0,max-content)_minmax(0,1fr)] items-baseline gap-3 text-cue font-semibold">
            {standby ? (
              <>
                <span className="font-mono text-standby tabular-nums">{standbyIndex + 1}</span>
                <span className="truncate">{standby.name}</span>
                {/* After a jump the cue name alone can be ambiguous: which song's Chorus? */}
                {show.scenes.length > 1 && (
                  <span className="truncate text-ui font-normal text-fg-muted">
                    {show.scenes.find((s) => s.id === standby.sceneId)?.name}
                  </span>
                )}
              </>
            ) : (
              <span className="text-fg-subtle">End of show</span>
            )}
          </div>
          {/* Fixed height: long notes scroll here instead of pushing GO down. */}
          <div className="mt-2 h-14 overflow-auto text-ui text-fg-muted">
            {standby?.notes || <span className="text-fg-subtle">No notes for this cue.</span>}
          </div>
        </div>
        <div className="flex w-48 shrink-0 flex-col gap-2">
          <Mappable command={{ type: 'go' }}>
            <GoButton
              ready={!!standby}
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
          </Mappable>
          <div className="flex gap-1">
            <Mappable command={{ type: 'hold' }} className="flex-1">
              <Button
                className="w-full"
                variant={state.held ? 'primary' : 'secondary'}
                icon={state.held ? <Play size={16} /> : <Pause size={16} />}
                onClick={() => host.dispatch({ type: 'hold' })}
              >
                {state.held ? 'Resume' : 'Hold'}
              </Button>
            </Mappable>
            <Mappable command={{ type: 'back' }} className="flex-1">
              <Button
                className="w-full"
                icon={<Undo2 size={16} />}
                disabled={!state.back}
                title="Back: undo the last GO"
                onClick={() => host.command({ type: 'back' }, 'operator')}
              >
                Back
              </Button>
            </Mappable>
          </div>
          <div className="flex gap-1">
            <Mappable command={{ type: 'standbyPrev' }} className="flex-1">
              <Button
                className="w-full"
                title="Previous cue on standby"
                icon={<SkipBack size={16} />}
                onClick={() => host.dispatch({ type: 'standbyPrev' })}
              />
            </Mappable>
            <Mappable command={{ type: 'standbyNext' }} className="flex-1">
              <Button
                className="w-full"
                title="Next cue on standby"
                icon={<SkipForward size={16} />}
                onClick={() => host.dispatch({ type: 'standbyNext' })}
              />
            </Mappable>
          </div>
        </div>
      </div>

      <div className="flex min-h-control items-center gap-3 border-t border-line-subtle pt-3 text-ui">
        <Lamp tone={last ? 'go' : 'off'} icon={last ? <Play size={12} /> : undefined}>
          Live
        </Lamp>
        <span className="min-w-0 flex-1 truncate">{last ? last.name : 'Nothing has run yet'}</span>
        {state.held && (
          <Lamp tone="off" icon={<Pause size={12} />}>
            Held
          </Lamp>
        )}
        {followIn !== null && !state.held && (
          <span className="font-mono text-fg-muted tabular-nums">
            Auto-follow in {followIn.toFixed(1)} s
          </span>
        )}
      </div>

      {/* PANIC lives in its own corner: unmistakable, but not where a slip from GO lands. */}
      <div className="@container flex items-center gap-3 pt-2">
        <SecondaryClears />
        <Mappable command={{ type: 'panic' }} className="ml-auto w-2/5 min-w-56">
          {blackedOut ? (
            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-control bg-lamp-fault px-3 font-semibold text-on-fault"
              onClick={() => host.dispatch({ type: 'release', fade: 1 })}
            >
              <span className="label-caps">Blacked out</span> · Release
            </button>
          ) : (
            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-control border border-line-control bg-control px-3 font-semibold text-fg hover:bg-control-hover"
              onClick={() => host.dispatch({ type: 'panic' })}
            >
              <span aria-hidden className="size-2 rounded-[1px] border border-lamp-fault" />
              <Square size={14} className="text-fault" />
              PANIC
              <kbd className="label-caps rounded-control border border-line-control px-1 text-fg-muted">
                {keyLabel(PANIC_KEY)}
              </kbd>
            </button>
          )}
        </Mappable>
      </div>
    </section>
  );
}

/**
 * PANIC's secondary clears: take one kind of thing off stage without a full blackout. Text and
 * Media fade out what's showing; pressed again, they bring it back, until the next cue fires.
 * Sound mutes everything until it's pressed again. Labels hide when the panel is narrow, so
 * PANIC never moves.
 */
function SecondaryClears() {
  const [host, snap] = useHost();
  const { state } = snap;
  const clears: {
    command: Command;
    on: boolean;
    icon: ReactNode;
    label: string;
    info: [off: string, on: string];
  }[] = [
    {
      command: { type: 'clearText' },
      on: !!state.cleared?.text,
      icon: <Type size={16} />,
      label: 'Text',
      info: [
        'Clear text: fade every caption, counter and value off stage',
        'Text cleared: bring it back',
      ],
    },
    {
      command: { type: 'clearMedia' },
      on: !!state.cleared?.media,
      icon: <Film size={16} />,
      label: 'Media',
      info: ['Clear media: fade pictures and video off stage', 'Media cleared: bring it back'],
    },
    {
      command: { type: 'mute' },
      on: state.mute?.to === 1,
      icon: state.mute?.to === 1 ? <VolumeX size={16} /> : <Volume2 size={16} />,
      label: 'Sound',
      info: ['Mute every sound', 'Sound muted: turn it back on'],
    },
  ];
  return (
    <div role="group" aria-label="Secondary clears" className="flex gap-1">
      {clears.map((c) => (
        <Mappable key={c.command.type} command={c.command}>
          <Button
            variant={c.on ? 'primary' : 'secondary'}
            icon={c.icon}
            aria-pressed={c.on}
            aria-label={c.info[c.on ? 1 : 0]}
            title={c.info[c.on ? 1 : 0]}
            onClick={() => host.command(c.command, 'operator')}
          >
            <span className="hidden @lg:inline">{c.label}</span>
          </Button>
        </Mappable>
      ))}
    </div>
  );
}

/** "Bell ready ✓" once the performer taps Ready; until then, who the cue is waiting for. */
function PerformerLamp({ name, ready }: { name: string; ready: boolean }) {
  return ready ? (
    <Lamp tone="go" icon={<Check size={12} />}>
      {name} ready
    </Lamp>
  ) : (
    <Lamp tone="off" className="text-fg-muted">
      Waiting for {name}
    </Lamp>
  );
}

/**
 * GO: tinted with a lit border when a cue is on standby, filled for the instant it fires, and
 * ringed while the double-GO guard holds. A press during the guard flashes the ring, so a GO is
 * never dropped silently. It is never disabled and never moves.
 */
function GoButton({
  ready,
  goKey,
  fired,
  lockedUntil,
  droppedAt,
  holdMs,
  hold,
  shortAt,
  onGo,
  onPress,
  onRelease,
}: {
  ready: boolean;
  goKey: string | undefined;
  fired: number;
  lockedUntil: number;
  droppedAt: number | null;
  /** Hold-to-confirm: GO fires after a press this long. 0: on click. */
  holdMs: number;
  hold: { since: number; ms: number } | null;
  shortAt: number | null;
  onGo: () => void;
  onPress: () => void;
  onRelease: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const [ring, setRing] = useState(false);
  const lastFired = useRef(fired);
  const seconds = `${(holdMs / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} s`;

  // A hold fills four segments in steps set from here, never by a CSS transition.
  const [lit, setLit] = useState(0);
  useEffect(() => {
    if (!hold) return setLit(0);
    const step = () => setLit(Math.min(4, Math.floor(((Date.now() - hold.since) / hold.ms) * 4)));
    step();
    const id = setInterval(step, hold.ms / 4);
    return () => clearInterval(id);
  }, [hold]);

  // Let go too soon: say how long to hold, in the message strip (once per early release).
  const seenShort = useRef(shortAt);
  useEffect(() => {
    if (shortAt !== null && shortAt !== seenShort.current)
      notice(`Hold GO for ${seconds} to fire it`);
    seenShort.current = shortAt;
  }, [shortAt, seconds]);

  // A GO from any source (key, pedal, remote) echoes on the button for 100 ms.
  useEffect(() => {
    if (fired <= lastFired.current) {
      lastFired.current = fired;
      return;
    }
    lastFired.current = fired;
    setPressed(true);
    setRing(true);
    const a = setTimeout(() => setPressed(false), 100);
    const b = setTimeout(() => setRing(false), Math.max(0, lockedUntil - Date.now()));
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [fired, lockedUntil]);

  useEffect(() => {
    if (droppedAt === null) return;
    setRing(true);
    const t = setTimeout(() => setRing(false), 300);
    return () => clearTimeout(t);
  }, [droppedAt]);

  const holding = holdMs > 0;
  return (
    <button
      type="button"
      onClick={holding ? undefined : onGo}
      onPointerDown={
        holding
          ? (e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onPress();
            }
          : undefined
      }
      onPointerUp={holding ? onRelease : undefined}
      onPointerCancel={holding ? onRelease : undefined}
      onKeyDown={holding ? (e) => e.key === 'Enter' && !e.repeat && onPress() : undefined}
      onKeyUp={holding ? (e) => e.key === 'Enter' && onRelease() : undefined}
      aria-description={holding ? `Hold for ${seconds} to fire` : undefined}
      data-pressed={pressed || undefined}
      className={cn(
        'flex h-28 w-full flex-col items-center justify-center rounded-control border-2 active:transition-none',
        ready
          ? 'border-go bg-lamp-go-tint text-go active:bg-lamp-go active:text-on-lamp data-pressed:bg-lamp-go data-pressed:text-on-lamp'
          : 'border-line-control bg-control text-fg-subtle',
        ring && 'outline-2 outline-offset-2 outline-fg',
      )}
    >
      <span className="text-display font-mono font-semibold">GO</span>
      {goKey !== undefined && (
        <span className="label-caps opacity-80">
          {holding ? `Hold ${keyLabel(goKey)} · ${seconds}` : keyLabel(goKey)}
        </span>
      )}
      {holding && (
        <span className="mt-1 flex gap-1" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn('h-1 w-6 rounded-full', i < lit ? 'bg-current' : 'bg-current/25')}
            />
          ))}
        </span>
      )}
    </button>
  );
}
