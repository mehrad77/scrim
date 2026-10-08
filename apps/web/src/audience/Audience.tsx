import {
  CLOSE,
  ROOM_ALPHABET,
  ROOM_CODE_LENGTH,
  type AudienceToRelay,
  type PublicMoment,
  type RelayToAudience,
} from '@scrim/protocol';
import { useEffect, useRef, useState } from 'react';
import { clientId, defaultRelayUrl } from '../lib/config.js';
import { cn } from '../lib/cn.js';
import { RelayClient, type RelayStatus } from '../transport/relay.js';

type Send = (msg: AudienceToRelay) => boolean;

/** The page audience phones open from the QR code. Anonymous; nothing to install. */
export function Audience() {
  const params = new URLSearchParams(location.search);
  const [code, setCode] = useState(() => (params.get('r') ?? '').toUpperCase());
  const relayUrl = params.get('relay') || defaultRelayUrl();
  const [title, setTitle] = useState('');
  const [moments, setMoments] = useState<PublicMoment[]>([]);
  const [status, setStatus] = useState<RelayStatus>('connecting');
  const [closeCode, setCloseCode] = useState<number | null>(null);
  const [thanks, setThanks] = useState(false);
  const relay = useRef<RelayClient<RelayToAudience, AudienceToRelay> | null>(null);
  const prev = useRef<string[]>([]);

  useEffect(() => {
    if (code.length !== ROOM_CODE_LENGTH) return;
    const client = new RelayClient<RelayToAudience, AudienceToRelay>({
      relay: relayUrl,
      code,
      role: 'audience',
      client: clientId('scrim.audienceId'),
      fatal: [CLOSE.notFound, CLOSE.full],
    });
    relay.current = client;
    client.onStatus((s) => {
      setStatus(s);
      if (s === 'failed') setCloseCode(client.lastClose?.code ?? null);
    });
    client.onMessage((m) => {
      if (m.t === 'welcome') setTitle(m.title);
      if (m.t === 'view') {
        setTitle(m.title);
        const ids = m.moments.map((x) => x.id);
        if (prev.current.some((id) => !ids.includes(id)) && !ids.length) {
          setThanks(true);
          setTimeout(() => setThanks(false), 5000);
        }
        // A closed moment may be opened again later: forget this phone's old answer.
        for (const gone of prev.current.filter((id) => !ids.includes(id))) {
          for (const kind of ['vote', 'slider', 'text']) forget(`${kind}:${gone}`);
        }
        prev.current = ids;
        setMoments(m.moments);
        if (m.moments.length) navigator.vibrate?.(60);
      }
    });
    return () => client.close();
  }, [code, relayUrl]);

  useEffect(() => {
    document.title = title ? `${title} · join` : 'Join the show';
  }, [title]);

  if (code.length !== ROOM_CODE_LENGTH) return <CodeEntry onCode={setCode} />;

  const send: Send = (msg) => relay.current?.send(msg) ?? false;
  const offset = () => relay.current?.offset ?? 0;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]">
      <header className="mb-6 flex items-center justify-between">
        <span className="text-sm font-semibold text-fg-muted">{title || 'Scrim'}</span>
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs',
            status === 'open' ? 'text-fg-subtle' : 'text-warn',
          )}
        >
          <span
            className={cn('size-2 rounded-full', status === 'open' ? 'bg-fg-muted' : 'bg-warn')}
          />
          {status === 'open' ? 'Joined' : status === 'failed' ? 'Closed' : 'Connecting…'}
        </span>
      </header>
      {status === 'failed' ? (
        <Center>
          <p className="text-lg">
            {closeCode === CLOSE.full ? 'This room is full.' : 'This room is not open.'}
          </p>
          <p className="mt-2 text-sm text-fg-subtle">
            Check the code with the front of house team.
          </p>
          <button className="mt-6 text-sm text-accent-text underline" onClick={() => setCode('')}>
            Enter another code
          </button>
        </Center>
      ) : moments.length === 0 ? (
        <Center>
          <div className="mb-4 text-5xl">{thanks ? '✨' : '🎭'}</div>
          <p className="text-xl font-semibold">{thanks ? 'Thank you!' : 'Watch the stage'}</p>
          <p className="mt-2 text-sm text-fg-subtle">
            {thanks
              ? 'Your answer is on its way to the stage.'
              : 'Keep this page open. When it is your turn, it will light up here.'}
          </p>
        </Center>
      ) : (
        <div className="flex flex-col gap-8">
          {moments.map((m) => (
            <MomentView key={m.id} moment={m} send={send} offset={offset} />
          ))}
        </div>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
      {children}
    </div>
  );
}

