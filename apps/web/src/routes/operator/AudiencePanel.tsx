import { formatValue, type MomentState } from '@scrim/engine';
import type { Moment } from '@scrim/format';
import { Check, Copy, Plus, Radio, Smartphone, Users, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { appBase, audienceUrl, remoteUrl } from '../../host/room.js';
import { epochNow } from '../../lib/clock.js';
import { isLocalHost } from '../../lib/config.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../../ui/Button.js';
import { CommitInput, Select } from '../../ui/Field.js';
import { Badge, Empty, Panel } from '../../ui/Panel.js';
import { toast } from '../../ui/toast.js';
import { useHost } from './Operator.js';

export function AudiencePanel() {
  const [host, snap] = useHost();
  const { relay, show, state, mode } = snap;
  const needsRoom = show.moments.length > 0 || show.triggers.length > 0;

  return (
    <Panel title="Audience & remotes" className="h-full" bodyClassName="p-2">
      {relay.status === 'off' ? (
        <div className="flex flex-col items-start gap-2 p-2">
          <p className="text-ui text-fg-muted">
            {needsRoom
              ? 'Open the room so audience phones and performer remotes can join. The show keeps running if the network drops.'
              : 'This show has no audience moments or triggers, so it does not need a room.'}
          </p>
          <Button
            variant="primary"
            icon={<Radio size={14} />}
            onClick={() => void host.connectRelay()}
          >
            Open audience room
          </Button>
        </div>
      ) : (
        <RoomInfo />
      )}
      <div className="mt-3 flex flex-col gap-2">
        {show.moments.map((m) => (
          <MomentCard
            key={m.id}
            moment={m}
            ms={state.moments[m.id]}
            rehearsal={mode === 'rehearsal'}
          />
        ))}
        {show.moments.length === 0 && <Empty>No audience moments in this show.</Empty>}
      </div>
    </Panel>
  );
}

function Qr({ text, size = 132 }: { text: string; size?: number }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    void QRCode.toDataURL(text, {
      margin: 1,
      width: size * 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setSrc);
  }, [text, size]);
  return src ? (
    <img src={src} alt="" width={size} height={size} className="rounded-control bg-white" />
  ) : (
    <div style={{ width: size, height: size }} />
  );
}

