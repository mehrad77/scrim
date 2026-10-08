import { CLOSE, type RelayToRemote, type RemoteToRelay, type RemoteView } from '@scrim/protocol';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { clientId } from '../lib/config.js';
import { cn } from '../lib/cn.js';
import { RelayClient, type RelayStatus } from '../transport/relay.js';

/** Performer remote: big buttons that fire the show's named triggers. */
export default function Remote() {
  const [params] = useSearchParams();
  const code = params.get('r') ?? '';
  const key = params.get('k') ?? '';
  const relayUrl = params.get('relay') ?? '';
  const [view, setView] = useState<RemoteView | null>(null);
  const [status, setStatus] = useState<RelayStatus>('connecting');
  const [flash, setFlash] = useState<string | null>(null);
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
      if (m.t === 'remoteView') setView(m.view);
      if (m.t === 'ack') {
        setFlash(m.triggerId);
        navigator.vibrate?.(40);
        setTimeout(() => setFlash(null), 400);
      }
      if (m.t === 'error') {
        setError(m.message);
        setTimeout(() => setError(null), 3000);
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
      <div className="p-6 text-center text-fg-muted">
        This remote link is incomplete. Scan the performer QR code from the operator view again.
      </div>
    );

  const live = status === 'open' && view?.connected;
  return (
    <div
      className="flex min-h-full flex-col gap-3 p-3 pb-[max(12px,env(safe-area-inset-bottom))]"
      data-density="stage"
    >
      <header className="flex items-center justify-between text-ui">
        <span className="font-semibold">{view?.showName || 'Scrim remote'}</span>
        <span
          className={cn(
            'flex items-center gap-1.5 text-caption',
            live ? 'text-fg-muted' : 'text-warn',
          )}
        >
          <span className={cn('size-2 rounded-full', live ? 'bg-fg-muted' : 'bg-warn')} />
          {status === 'failed'
            ? relay.current?.lastClose?.code === CLOSE.unauthorized
              ? 'Link no longer valid'
              : 'Room closed'
            : live
              ? 'Connected'
              : status === 'open'
                ? 'Waiting for the operator'
                : 'Connecting…'}
        </span>
      </header>
      {view?.standby && <div className="text-caption text-fg-subtle">Next cue: {view.standby}</div>}
      {status === 'failed' && (
        <div className="rounded-control border border-lamp-fault bg-panel px-3 py-2 text-ui text-fg">
          {relay.current?.lastClose?.code === CLOSE.unauthorized
            ? 'This remote link is out of date. Scan the performer QR code in the operator view again.'
            : 'The show’s room is closed. Ask the operator to open it.'}
        </div>
      )}
      {error && (
        <div className="rounded-control border border-lamp-fault bg-panel px-3 py-2 text-ui text-fg">
          {error}
        </div>
      )}
      <div
        className="grid flex-1 auto-rows-fr gap-3"
        style={{
          gridTemplateColumns: `repeat(${(view?.triggers.length ?? 0) > 3 ? 2 : 1}, minmax(0,1fr))`,
        }}
      >
        {view?.triggers.map((t) => (
          <button
            key={t.id}
            disabled={!live}
            onPointerDown={(e) => {
              e.preventDefault();
              relay.current?.send({ t: 'trigger', triggerId: t.id });
            }}
            className={cn(
              'min-h-24 rounded-2xl text-2xl font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-40',
              flash === t.id && 'ring-4 ring-fg',
            )}
            style={{ background: t.color }}
          >
            {t.name}
          </button>
        ))}
        {view && view.triggers.length === 0 && (
          <p className="text-center text-ui text-fg-subtle">This show has no triggers yet.</p>
        )}
      </div>
    </div>
  );
}
