import {
  CLOSE,
  ROOM_ALPHABET,
  ROOM_CODE_LENGTH,
  type AccessView,
  type AudienceToRelay,
  type PublicMoment,
  type RelayToAudience,
} from '@scrim/protocol';
import { Accessibility, Check } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { clientId, defaultRelayUrl } from '../lib/config.js';
import { cn } from '../lib/cn.js';
import { SpikeMark } from '../ui/BrandMark.js';
import { RelayClient, type RelayStatus } from '../transport/relay.js';
import { readPrefs, showLang, speak, tr, uiLang, writePrefs, type AccessPrefs } from './access.js';
import { EN, isRtl, loadStrings, StringsContext, useStrings, type Strings } from './strings.js';

// The access choices load only when someone opens them.
const AccessSheet = lazy(() => import('./AccessSheet.js'));

type Send = (msg: AudienceToRelay) => boolean;

/**
 * The page audience phones open from the QR code. Anonymous; nothing to install. With the
 * shared key (`s`) it is a tablet passed around: each answer carries a ballot number and counts
 * as one more person, and after each answer it says to pass it on.
 */
export function Audience() {
  const params = new URLSearchParams(location.search);
  const [prefs, setPrefsState] = useState<AccessPrefs>(readPrefs);
  const setPrefs = (p: AccessPrefs) => {
    setPrefsState(p);
    writePrefs(p);
  };
  const [access, setAccess] = useState<AccessView | null>(null);
  const [sheet, setSheet] = useState(false);
  const lang = showLang(prefs, access);
  const [s, setStrings] = useState<Strings>(EN);
  const [code, setCode] = useState(() => (params.get('r') ?? '').toUpperCase());
  const relayUrl = params.get('relay') || defaultRelayUrl();
  const sharedKey = params.get('s');
  const [ballot, setBallot] = useStored<number>('scrim.ballot', 1);
  const [passOn, setPassOn] = useState(false);
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
      ...(sharedKey ? { key: sharedKey } : {}),
      fatal: [CLOSE.notFound, CLOSE.full],
    });
    relay.current = client;
    client.onStatus((s) => {
      setStatus(s);
      if (s === 'failed') setCloseCode(client.lastClose?.code ?? null);
    });
    client.onMessage((m) => {
      if (m.t === 'welcome') setTitle(m.title);
      if (m.t === 'access') setAccess(m.view);
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
        if (!ids.length) setPassOn(false);
        setMoments(m.moments);
        if (m.moments.length) navigator.vibrate?.(60);
      }
    });
    return () => client.close();
  }, [code, relayUrl, sharedKey]);

  useEffect(() => {
    document.title = title ? `${title} · ${s.joinButton}` : s.join;
  }, [title, s]);

  // The page's own words follow the show's language when there's a pack for it.
  useEffect(() => {
    const ui = uiLang(lang);
    document.documentElement.lang = ui;
    document.documentElement.dir = isRtl(ui) ? 'rtl' : 'ltr';
    let live = true;
    void loadStrings(ui).then((loaded) => live && setStrings(loaded));
    return () => void (live = false);
  }, [lang]);

  // Text size; a shared tablet reads in large print at least.
  useEffect(() => {
    const size = Math.max(prefs.size, sharedKey ? 1.25 : 1);
    document.documentElement.style.setProperty('--ui-scale', String(size));
  }, [prefs.size, sharedKey]);

  // Each new description is read aloud once, on phones that asked for it; not one from before
  // the phone joined.
  const described = useRef<number | null>(null);
  const description = access?.description;
  useEffect(() => {
    if (!description) return;
    const first = described.current === null;
    if (description.seq === described.current) return;
    described.current = description.seq;
    if (!first && prefs.describe) speak(tr(description, lang), lang);
  }, [description, prefs.describe, lang]);

  const buzzed = useRef<number | null>(null);
  const buzz = access?.buzz ?? 0;
  useEffect(() => {
    if (buzzed.current !== null && buzz > buzzed.current && prefs.buzz) navigator.vibrate?.(200);
    buzzed.current = buzz;
  }, [buzz, prefs.buzz]);

  // Speech stops when the screen sleeps, so keep it awake while description is on.
  useEffect(() => {
    if (!prefs.describe) return;
    let lock: WakeLockSentinel | null = null;
    void navigator.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => void lock?.release();
  }, [prefs.describe]);

  if (code.length !== ROOM_CODE_LENGTH)
    return (
      <StringsContext.Provider value={s}>
        <CodeEntry onCode={setCode} />
      </StringsContext.Provider>
    );

  const send: Send = (msg) => {
    if (!sharedKey || msg.t === 'tap' || msg.t === 'ping') return relay.current?.send(msg) ?? false;
    return relay.current?.send({ ...msg, ballot }) ?? false;
  };
  // A shared tablet thanks each person once they've answered (sliders say when they're done).
  const answered = () => sharedKey && setPassOn(true);
  const nextPerson = () => {
    for (const m of moments)
      for (const kind of ['vote', 'slider', 'text']) forget(`${kind}:${m.id}`);
    setBallot(ballot + 1);
    setPassOn(false);
  };
  const offset = () => relay.current?.offset ?? 0;

  const caption = prefs.captions ? tr(access?.caption, lang) : '';
  const warning = prefs.warnings ? tr(access?.warning, lang) : '';

  return (
    <StringsContext.Provider value={s}>
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <header className="mb-6 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-ui font-semibold text-fg-muted">
            <SpikeMark className="size-4 shrink-0 text-accent" />
            <span className="truncate">{title || 'Scrim'}</span>
          </span>
          <span
            className={cn(
              'ms-auto flex items-center gap-1.5 text-caption',
              status === 'open' ? 'text-fg-subtle' : 'text-warn',
            )}
          >
            <span
              className={cn('size-2 rounded-full', status === 'open' ? 'bg-fg-muted' : 'bg-warn')}
            />
            {status === 'open' ? s.joined : status === 'failed' ? s.closed : s.connecting}
          </span>
          <button
            className="-me-2 flex size-11 items-center justify-center rounded-control text-fg-muted"
            aria-label={s.access}
            aria-haspopup="dialog"
            onClick={() => setSheet(true)}
          >
            <Accessibility size={22} aria-hidden />
          </button>
        </header>
        {warning && (
          <div role="note" className="mb-5 rounded-control border border-warn px-4 py-3">
            <div className="label-caps text-warn">{s.comingUp}</div>
            <p className="mt-1 text-lg">{warning}</p>
            <p className="mt-1 text-ui text-fg-subtle">{s.stepOut}</p>
          </div>
        )}
        {status === 'failed' ? (
          <Center>
            <p className="text-lg">{closeCode === CLOSE.full ? s.roomFull : s.roomNotOpen}</p>
            <p className="mt-2 text-ui text-fg-subtle">{s.checkCode}</p>
            <button className="mt-6 text-ui text-accent-text underline" onClick={() => setCode('')}>
              {s.otherCode}
            </button>
          </Center>
        ) : moments.length === 0 ? (
          <Center>
            {thanks ? (
              <span className="aud-pop mb-5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg">
                <Check size={28} strokeWidth={2.5} aria-hidden />
              </span>
            ) : (
              <SpikeMark className="mb-5 size-14 text-accent" />
            )}
            <p className="font-display text-2xl font-semibold">{thanks ? s.thanks : s.watch}</p>
            <p className="mt-2 text-ui text-fg-subtle">{thanks ? s.onItsWay : s.keepOpen}</p>
          </Center>
        ) : passOn ? (
          <PassOn onNext={nextPerson} onBack={() => setPassOn(false)} />
        ) : (
          <div className="flex flex-col gap-8">
            {moments.map((m) => (
              // A new person gets fresh answers: the ballot keys each moment's view.
              <MomentView
                key={`${m.id}:${ballot}`}
                moment={translated(m, lang)}
                send={send}
                offset={offset}
                shared={!!sharedKey}
                onAnswered={answered}
              />
            ))}
          </div>
        )}
        {caption && (
          // Captions sit at the bottom, above everything, and are read out as they change.
          <div
            className="sticky bottom-0 mt-auto -mx-5 border-t border-line-control bg-app px-5 py-4 text-xl leading-snug font-semibold"
            aria-live="polite"
            data-testid="caption"
          >
            {caption}
          </div>
        )}
        {sheet && (
          <Suspense fallback={null}>
            <AccessSheet
              prefs={prefs}
              lang={lang}
              view={access}
              onChange={setPrefs}
              onClose={() => setSheet(false)}
            />
          </Suspense>
        )}
      </div>
    </StringsContext.Provider>
  );
}

