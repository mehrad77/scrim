import { cueOrder, type Show } from '@scrim/format';
import { ClipboardCheck, Lock, LockOpen, Pencil, RotateCcw } from 'lucide-react';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router';
import { isTyping, PANIC_KEY } from '../../host/inputs.js';
import { ShowHost, type HostSnapshot } from '../../host/ShowHost.js';
import { db, getSetting } from '../../storage/db.js';
import { getShow, listRuns } from '../../storage/shows.js';
import { Button } from '../../ui/Button.js';
import { confirmDialog, setEscapeIsPanic } from '../../ui/dialog.js';
import { Tabs } from '../../ui/Tabs.js';
import { AudiencePanel } from './AudiencePanel.js';
import { CueStack } from './CueStack.js';
import { GoPanel } from './GoPanel.js';
import { LogPanel } from './LogPanel.js';
import { MediaPanel, StatePanel } from './LivePanels.js';
import { OutputsPanel } from './OutputsPanel.js';
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
      host = new ShowHost(show, {
        state: resumable ? journal.state : undefined,
        mode: journal?.mode,
        lastRunAt: runs.find((r) => r.cuesFired > 0)?.startedAt ?? null,
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
    return <div className="p-6 text-sm text-ink-400">Loading show…</div>;
  if (phase.kind === 'missing') {
    return (
      <div className="p-8">
        This show isn't on this machine.{' '}
        <Link to="/" className="text-rose-400 underline">
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
        <p className="mb-4 text-sm text-ink-300">
          Only one operator view can drive the outputs. Switch to that tab, or take over here; the
          other tab stops.
        </p>
        <Button variant="danger" onClick={() => setTakeover((n) => n + 1)}>
          Take over here
        </Button>
      </div>
    );
  }
  return (
    <HostContext.Provider value={phase.host}>
      <OperatorView />
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
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-800 bg-ink-900 px-3 py-2">
        <Link to="/" title="All shows">
          <img src="/favicon.svg" alt="Scrim" className="size-7" />
        </Link>
        <h1 className="max-w-72 truncate text-base font-semibold">{snap.show.name}</h1>
        <div className="flex overflow-hidden rounded-md border border-ink-700">
          <button
            className={`flex items-center gap-1.5 px-3 py-1 text-sm ${!showMode ? 'bg-ink-700 text-ink-100' : 'text-ink-300 hover:bg-ink-800'}`}
            onClick={() => host.setMode('rehearsal')}
          >
            <LockOpen size={14} /> Rehearsal
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1 text-sm ${showMode ? 'bg-live text-white' : 'text-ink-300 hover:bg-ink-800'}`}
            onClick={() => host.setMode('show')}
          >
            <Lock size={14} /> Show
          </button>
        </div>
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
              <Button
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={async () => {
                  if (
                    await confirmDialog(
                      'Reset to the top?',
                      'Every layer, timer and state value goes back to the start of the show.',
                    )
                  )
                    host.dispatch({ type: 'reset' });
                }}
              >
                Reset
              </Button>
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
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(260px,1fr)_minmax(0,2fr)_minmax(300px,1fr)] gap-2 p-2">
        <CueStack />
        <div className="flex min-h-0 flex-col gap-2">
          <GoPanel />
          <OutputsPanel />
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <Tabs
            value={side}
            onChange={setSide}
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
      </main>
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
  const resumed = !resumeHidden && !!snap.resumedAt && !!snap.state.lastFired;
  return (
    <div className="flex h-11 shrink-0 items-center gap-3 overflow-hidden border-b border-ink-800 px-4 text-sm">
      {resumed && <ResumeMessage onDone={() => setResumeHidden(true)} />}
      {typing && (
        <span className="ml-auto rounded border border-ink-700 px-2 py-0.5 text-xs text-ink-300">
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
    <div className="flex min-w-0 flex-1 items-center gap-3 text-amber-100">
      <span className="truncate">
        Resumed where the show left off — last cue “{cue?.name}”. Outputs show the same picture as
        before the reload.
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
