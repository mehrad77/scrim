import {
  CLOSE,
  type RelayToRemote,
  type RemoteToRelay,
  type RemoteTrigger,
  type RemoteView,
} from '@scrim/protocol';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { clientId } from '../lib/config.js';
import { cn } from '../lib/cn.js';
import { RelayClient, type RelayStatus } from '../transport/relay.js';
import { Lamp } from '../ui/Lamp.js';

/**
 * How a trigger looks on a performer's phone (UX_PRINCIPLES.md › Performer remote). Triggers no
 * cue waits for fire whenever they're pressed; a cue's own trigger waits for its turn, asks for
 * Ready, and says when the operator has it and when the cue went.
 */
type TriggerState = 'free' | 'idle' | 'yours' | 'sending' | 'ready' | 'fired';

function stateOf(t: RemoteTrigger, view: RemoteView, pending: string | null): TriggerState {
  if (!view.cueTriggers?.includes(t.id)) return 'free';
  if (view.waitFor === t.id) {
    if (view.ready) return 'ready';
    return pending && pending === view.standbyId ? 'sending' : 'yours';
  }
  return view.firedFor === t.id ? 'fired' : 'idle';
}

const LINE: Record<TriggerState, string> = {
  free: 'Tap to fire',
  idle: 'Not yet',
  yours: 'Your cue · tap Ready',
  sending: 'Sending…',
  ready: 'Ready ✓ · waiting for GO',
  fired: 'Done ✓',
};

