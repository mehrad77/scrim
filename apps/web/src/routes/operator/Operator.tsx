import { formatValue } from '@scrim/engine';
import { cueOrder, type Show } from '@scrim/format';
import { ClipboardCheck, Lock, LockOpen, Pencil, RotateCcw } from 'lucide-react';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router';
import { isTyping, PANIC_KEY } from '../../host/inputs.js';
import { ShowHost, type HostSnapshot } from '../../host/ShowHost.js';
import { setShowModeMotion } from '../../lib/prefs.js';
import { valueLabel } from '../../lib/logic.js';
import { takeRehearsal } from '../../lib/simulate.js';
import { db, getSetting } from '../../storage/db.js';
import { getShow, listRuns } from '../../storage/shows.js';
import { Button } from '../../ui/Button.js';
import { setEscapeIsPanic } from '../../ui/escape.js';
import { HoldButton } from '../../ui/HoldButton.js';
import { useNotice } from '../../ui/notice.js';
import { Lamp } from '../../ui/Lamp.js';
import { Columns, Divider, Pane } from '../../ui/Layout.js';
import { Tabs } from '../../ui/Tabs.js';
import { HelpMode, InfoStrip } from '../../ui/Tooltip.js';
import { AudiencePanel } from './AudiencePanel.js';
import { CueStack } from './CueStack.js';
import { GoPanel } from './GoPanel.js';
import { LogPanel } from './LogPanel.js';
import { MediaPanel, StatePanel } from './LivePanels.js';
import { OutputsPanel } from './OutputsPanel.js';
import { usePins } from './pins.js';
import { PreshowCheck } from './PreshowCheck.js';
import { StatusChips } from './StatusChips.js';

const HostContext = createContext<ShowHost | null>(null);

export function useHost(): [ShowHost, HostSnapshot] {
  const host = useContext(HostContext);
  if (!host) throw new Error('No show host');
  return [host, useSyncExternalStore(host.subscribe, host.getSnapshot)];
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'busy'; show: Show }
  | { kind: 'ready'; host: ShowHost };

export default function Operator() {
  const { id = '' } = useParams();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [takeover, setTakeover] = useState(0);

  useEffect(() => {
    let host: ShowHost | null = null;
    let release: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      const show = await getShow(id);
      if (!show) return setPhase({ kind: 'missing' });
      // One operator view per show on this machine: two would fight over the outputs.
      const lock = await acquireLock(`scrim-host-${id}`, takeover > 0);
      if (cancelled) return lock?.();
      if (!lock) return setPhase({ kind: 'busy', show });
      release = lock;
      const [journal, runs] = await Promise.all([(await db()).get('journal', id), listRuns(id)]);
      if (cancelled) return release();
      const resumable = journal && journal.state.lastFired !== null;
      const lastRunAt = runs.find((r) => r.cuesFired > 0)?.startedAt ?? null;
      // "Rehearse from here" in the editor leaves a hand-off that wins over the crash journal.
      const handoff = takeRehearsal(id);
      host = handoff
        ? new ShowHost(show, {
            state: handoff.state,
            mode: 'rehearsal',
            lastRunAt,
            from: handoff.cueName,
          })
        : new ShowHost(show, {
            state: resumable ? journal.state : undefined,
            mode: journal?.mode,
            lastRunAt,
            resumed: !!resumable,
          });
      setPhase({ kind: 'ready', host });
      if (await getSetting<boolean>(`roomActive:${id}`)) void host.connectRelay();
    })();
    return () => {
      cancelled = true;
      host?.dispose();
      release?.();
    };
  }, [id, takeover]);

  if (phase.kind === 'loading')
    return <div className="p-6 text-ui text-fg-subtle">Loading show…</div>;
  if (phase.kind === 'missing') {
    return (
      <div className="p-8">
        This show isn't on this machine.{' '}
        <Link to="/" className="text-fg underline">
          Back to shows
        </Link>
      </div>
    );
  }
  if (phase.kind === 'busy') {
    return (
      <div className="mx-auto max-w-lg p-8">
        <h1 className="mb-2 text-lg font-semibold">
          “{phase.show.name}” is already running in another tab
        </h1>
        <p className="mb-4 text-ui text-fg-muted">
          Only one operator view can drive the outputs. Switch to that tab, or take over here; the
          other tab stops.
        </p>
        <HoldButton
          danger
          label="Hold to take over; the other tab stops"
          onConfirm={() => setTakeover((n) => n + 1)}
        >
          Hold to take over here
        </HoldButton>
      </div>
    );
  }
  return (
    <HostContext.Provider value={phase.host}>
      <HelpMode value="strip">
        <OperatorView />
      </HelpMode>
    </HostContext.Provider>
  );
}