/** A moment's prompt and options in the chosen language, where the show has them. */
function translated(m: PublicMoment, lang: string): PublicMoment {
  const t = m.i18n?.[lang];
  if (!t) return m;
  return {
    ...m,
    prompt: t.prompt?.trim() || m.prompt,
    options: m.options.map((o) => ({ ...o, label: t.options?.[o.id]?.trim() || o.label })),
  };
}

/** Between people on a shared tablet: thanks, then the next person, on a tap or after 5 s. */
function PassOn({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const s = useStrings();
  const next = useRef(onNext);
  next.current = onNext;
  useEffect(() => {
    const id = setTimeout(() => next.current(), 5000);
    return () => clearTimeout(id);
  }, []);
  return (
    <Center>
      <span className="aud-pop mb-5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg">
        <Check size={28} strokeWidth={2.5} aria-hidden />
      </span>
      <p className="font-display text-2xl font-semibold" role="status">
        {s.passOn}
      </p>
      <button
        className="mt-8 w-64 rounded-control bg-accent py-5 text-xl font-semibold text-accent-fg"
        onClick={onNext}
      >
        {s.nextPerson}
      </button>
      <button className="mt-4 text-ui text-fg-muted underline" onClick={onBack}>
        {s.changeAnswer}
      </button>
    </Center>
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
  const s = useStrings();
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
      <SpikeMark className="size-12 text-accent" />
      <h1 className="font-display text-2xl font-semibold">{s.join}</h1>
      <p className="-mt-2 text-ui text-fg-muted">{s.joinHint}</p>
      <input
        autoFocus
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        aria-label={s.roomCode}
        placeholder="CODE"
        value={clean}
        onChange={(e) => setValue(e.target.value)}
        className="w-48 rounded-control border border-line-control bg-panel py-3 text-center font-mono text-3xl tracking-[0.3em] uppercase"
      />
      <button
        type="submit"
        disabled={clean.length !== ROOM_CODE_LENGTH}
        // Disabled reads as "not yet", never as an error.
        className="w-48 rounded-control border border-transparent bg-accent py-3 font-semibold text-accent-fg disabled:border-line-control disabled:bg-control disabled:text-fg-subtle"
      >
        {s.joinButton}
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
    <span className={cn('font-mono text-ui', left <= 5 ? 'text-warn' : 'text-fg-muted')}>
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
  shared,
  onAnswered,
}: {
  moment: PublicMoment;
  send: Send;
  offset: () => number;
  shared: boolean;
  onAnswered: () => void;
}) {
  const s = useStrings();
  return (
    <section className="aud-enter flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-2xl leading-tight font-semibold">{m.prompt}</h2>
        <Countdown closesAt={m.closesAt} offset={offset} />
      </div>
      {m.type === 'vote' && <Vote moment={m} send={send} onAnswered={onAnswered} />}
      {m.type === 'tap' && <Tap moment={m} send={send} />}
      {m.type === 'slider' && (
        <Slider moment={m} send={send} onDone={shared ? onAnswered : undefined} />
      )}
      {m.type === 'text' && <TextEntry moment={m} send={send} onAnswered={onAnswered} />}
      {m.type === 'prop' && m.prop && (
        <div className="rounded-control border border-line-control bg-control p-6">
          <div className="label-caps text-fg-subtle">{m.prop.label}</div>
          <p className="mt-2 text-xl whitespace-pre-wrap">{m.prop.content}</p>
          <p className="mt-4 text-caption text-fg-subtle">{s.onlyYours}</p>
        </div>
      )}
    </section>
  );
}

function Vote({
  moment: m,
  send,
  onAnswered,
}: {
  moment: PublicMoment;
  send: Send;
  onAnswered: () => void;
}) {
  const s = useStrings();
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
              onAnswered();
            }
          }}
          aria-pressed={choice === o.id}
          className={cn(
            'flex items-center justify-between gap-3 rounded-control border-2 px-5 py-5 text-left text-xl font-semibold',
            choice === o.id
              ? 'border-accent bg-accent text-accent-fg'
              : 'border-line-control bg-control active:bg-control-active',
          )}
        >
          {o.label}
          {/* Same box either way, so the label never shifts when the check appears. */}
          <span className="flex size-6 shrink-0 items-center justify-center">
            {choice === o.id && (
              <Check size={24} strokeWidth={2.5} className="aud-pop" aria-hidden />
            )}
          </span>
        </button>
      ))}
      {choice && <p className="text-center text-ui text-fg-subtle">{s.voteCounted}</p>}
    </div>
  );
}