function RoomInfo() {
  const [host, snap] = useHost();
  const { relay } = snap;
  const [who, setWho] = useState<'audience' | 'remote'>('audience');
  const [, setBase] = useState(appBase);
  const room = relay.room;
  const local = isLocalHost(new URL(appBase()).hostname);
  if (!room) return <p className="p-2 text-ui text-fg-muted">{relay.error ?? 'Opening room…'}</p>;
  const url = who === 'audience' ? audienceUrl(room) : remoteUrl(room);
  return (
    <div className="rounded-control border border-line-subtle p-2">
      <div className="flex items-center gap-2">
        <span
          className={cn('size-2 rounded-full', relay.status === 'open' ? 'bg-fg-muted' : 'bg-warn')}
        />
        <span className="text-ui">Room</span>
        <span className="font-mono text-lg font-bold tracking-widest" data-testid="room-code">
          {room.code}
        </span>
        <span className="ml-auto flex items-center gap-2 text-caption text-fg-muted">
          <span
            className="flex items-center gap-1"
            data-info="Audience phones"
            aria-label="Audience phones"
          >
            <Users size={13} /> {relay.presence.audience}
          </span>
          <span
            className="flex items-center gap-1"
            data-info="Performer remotes"
            aria-label="Performer remotes"
          >
            <Smartphone size={13} /> {relay.presence.remotes}
          </span>
        </span>
      </div>
      {snap.mode === 'show' && (
        <p className="mt-1 text-caption text-fg-subtle">
          Room setup is hidden in Show mode. Unlock to show the QR codes again.
        </p>
      )}
      {relay.status !== 'open' && (
        <p className="mt-1 text-caption text-warn">
          {relay.error ?? 'Reconnecting… audience moments use their defaults if this lasts.'}
        </p>
      )}
      {snap.mode !== 'show' && (
        <>
          <div className="mt-2 flex gap-1">
            {(['audience', 'remote'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWho(w)}
                className={cn(
                  'rounded-control px-2 py-0.5 text-caption',
                  who === w ? 'bg-control-active' : 'text-fg-subtle hover:bg-control-hover',
                )}
              >
                {w === 'audience' ? 'Audience QR' : 'Performer remote QR'}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-3">
            <Qr text={url} />
            <div className="flex min-w-0 flex-col gap-2 text-caption">
              <p className="text-fg-muted">
                {who === 'audience'
                  ? 'Project this, print it, or put it on the tickets.'
                  : 'Only for performers: it can fire triggers.'}
              </p>
              <Button
                size="sm"
                icon={<Copy size={12} />}
                onClick={() => {
                  void navigator.clipboard.writeText(url);
                  toast('Link copied', 'good');
                }}
              >
                Copy link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => host.disconnectRelay()}>
                Close room
              </Button>
            </div>
          </div>
          {local && (
            <div className="mt-2 rounded-control border border-line-control p-2 text-caption text-warn">
              Phones can't open “localhost”. Enter the address phones should use, such as this
              machine's network address:
              <CommitInput
                className="mt-1"
                placeholder="http://192.168.1.20:5173"
                value={localStorage.getItem('scrim.publicUrl') ?? ''}
                onCommit={(v) => {
                  localStorage.setItem('scrim.publicUrl', v.trim());
                  setBase(appBase());
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MomentCard({
  moment: m,
  ms,
  rehearsal,
}: {
  moment: Moment;
  ms: MomentState | undefined;
  rehearsal: boolean;
}) {
  const [host] = useHost();
  const [now, setNow] = useState(epochNow);
  const [override, setOverride] = useState('');
  const open = ms?.status === 'open';
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(epochNow()), 250);
    return () => clearInterval(id);
  }, [open]);
  if (!ms) return null;
  const left = open && ms.closesAt !== null ? Math.max(0, (ms.closesAt - now) / 1000) : null;
  const pending = ms.entries.filter((e) => e.status === 'pending');

  return (
    <div
      className={cn(
        'rounded-control border p-2',
        open ? 'border-go bg-lamp-go-tint' : 'border-line-subtle',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-ui font-medium">{m.name}</span>
        <Badge tone={open ? 'live' : ms.status === 'closed' ? 'neutral' : 'neutral'}>
          {open ? 'OPEN' : ms.status === 'closed' ? 'Closed' : 'Not opened'}
        </Badge>
        {left !== null && (
          <span className="ml-auto font-mono text-ui text-standby">{left.toFixed(0)}s</span>
        )}
      </div>
      {(open || ms.status === 'closed') && <Results moment={m} ms={ms} />}
      {ms.status === 'closed' && (
        <div className="mt-1 text-caption text-fg-muted">
          Result: <span className="font-mono text-fg">{formatValue(ms.result)}</span>
          {ms.usedDefault && (
            <Badge tone="warn" className="ml-2">
              Default — no input
            </Badge>
          )}
        </div>
      )}
      {pending.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          <div className="text-caption text-fg-subtle">Waiting for approval ({pending.length})</div>
          {pending.slice(0, 8).map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2 rounded-control bg-control px-2 py-1 text-ui"
            >
              <span className="min-w-0 flex-1 break-words">{e.text}</span>
              <button
                className="rounded-control p-1 text-go hover:bg-control-active"
                title="Approve"
                onClick={() =>
                  host.dispatch({ type: 'moderate', momentId: m.id, entryId: e.id, approve: true })
                }
              >
                <Check size={14} />
              </button>
              <button
                className="rounded-control p-1 text-fault hover:bg-control-active"
                title="Reject"
                onClick={() =>
                  host.dispatch({ type: 'moderate', momentId: m.id, entryId: e.id, approve: false })
                }
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {open ? (
          <>
            <Button
              size="sm"
              icon={<Plus size={12} />}
              onClick={() => host.dispatch({ type: 'extendMoment', momentId: m.id, seconds: 10 })}
            >
              10s
            </Button>
            <Button
              size="sm"
              onClick={() => host.dispatch({ type: 'closeMoment', momentId: m.id })}
            >
              Close now
            </Button>
            {m.type === 'vote' && (
              <div className="flex items-center gap-1">
                <Select
                  className="h-7 w-32 text-caption"
                  value={override}
                  onChange={(e) => setOverride(e.target.value)}
                >
                  <option value="">Override…</option>
                  {m.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!override}
                  onClick={() =>
                    host.dispatch({ type: 'closeMoment', momentId: m.id, result: override })
                  }
                >
                  Force
                </Button>
              </div>
            )}
          </>
        ) : (
          rehearsal && (
            <Button size="sm" onClick={() => host.dispatch({ type: 'openMoment', momentId: m.id })}>
              Open now
            </Button>
          )
        )}
      </div>
    </div>
  );
}

function Results({ moment: m, ms }: { moment: Moment; ms: MomentState }) {
  if (m.type === 'vote' || m.type === 'prop') {
    const items =
      m.type === 'vote'
        ? m.options.map((o) => ({ id: o.id, label: o.label }))
        : m.variants.map((v) => ({ id: v.id, label: v.label }));
    const total = items.reduce((n, i) => n + (ms.tally[i.id] ?? 0), 0) || 1;
    return (
      <div className="mt-2 flex flex-col gap-1">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 text-caption">
            <span className="w-24 truncate">{i.label}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-control bg-control-hover">
              {/* scaleX, not width: compositor-only motion in the operator */}
              <div
                className="h-full origin-left bg-fg-muted transition-transform duration-(--dur-base) ease-move"
                style={{ transform: `scaleX(${(ms.tally[i.id] ?? 0) / total})` }}
              />
            </div>
            <span className="w-8 text-right font-mono tabular-nums" data-testid="tally">
              {ms.tally[i.id] ?? 0}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (m.type === 'tap') return <div className="mt-1 font-mono text-2xl">{ms.count} taps</div>;
  if (m.type === 'slider')
    return (
      <div className="mt-1 text-ui">
        Average {ms.n ? (ms.sum / ms.n).toFixed(1) : '—'} from {ms.n} phone{ms.n === 1 ? '' : 's'}
      </div>
    );
  return (
    <div className="mt-1 text-caption text-fg-subtle">
      {ms.entries.filter((e) => e.status === 'approved').length} approved · {ms.entries.length}{' '}
      received
    </div>
  );
}