/**
 * Web Locks keep a single operator per show; `steal` takes it from another
 * tab. A lock being released (a reload, a remount) gets a moment to clear.
 */
async function acquireLock(name: string, steal: boolean): Promise<(() => void) | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const release = await tryLock(name, steal);
    if (release) return release;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

function tryLock(name: string, steal: boolean): Promise<(() => void) | null> {
  if (!navigator.locks) return Promise.resolve(() => undefined);
  return new Promise((resolve) => {
    let done = false;
    void navigator.locks
      .request(name, steal ? { steal: true } : { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return;
        }
        return new Promise<void>((release) => {
          done = true;
          resolve(release);
        });
      })
      .catch(() => !done && resolve(null));
  });
}

function OperatorView() {
  const [host, snap] = useHost();
  const [side, setSide] = useState<'audience' | 'state' | 'media' | 'log'>(
    snap.show.moments.length ? 'audience' : 'state',
  );
  const [checking, setChecking] = useState(false);
  const showMode = snap.mode === 'show';

  useEffect(() => {
    document.title = `▶ ${snap.show.name} · Scrim`;
  }, [snap.show.name]);

  // Show mode uses the reduced motion profile (DESIGN_SYSTEM.md › Motion).
  useEffect(() => {
    setShowModeMotion(showMode);
    return () => setShowModeMotion(false);
  }, [showMode]);

  const [typing, setTyping] = useState(false);

  useEffect(() => {
    // Capture phase, so no menu, field or dialog can swallow PANIC or GO first.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === PANIC_KEY) {
        e.preventDefault();
        host.key(e.key);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (host.key(e.key)) e.preventDefault();
    };
    // A picked value is committed; give the keys back to GO straight away.
    const onChange = (e: Event) => {
      if ((e.target as HTMLElement | null)?.tagName === 'SELECT') (e.target as HTMLElement).blur();
    };
    const onFocus = () => setTyping(isTyping(document.activeElement));
    setEscapeIsPanic(true);
    window.addEventListener('keydown', onKey, { capture: true });
    window.addEventListener('change', onChange, { capture: true });
    window.addEventListener('focusin', onFocus);
    window.addEventListener('focusout', onFocus);
    return () => {
      setEscapeIsPanic(false);
      window.removeEventListener('keydown', onKey, { capture: true });
      window.removeEventListener('change', onChange, { capture: true });
      window.removeEventListener('focusin', onFocus);
      window.removeEventListener('focusout', onFocus);
    };
  }, [host]);

  useEffect(() => {
    // Leaving mid-show by accident is the worst case; ask first.
    const warn = (e: BeforeUnloadEvent) => {
      if (host.getSnapshot().mode === 'show') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [host]);

  return (
    <div className="flex h-full flex-col" data-density="stage">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-subtle bg-panel px-3 py-2">
        <Link to="/" data-info="All shows" aria-label="All shows">
          <img src="/favicon.svg" alt="Scrim" className="size-7" />
        </Link>
        <h1 className="max-w-72 truncate text-base font-semibold">{snap.show.name}</h1>
        {showMode ? (
          // Show is the calm, locked state; leaving it takes a deliberate one-second hold.
          <div className="flex items-center gap-2">
            <Lamp tone="off" icon={<Lock size={12} />} className="text-fg-muted">
              Show
            </Lamp>
            <HoldButton
              label="Hold for a second to leave Show mode"
              icon={<LockOpen size={13} />}
              onConfirm={() => host.setMode('rehearsal')}
            >
              Hold to unlock
            </HoldButton>
          </div>
        ) : (
          // Rehearsal is the loud state, because it is the unsafe one.
          <div className="flex items-center gap-2">
            <span className="label-caps flex h-7 items-center gap-1.5 bg-fg px-2 text-app">
              <LockOpen size={12} /> Rehearsal · editing unlocked · double-click fires
            </span>
            <Button size="sm" icon={<Lock size={13} />} onClick={() => host.setMode('show')}>
              Show mode
            </Button>
          </div>
        )}
        <StatusChips />
        <div className="ml-auto flex items-center gap-2">
          {!showMode && (
            <>
              <Button
                size="sm"
                icon={<ClipboardCheck size={14} />}
                onClick={() => setChecking(true)}
              >
                Pre-show check
              </Button>
              <HoldButton
                label="Hold to reset: every layer, timer and value goes back to the top"
                icon={<RotateCcw size={13} />}
                onConfirm={() => host.dispatch({ type: 'reset' })}
              >
                Reset
              </HoldButton>
              <Button
                size="sm"
                icon={<Pencil size={14} />}
                onClick={() => window.open(`/show/${snap.show.id}`, `scrim-edit-${snap.show.id}`)}
              >
                Edit
              </Button>
            </>
          )}
        </div>
      </header>
      <MessageStrip typing={typing} />
      <main className="min-h-0 flex-1 border-t border-line-subtle">
        <Columns id="operator" locked={showMode}>
          <Pane id="cues" size="25%" min={280}>
            <CueStack />
          </Pane>
          <Divider />
          <Pane id="go" min={420}>
            <div className="flex h-full min-h-0 flex-col gap-px bg-line-subtle">
              <GoPanel />
              <OutputsPanel />
            </div>
          </Pane>
          <Divider />
          <Pane id="side" size="28%" min={300} side>
            <div className="flex h-full min-h-0 flex-col bg-panel">
              <Tabs
                value={side}
                onChange={setSide}
                label="Live panels"
                className="border-b border-line-subtle p-1"
                tabs={[
                  { id: 'audience', label: 'Audience' },
                  { id: 'state', label: 'State' },
                  { id: 'media', label: 'Media' },
                  { id: 'log', label: 'Log' },
                ]}
              />
              <div className="min-h-0 flex-1">
                {side === 'audience' && <AudiencePanel />}
                {side === 'state' && <StatePanel />}
                {side === 'media' && <MediaPanel />}
                {side === 'log' && <LogPanel />}
              </div>
            </div>
          </Pane>
        </Columns>
      </main>
      <InfoStrip fallback="Space fires GO · Esc is PANIC, always" />
      {checking && <PreshowCheck onClose={() => setChecking(false)} />}
    </div>
  );
}

/**
 * A fixed-height strip for operator messages. It is always there, so a message appearing or
 * going away never moves GO or PANIC.
 */
function MessageStrip({ typing }: { typing: boolean }) {
  const [, snap] = useHost();
  const [resumeHidden, setResumeHidden] = useState(false);
  const resumed =
    !resumeHidden && ((!!snap.resumedAt && !!snap.state.lastFired) || !!snap.rehearsingFrom);
  const text = useNotice();
  const [pins] = usePins(snap.show.id);
  const pinned = snap.show.vars.filter((v) => pins.includes(v.id));
  return (
    <div className="flex h-11 shrink-0 items-center gap-3 overflow-hidden border-b border-line-subtle px-4 text-ui">
      {resumed && <ResumeMessage onDone={() => setResumeHidden(true)} />}
      {text && !resumed && <span className="truncate text-fg">{text}</span>}
      {pinned.length > 0 && (
        <span className="ml-auto flex shrink-0 gap-3 text-caption" aria-label="Pinned values">
          {pinned.map((v) => {
            const val = snap.state.vars[v.id];
            return (
              <span key={v.id} className="flex gap-1">
                <span className="font-mono text-fg-subtle">{v.name}</span>
                <span className="text-fg tabular-nums">
                  {typeof val === 'string' || typeof val === 'number'
                    ? valueLabel(snap.show, v.id, val) || '—'
                    : formatValue(val) || '—'}
                </span>
              </span>
            );
          })}
        </span>
      )}
      {typing && (
        <span className="ml-auto shrink-0 rounded-control border border-line-subtle px-2 py-0.5 text-caption text-fg-muted">
          Keys paused while typing · Esc still panics
        </span>
      )}
    </div>
  );
}

function ResumeMessage({ onDone }: { onDone: () => void }) {
  const [host, snap] = useHost();
  const cue = cueOrder(snap.show).find((c) => c.id === snap.state.lastFired);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 text-fg">
      <span className="truncate">
        {snap.rehearsingFrom
          ? `Rehearsing from “${snap.rehearsingFrom}”: everything before it has run, with the results you assumed.`
          : `Resumed where the show left off — last cue “${cue?.name}”. Outputs show the same picture as before the reload.`}
      </span>
      <Button size="sm" className="ml-auto" onClick={onDone}>
        OK
      </Button>
      <Button
        size="sm"
        onClick={() => {
          host.dispatch({ type: 'reset' });
          onDone();
        }}
      >
        Start from the top
      </Button>
    </div>
  );
}