function Tap({ moment: m, send }: { moment: PublicMoment; send: Send }) {
  const s = useStrings();
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
        {s.tap}
      </button>
      <div className="font-mono text-3xl">{count}</div>
      {!shake && 'DeviceMotionEvent' in window && (
        <button
          className="text-ui text-fg-muted underline"
          onClick={async () => {
            const req = (
              DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
            ).requestPermission;
            if (req && (await req().catch(() => 'denied')) !== 'granted') return;
            setShake(true);
          }}
        >
          {s.shake}
        </button>
      )}
    </div>
  );
}

function Slider({
  moment: m,
  send,
  onDone,
}: {
  moment: PublicMoment;
  send: Send;
  /** A shared tablet: the person says when they're done, since a slider can keep moving. */
  onDone?: (() => void) | undefined;
}) {
  const s = useStrings();
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
      <div className="flex justify-between text-caption text-fg-subtle">
        <span>{m.min}</span>
        <span>{sent ? s.sent : ' '}</span>
        <span>{m.max}</span>
      </div>
      {onDone && sent && (
        <button
          className="mt-2 rounded-control bg-accent py-4 text-lg font-semibold text-accent-fg"
          onClick={onDone}
        >
          {s.done}
        </button>
      )}
    </div>
  );
}

function TextEntry({
  moment: m,
  send,
  onAnswered,
}: {
  moment: PublicMoment;
  send: Send;
  onAnswered: () => void;
}) {
  const s = useStrings();
  const [text, setText] = useState('');
  const [sent, setSent] = useStored<number>(`text:${m.id}`, 0);
  if (sent >= 3) return <p className="text-fg-muted">{s.maxSent}</p>;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (t && send({ t: 'text', momentId: m.id, text: t })) {
          setSent(sent + 1);
          setText('');
          onAnswered();
        }
      }}
    >
      <input
        value={text}
        maxLength={280}
        onChange={(e) => setText(e.target.value)}
        placeholder={s.typeHere}
        className="rounded-control border border-line-control bg-panel px-4 py-3 text-lg"
        aria-label={m.prompt}
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="rounded-control bg-accent py-3 font-semibold text-accent-fg disabled:opacity-40"
      >
        {s.send}
      </button>
      {sent > 0 && <p className="text-center text-ui text-fg-subtle">{s.sentPicked}</p>}
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