function CodeEntry({ onCode }: { onCode: (c: string) => void }) {
  const [value, setValue] = useState('');
  const clean = value
    .toUpperCase()
    .replace(new RegExp(`[^${ROOM_ALPHABET}]`, 'g'), '')
    .slice(0, ROOM_CODE_LENGTH);
  return (
    <form
      className="mx-auto flex min-h-full max-w-sm flex-col items-center justify-center gap-4 p-6 text-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length === ROOM_CODE_LENGTH) onCode(clean);
      }}
    >
      <div className="text-4xl">🎭</div>
      <h1 className="text-xl font-semibold">Join the show</h1>
      <input
        autoFocus
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        aria-label="Room code"
        placeholder="CODE"
        value={clean}
        onChange={(e) => setValue(e.target.value)}
        className="w-48 rounded-xl border border-line-control bg-panel py-3 text-center font-mono text-3xl tracking-[0.3em] uppercase"
      />
      <button
        type="submit"
        disabled={clean.length !== ROOM_CODE_LENGTH}
        className="w-48 rounded-control bg-accent py-3 font-semibold text-accent-fg disabled:opacity-40"
      >
        Join
      </button>
    </form>
  );
}

function Countdown({ closesAt, offset }: { closesAt: number | null; offset: () => number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (closesAt === null) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [closesAt]);
  if (closesAt === null) return null;
  const left = Math.max(0, Math.ceil((closesAt - (Date.now() + offset())) / 1000));
  return (
    <span className={cn('font-mono text-sm', left <= 5 ? 'text-warn' : 'text-fg-muted')}>
      {left}s
    </span>
  );
}

function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  return [
    value,
    (v: T) => {
      setValue(v);
      try {
        sessionStorage.setItem(key, JSON.stringify(v));
      } catch {
        // private mode; keep it in memory only
      }
    },
  ];
}

function MomentView({
  moment: m,
  send,
  offset,
}: {
  moment: PublicMoment;
  send: Send;
  offset: () => number;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl leading-tight font-semibold">{m.prompt}</h2>
        <Countdown closesAt={m.closesAt} offset={offset} />
      </div>
      {m.type === 'vote' && <Vote moment={m} send={send} />}
      {m.type === 'tap' && <Tap moment={m} send={send} />}
      {m.type === 'slider' && <Slider moment={m} send={send} />}
      {m.type === 'text' && <TextEntry moment={m} send={send} />}
      {m.type === 'prop' && m.prop && (
        <div className="rounded-2xl border border-line-control bg-control p-6">
          <div className="text-xs tracking-wide text-fg-subtle uppercase">{m.prop.label}</div>
          <p className="mt-2 text-xl whitespace-pre-wrap">{m.prop.content}</p>
          <p className="mt-4 text-xs text-fg-subtle">Only your phone shows this.</p>
        </div>
      )}
    </section>
  );
}

