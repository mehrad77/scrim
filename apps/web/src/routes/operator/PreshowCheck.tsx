import { AlertTriangle, CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { testTone } from '../../host/audio.js';
import { formatBytes } from '../../lib/clock.js';
import { AUDIO_DEVICES_KEY, readLocal } from '../../lib/local.js';
import { verifyMedia } from '../../storage/media.js';
import { requestPersistence, storageInfo, type StorageInfo } from '../../storage/quota.js';
import { Button } from '../../ui/Button.js';
import { errorToast } from '../../ui/toast.js';
import { useHost } from './Operator.js';

type Status = 'ok' | 'warn' | 'fail' | 'pending' | 'manual';

interface Item {
  id: string;
  title: string;
  status: Status;
  detail?: ReactNode;
  action?: ReactNode;
  /** A person must confirm this one. */
  confirm?: boolean;
}

/**
 * One screen to go green before doors open: media, storage, outputs, sound,
 * sleep, controllers and the audience room.
 */
export function PreshowCheck({ onClose }: { onClose: () => void }) {
  const [host, snap] = useHost();
  const { show, relay } = snap;
  const dialog = useRef<HTMLDialogElement>(null);
  const [mediaProblems, setMediaProblems] = useState<string[] | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [sw, setSw] = useState<boolean | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    void (async () => {
      setStorage(await storageInfo());
      const problems: string[] = [];
      for (const m of show.media) {
        const p = await verifyMedia(m);
        if (p) problems.push(`${m.name}: ${p}`);
      }
      setMediaProblems(problems);
    })();
    setSw(!!navigator.serviceWorker?.controller);
  }, [show.media]);

  const totalMedia = show.media.reduce((n, m) => n + m.size, 0);
  const devices = readLocal<Record<string, string>>(AUDIO_DEVICES_KEY, {});
  const hasSound = show.layers.some((l) => l.kind === 'audio' || l.kind === 'video');
  const needsRoom = show.moments.length > 0;
  const needsRemotes = show.triggers.length > 0;
  const usesMidi = show.inputs.midi.length > 0;

  const items: Item[] = [
    {
      id: 'media',
      title: 'All media is on this machine and decodes',
      status: mediaProblems === null ? 'pending' : mediaProblems.length ? 'fail' : 'ok',
      detail: mediaProblems?.length ? (
        <ul className="list-disc pl-4">
          {mediaProblems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        `${show.media.length} files, ${formatBytes(totalMedia)}${storage ? ` · ${formatBytes(Math.max(0, storage.quota - storage.usage))} free` : ''}`
      ),
    },
    {
      id: 'persist',
      title: 'Storage is persistent, so the browser will not evict the show',
      status: !storage ? 'pending' : storage.persisted ? 'ok' : 'warn',
      action: storage && !storage.persisted && (
        <Button
          size="sm"
          onClick={async () => (await requestPersistence(), setStorage(await storageInfo()))}
        >
          Request
        </Button>
      ),
    },
    ...show.outputs.map<Item>((o) => {
      const links = snap.links.filter((l) => l.outputId === o.id);
      const full = links.some((l) => l.status?.fullscreen);
      const blocked = snap.audioBlocked.includes(o.id);
      return {
        id: `out-${o.id}`,
        title: `Output “${o.name}” is open and full screen`,
        status: !links.length ? 'fail' : !full || blocked ? 'warn' : 'ok',
        detail: !links.length
          ? 'Not open. Use “Go live: open all” in the outputs panel.'
          : [
              links
                .map((l) => l.status?.screen ?? (l.remote ? 'remote device' : null))
                .filter(Boolean)
                .join(', '),
              !full && 'not full screen — click the output window',
              blocked && 'click the output once to allow sound',
            ]
              .filter(Boolean)
              .join(' · '),
      };
    }),
    ...(hasSound
      ? [
          {
            id: 'audio',
            title: 'Audio devices selected and a test tone heard',
            status: 'manual' as Status,
            confirm: true,
            detail: show.audioBuses
              .map((b) => `${b.name}: ${devices[b.id] ? 'chosen device' : 'system default'}`)
              .join(' · '),
            action: (
              <div className="flex gap-1">
                {show.audioBuses.map((b) => (
                  <Button
                    key={b.id}
                    size="sm"
                    onClick={() => void testTone(devices[b.id]).catch(errorToast)}
                  >
                    Tone: {b.name}
                  </Button>
                ))}
              </div>
            ),
          },
        ]
      : []),
    {
      id: 'wake',
      title: 'Screen wake lock held',
      status: snap.wakeLock ? 'ok' : 'warn',
      detail: snap.wakeLock
        ? 'This machine will not sleep while the operator view is visible.'
        : 'Keep this tab visible; the browser releases the lock in the background.',
    },
    {
      id: 'os',
      title: 'Notifications silenced and system sleep off',
      status: 'manual',
      confirm: true,
      detail: 'Turn on Do Not Disturb / Focus, and set the display never to sleep on battery.',
    },
    ...(usesMidi || needsRemotes
      ? [
          {
            id: 'controllers',
            title: 'Remotes and MIDI devices connected and tested',
            status: 'manual' as Status,
            confirm: true,
            detail: [
              usesMidi &&
                (snap.midi === null
                  ? 'MIDI not enabled'
                  : `${snap.midi.length} MIDI device(s): ${snap.midi.join(', ') || 'none'}`),
              needsRemotes && `${relay.presence.remotes} performer remote(s) connected`,
            ]
              .filter(Boolean)
              .join(' · '),
            action: usesMidi && snap.midi === null && (
              <Button size="sm" onClick={() => void host.enableMidi()}>
                Enable MIDI
              </Button>
            ),
          },
        ]
      : []),
    ...(needsRoom
      ? [
          {
            id: 'room',
            title: 'Audience room reachable, QR code tested on a phone',
            status: (relay.status === 'open' ? 'manual' : 'fail') as Status,
            confirm: relay.status === 'open',
            detail:
              relay.status === 'open'
                ? `Room ${relay.room?.code} · ${relay.presence.audience} phone(s) joined`
                : 'The room is not open.',
            action: relay.status === 'off' && (
              <Button size="sm" onClick={() => void host.connectRelay()}>
                Open room
              </Button>
            ),
          },
        ]
      : []),
    {
      id: 'offline',
      title: 'App cached for offline use',
      status: sw === null ? 'pending' : sw ? 'ok' : 'warn',
      detail: sw
        ? 'The app reloads without a network.'
        : import.meta.env.DEV
          ? 'Development build: offline caching is off.'
          : 'Reload once while online to cache the app.',
    },
    {
      id: 'mode',
      title: 'Show mode on (editing locked)',
      status: snap.mode === 'show' ? 'ok' : 'warn',
      action: snap.mode !== 'show' && (
        <Button size="sm" variant="danger" onClick={() => host.setMode('show')}>
          Switch to Show mode
        </Button>
      ),
    },
  ];

  const effective = (i: Item): Status =>
    i.confirm ? (confirmed[i.id] ? 'ok' : 'manual') : i.status;
  const blocking = items.filter((i) => ['fail', 'manual', 'pending'].includes(effective(i))).length;
  const warnings = items.filter((i) => effective(i) === 'warn').length;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      // In the operator view Esc is PANIC only; this dialog closes with its button.
      onCancel={(e) => e.preventDefault()}
      className="m-auto max-h-[90vh] w-[min(760px,calc(100vw-32px))] rounded-overlay border border-line-strong bg-overlay p-0 text-fg shadow-overlay backdrop:bg-black/70"
    >
      <div className="flex items-center gap-3 border-b border-line-subtle p-4">
        <h2 className="text-lg font-semibold">Pre-show check</h2>
        {blocking === 0 ? (
          <span className="rounded bg-go px-2 py-0.5 text-ui font-bold text-app">
            READY{warnings ? ` · ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}
          </span>
        ) : (
          <span className="text-ui text-fg-muted">
            {blocking} item{blocking > 1 ? 's' : ''} to clear
          </span>
        )}
        <Button className="ml-auto" onClick={() => dialog.current?.close()}>
          Close
        </Button>
      </div>
      <ul className="divide-y divide-line-subtle overflow-auto">
        {items.map((i) => {
          const s = effective(i);
          return (
            <li key={i.id} className="flex items-start gap-3 px-4 py-3">
              <StatusIcon status={s} />
              <div className="min-w-0 flex-1">
                <div className="text-ui font-medium">{i.title}</div>
                {i.detail && <div className="mt-0.5 text-caption text-fg-subtle">{i.detail}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {i.action}
                {i.confirm && (
                  <label className="flex items-center gap-1.5 text-caption">
                    <input
                      type="checkbox"
                      className="size-4 accent-fg"
                      checked={!!confirmed[i.id]}
                      onChange={(e) => setConfirmed({ ...confirmed, [i.id]: e.target.checked })}
                    />
                    Done
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}

function StatusIcon({ status }: { status: Status }) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-go" />;
    case 'warn':
      return <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />;
    case 'fail':
      return <XCircle size={18} className="mt-0.5 shrink-0 text-fault" />;
    case 'pending':
      return <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-fg-subtle" />;
    case 'manual':
      return <Circle size={18} className="mt-0.5 shrink-0 text-fg-subtle" />;
  }
}