/** Performer remote: big buttons for the show's named triggers. */
export default function Remote() {
  const [params] = useSearchParams();
  const code = params.get('r') ?? '';
  const key = params.get('k') ?? '';
  const relayUrl = params.get('relay') ?? '';
  const [view, setView] = useState<RemoteView | null>(null);
  const [status, setStatus] = useState<RelayStatus>('connecting');
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const relay = useRef<RelayClient<RelayToRemote, RemoteToRelay> | null>(null);

  useEffect(() => {
    document.title = 'Scrim remote';
    if (!code || !key || !relayUrl) return;
    const client = new RelayClient<RelayToRemote, RemoteToRelay>({
      relay: relayUrl,
      code,
      role: 'remote',
      key,
      client: `rm-${clientId().slice(0, 12)}`,
      fatal: [CLOSE.unauthorized, CLOSE.notFound],
    });
    relay.current = client;
    client.onStatus(setStatus);
    client.onMessage((m) => {
      if (m.t === 'remoteView') {
        setView(m.view);
        if (m.view.ready) navigator.vibrate?.([30, 40, 30]);
      }
      // A press counts once the operator has it, not when it leaves the phone.
      if (m.t === 'ack') {
        setFlash(m.triggerId);
        navigator.vibrate?.(40);
        setTimeout(() => setFlash(null), 600);
      }
      if (m.t === 'error') {
        setPending(null);
        setError(m.message);
        setTimeout(() => setError(null), 4000);
      }
    });
    // Keep the phone awake during the show.
    let lock: WakeLockSentinel | null = null;
    void navigator.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => {
      client.close();
      void lock?.release();
    };
  }, [code, key, relayUrl]);

  if (!code || !key)
    return (
      <Problem
        text="This remote link is incomplete."
        action="Scan the performer QR code in the operator view again."
      />
    );

  const live = status === 'open' && !!view?.connected;
  const press = (t: RemoteTrigger, s: TriggerState) => {
    if (!live || !view) return;
    if (s === 'free') relay.current?.send({ t: 'trigger', triggerId: t.id });
    if (s === 'yours' && view.standbyId) {
      setPending(view.standbyId);
      relay.current?.send({ t: 'ready', cueId: view.standbyId });
    }
    navigator.vibrate?.(15);
  };
  const outdated = relay.current?.lastClose?.code === CLOSE.unauthorized;

  return (
    <div
      className="flex min-h-full flex-col gap-3 p-3 pb-[max(12px,env(safe-area-inset-bottom))]"
      data-density="stage"
    >
      <header className="flex items-center justify-between gap-3 text-ui">
        <span className="truncate font-semibold">{view?.showName || 'Scrim remote'}</span>
        <Lamp tone={live ? 'go' : status === 'failed' ? 'fault' : 'standby'}>
          {status === 'failed'
            ? outdated
              ? 'Link out of date'
              : 'Room closed'
            : live
              ? 'Connected'
              : status === 'open'
                ? 'Waiting for the operator'
                : 'Connecting…'}
        </Lamp>
      </header>
      {view?.standby && (
        <div className="label-caps text-fg-subtle">
          Next cue · <span className="text-fg-muted">{view.standby}</span>
        </div>
      )}
      {status === 'failed' && (
        <Problem
          inline
          text={outdated ? 'This remote link is out of date.' : 'The show’s room is closed.'}
          action={
            outdated
              ? 'Scan the performer QR code in the operator view again.'
              : 'Ask the operator to open the room, then try again.'
          }
        />
      )}
      {view?.canGo && (
        <RemoteGo
          live={live}
          held={!!view.held}
          holdMs={view.goHoldMs ?? 0}
          send={(command) => relay.current?.send({ t: 'command', command })}
        />
      )}
      {error && (
        <div
          role="alert"
          className="rounded-control border border-line-strong bg-panel px-3 py-2 text-ui"
        >
          {error}
        </div>
      )}
      <div
        className="grid flex-1 auto-rows-fr gap-3"
        style={{
          gridTemplateColumns: `repeat(${(view?.triggers.length ?? 0) > 3 ? 2 : 1}, minmax(0,1fr))`,
        }}
      >
        {view?.triggers.map((t) => {
          const s = stateOf(t, view, pending);
          const enabled = live && (s === 'free' || s === 'yours');
          return (
            <button
              key={t.id}
              disabled={!enabled}
              aria-label={`${t.name}: ${LINE[s]}`}
              onPointerDown={(e) => {
                e.preventDefault();
                press(t, s);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  press(t, s);
                }
              }}
              className={cn(
                'relative flex min-h-24 touch-manipulation flex-col justify-center gap-1 overflow-hidden rounded-control border bg-control pr-4 pl-6 text-left select-none active:bg-control-active',
                s === 'yours' ? 'border-2 border-standby' : 'border-line-control',
                s === 'ready' && 'border-lamp-go bg-lamp-go text-on-lamp active:bg-lamp-go',
                (s === 'idle' || !live) && 'opacity-50',
                flash === t.id && 'bg-control-active',
              )}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-2"
                style={{ background: t.color }}
              />
              <span className="text-heading font-semibold">{t.name}</span>
              <span
                className={cn(
                  'label-caps',
                  s === 'yours' ? 'text-standby' : s === 'ready' ? 'text-on-lamp' : 'text-fg-muted',
                  s === 'fired' && 'text-go',
                )}
              >
                {flash === t.id ? 'Sent ✓' : LINE[s]}
              </span>
            </button>
          );
        })}
        {view && view.triggers.length === 0 && (
          <p className="text-center text-ui text-fg-subtle">
            This show has no performer buttons yet.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Remote GO, for a leader facing the room with a tablet while another machine runs the show.
 * GO honours the show's hold time here on the tablet, then goes over the network.
 */
function RemoteGo({
  live,
  held,
  holdMs,
  send,
}: {
  live: boolean;
  held: boolean;
  holdMs: number;
  send: (command: 'go' | 'hold' | 'back') => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const go = () => {
    send('go');
    navigator.vibrate?.(40);
  };
  const down = () => {
    if (!live) return;
    if (!holdMs) return go();
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      go();
    }, holdMs);
  };
  const up = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  return (
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Run the show">
      <button
        disabled={!live}
        aria-label={holdMs ? `GO: hold for ${holdMs / 1000} s` : 'GO'}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          down();
        }}
        onPointerUp={up}
        onPointerCancel={up}
        className={cn(
          'col-span-2 flex h-40 touch-manipulation flex-col items-center justify-center rounded-control border-2 border-go bg-lamp-go-tint text-go select-none disabled:opacity-50',
          holding && 'bg-lamp-go text-on-lamp',
        )}
      >
        <span className="text-display font-mono font-semibold">GO</span>
        {holdMs > 0 && <span className="label-caps">Hold {holdMs / 1000} s</span>}
      </button>
      <button
        disabled={!live}
        onClick={() => send('hold')}
        className="h-14 rounded-control border border-line-control bg-control text-heading font-semibold disabled:opacity-50"
      >
        {held ? 'Resume' : 'Hold'}
      </button>
      <button
        disabled={!live}
        onClick={() => send('back')}
        className="h-14 rounded-control border border-line-control bg-control text-heading font-semibold disabled:opacity-50"
      >
        Back
      </button>
    </div>
  );
}

/** Say what went wrong and what to do about it, with a way to try again. */
function Problem({ text, action, inline }: { text: string; action: string; inline?: boolean }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-3 rounded-control border border-line-strong bg-panel p-4 text-ui',
        !inline && 'm-6',
      )}
    >
      <p className="font-semibold text-fg">{text}</p>
      <p className="text-fg-muted">{action}</p>
      <button
        className="h-control w-fit rounded-control border border-line-control bg-control px-3 font-medium"
        onClick={() => location.reload()}
      >
        Try again
      </button>
    </div>
  );
}