function Vote({ moment: m, send }: { moment: PublicMoment; send: Send }) {
  const [choice, setChoice] = useStored<string | null>(`vote:${m.id}`, null);
  return (
    <div className="flex flex-col gap-3">
      {m.options.map((o) => (
        <button
          key={o.id}
          onClick={() => {
            if (send({ t: 'vote', momentId: m.id, optionId: o.id })) {
              setChoice(o.id);
              navigator.vibrate?.(30);
            }
          }}
          className={cn(
            'rounded-2xl border-2 px-5 py-5 text-left text-xl font-semibold transition-colors',
            choice === o.id
              ? 'border-accent bg-accent text-accent-fg'
              : 'border-line-control bg-control active:bg-control-active',
          )}
        >
          {o.label}
        </button>
      ))}
      {choice && (
        <p className="text-center text-sm text-fg-subtle">
          Vote counted. You can change it until voting closes.
        </p>
      )}
    </div>
  );
}

function Tap({ moment: m, send }: { moment: PublicMoment; send: Send }) {
  const [count, setCount] = useState(0);
  const pending = useRef(0);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!pending.current) return;
      const n = Math.min(50, pending.current);
      if (send({ t: 'tap', momentId: m.id, count: n })) pending.current -= n;
    }, 150);
    return () => clearInterval(id);
  }, [m.id, send]);

  useEffect(() => {
    if (!shake) return;
    let last = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const g = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      const now = Date.now();
      if (g > 22 && now - last > 120) {
        last = now;
        pending.current += 1;
        setCount((c) => c + 1);
      }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [shake]);

  const tap = () => {
    pending.current += 1;
    setCount((c) => c + 1);
    navigator.vibrate?.(10);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          tap();
        }}
        className="flex size-60 touch-manipulation items-center justify-center rounded-full bg-accent text-4xl font-black text-accent-fg select-none active:scale-95"
      >
        TAP
      </button>
      <div className="font-mono text-3xl">{count}</div>
      {!shake && 'DeviceMotionEvent' in window && (
        <button
          className="text-sm text-fg-muted underline"
          onClick={async () => {
            const req = (
              DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
            ).requestPermission;
            if (req && (await req().catch(() => 'denied')) !== 'granted') return;
            setShake(true);
          }}
        >
          Or shake your phone
        </button>
      )}
    </div>
  );
}

function Slider({ moment: m, send }: { moment: PublicMoment; send: Send }) {
  const [value, setValue] = useStored<number>(`slider:${m.id}`, Math.round((m.min + m.max) / 2));
  const [sent, setSent] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = (v: number) => {
    setValue(v);
    setSent(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSent(send({ t: 'slider', momentId: m.id, value: v })), 250);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="text-center font-mono text-6xl">{value}</div>
      <input
        type="range"
        min={m.min}
        max={m.max}
        step={1}
        value={value}
        onChange={(e) => change(Number(e.target.value))}
        className="h-10 w-full accent-accent"
        aria-label={m.prompt}
      />
      <div className="flex justify-between text-xs text-fg-subtle">
        <span>{m.min}</span>
        <span>{sent ? 'Sent' : ' '}</span>
        <span>{m.max}</span>
      </div>
    </div>
  );
}

function TextEntry({ moment: m, send }: { moment: PublicMoment; send: Send }) {
  const [text, setText] = useState('');
  const [sent, setSent] = useStored<number>(`text:${m.id}`, 0);
  if (sent >= 3) return <p className="text-fg-muted">Thanks — you've sent the maximum of three.</p>;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (t && send({ t: 'text', momentId: m.id, text: t })) {
          setSent(sent + 1);
          setText('');
        }
      }}
    >
      <input
        value={text}
        maxLength={280}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type here"
        className="rounded-xl border border-line-control bg-panel px-4 py-3 text-lg"
        aria-label={m.prompt}
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="rounded-control bg-accent py-3 font-semibold text-accent-fg disabled:opacity-40"
      >
        Send
      </button>
      {sent > 0 && (
        <p className="text-center text-sm text-fg-subtle">
          Sent. The team may pick it to appear on stage.
        </p>
      )}
    </form>
  );
}

function forget(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // storage unavailable; nothing was kept
  }
}
