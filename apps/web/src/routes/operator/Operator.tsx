import { formatVar, initialState, runOrder } from '@scrim/engine';
import { cueOrder, type Show } from '@scrim/format';
import {
  ClipboardCheck,
  Columns3,
  Keyboard,
  Lock,
  LockOpen,
  Maximize,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Link, useParams } from 'react-router';
import { isTyping, keyLabel, PANIC_KEY } from '../../host/inputs.js';
import { ShowHost, type HostSnapshot } from '../../host/ShowHost.js';
import { openShortcutSheet, useCommands } from '../../lib/commands.js';
import { readLocal, writeLocal } from '../../lib/local.js';
import { setShowModeMotion } from '../../lib/prefs.js';
import { valueLabel } from '../../lib/logic.js';
import { takeRehearsal } from '../../lib/simulate.js';
import { db, getSetting } from '../../storage/db.js';
import { getShow, listRuns } from '../../storage/shows.js';
import { Button, IconButton } from '../../ui/Button.js';
import { CommandPalette } from '../../ui/CommandPalette.js';
import { KeyHints } from '../../ui/KeyHints.js';
import { openPreferences, PreferencesHost } from '../../ui/PreferencesHost.js';
import { ShortcutSheet, type SheetRow } from '../../ui/ShortcutSheet.js';
import { setEscapeIsPanic } from '../../ui/escape.js';
import { HoldButton } from '../../ui/HoldButton.js';
import { useNotice } from '../../ui/notice.js';
import { Lamp } from '../../ui/Lamp.js';
import { Columns, Divider, Pane } from '../../ui/Layout.js';
import { Tabs } from '../../ui/Tabs.js';
import { HelpMode, InfoStrip } from '../../ui/Tooltip.js';
import { Announcer } from './Announcer.js';
import { AudiencePanel } from './AudiencePanel.js';
import { CueStack } from './CueStack.js';
import { GoPanel } from './GoPanel.js';
import { LogPanel } from './LogPanel.js';
import { MapBar, MapProvider, useMapApi, useMapMode } from './MapMode.js';
import { MediaPanel, StatePanel } from './LivePanels.js';
import { OutputsPanel } from './OutputsPanel.js';
import { usePins } from './pins.js';
import { PreshowCheck } from './PreshowCheck.js';
import { RelaxedSwitch } from './RelaxedSwitch.js';
import { SimpleOperator } from './SimpleOperator.js';
import { SetlistPanel } from './SetlistPanel.js';
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
      // Nothing ran yet, but tonight's running order was set: start at the top, in that order.
      const order = !resumable ? (journal?.state.order ?? null) : null;
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
            state: resumable
              ? journal.state
              : order
                ? { ...initialState(show), order, standby: runOrder(show, order)[0]?.id ?? null }
                : undefined,
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
  // The simple view: chosen in Rehearsal (remembered per show on this machine), the show's own
  // default, and always below the full view's 1024 px minimum.
  const narrow = useNarrow();
  const viewKey = `scrim.operatorView.${snap.show.id}`;
  const [view, setViewState] = useState<'full' | 'simple'>(
    () =>
      readLocal<'full' | 'simple' | null>(viewKey, null) ?? snap.show.operator?.layout ?? 'full',
  );
  const setView = (v: 'full' | 'simple') => {
    setViewState(v);
    writeLocal(viewKey, v);
  };
  const simple = narrow || view === 'simple';
  const map = useMapApi(host, snap.show.inputs, !showMode);
  const mapRef = useRef(map);
  mapRef.current = map;

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
        host.key(e.key, 'keyboard', e.code);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      // Map mode: the next key is the new binding, not a command.
      const m = mapRef.current;
      if (m.active && m.target && !m.conflict) {
        e.preventDefault();
        m.press({ kind: 'key', code: e.code || e.key });
        return;
      }
      if (host.key(e.key, 'keyboard', e.code)) e.preventDefault();
    };
    // A picked value is committed; give the keys back to GO straight away.
    const onChange = (e: Event) => {
      if ((e.target as HTMLElement | null)?.tagName === 'SELECT') (e.target as HTMLElement).blur();
    };
    const onFocus = () => setTyping(isTyping(document.activeElement));
    // A hold-to-confirm GO counts from press to release.
    const onKeyUp = (e: KeyboardEvent) => host.keyUp(e.key, e.code);
    const onBlur = () => host.releaseAll();
    setEscapeIsPanic(true);
    window.addEventListener('keydown', onKey, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);
    window.addEventListener('change', onChange, { capture: true });
    window.addEventListener('focusin', onFocus);
    window.addEventListener('focusout', onFocus);
    return () => {
      setEscapeIsPanic(false);
      window.removeEventListener('keydown', onKey, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('blur', onBlur);
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

  const goKey = snap.show.inputs.keys.find((k) => k.command.type === 'go')?.key;
  return (
    <MapProvider value={map}>
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
              <span className="label-caps flex h-7 items-center gap-1.5 bg-fg px-2 whitespace-nowrap text-app">
                <LockOpen size={12} /> Rehearsal
                <span className="hidden md:inline">· editing unlocked</span>
                {!simple && <span className="hidden lg:inline">· double-click fires</span>}
              </span>
              <Button size="sm" icon={<Lock size={13} />} onClick={() => host.setMode('show')}>
                Show mode
              </Button>
            </div>
          )}
          <StatusChips />
          <div className="ml-auto flex items-center gap-2">
            <RelaxedSwitch />
            {!showMode && !narrow && (
              <Button
                size="sm"
                variant="ghost"
                icon={simple ? <Columns3 size={14} /> : <Maximize size={14} />}
                onClick={() => setView(simple ? 'full' : 'simple')}
                title={
                  simple
                    ? 'Full view: cue list, outputs, audience and log'
                    : 'Simple view: one huge GO, now and next, sized for touch'
                }
              >
                {simple ? 'Full view' : 'Simple view'}
              </Button>
            )}
            {!showMode && (
              <>
                <IconButton
                  label={
                    map.active ? 'Stop mapping keys' : 'Map keys: assign keys, pedals and MIDI'
                  }
                  icon={<Keyboard size={15} />}
                  variant={map.active ? 'primary' : 'ghost'}
                  aria-pressed={map.active}
                  onClick={() => map.setActive(!map.active)}
                />
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
        <Announcer />
        {simple ? (
          <div className="flex min-h-0 flex-1 flex-col border-t border-line-subtle">
            <SimpleOperator />
          </div>
        ) : (
          <main className="min-h-0 flex-1 border-t border-line-subtle">
            <Columns id="operator" locked={showMode}>
              <Pane id="cues" size="25%" min={280}>
                <CuesPane />
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
        )}
        <InfoStrip
          fallback={`${goKey ? `${keyLabel(goKey)} fires GO · ` : ''}Esc is PANIC, always`}
        />
        {checking && <PreshowCheck onClose={() => setChecking(false)} />}
        {/* Help and the palette never open over a running show. */}
        {!showMode && (
          <>
            <OperatorCommands onCheck={() => setChecking(true)} />
            <CommandPalette />
            <ShortcutSheet first={runningKeys(snap.show)} />
            <KeyHints />
            <PreferencesHost />
          </>
        )}
      </div>
    </MapProvider>
  );
}

/** Narrower than the full operator view's 1024 px minimum (DESIGN_SYSTEM.md › Layout). */
function useNarrow(): boolean {
  const query = '(max-width: 1023px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

/**
 * The cue list, and beside it tonight's running order for shows with more than one scene: the
 * order is the cue list's own, so it lives in the same pane.
 */
function CuesPane() {
  const [, snap] = useHost();
  const [view, setView] = useState<'cues' | 'order'>('cues');
  const scenes = new Set(snap.show.cues.map((c) => c.sceneId)).size;
  if (scenes < 2) return <CueStack />;
  const toggle = (
    <Tabs
      label="Cue list or running order"
      value={view}
      onChange={setView}
      tabs={[
        { id: 'cues', label: 'Cues' },
        { id: 'order', label: 'Order' },
      ]}
    />
  );
  return view === 'order' ? <SetlistPanel toggle={toggle} /> : <CueStack toggle={toggle} />;
}

/** The show's running keys, for the top of the `?` sheet. */
function runningKeys(show: Show): { group: string; rows: SheetRow[] } {
  const keys = (type: string) =>
    show.inputs.keys.filter((k) => k.command.type === type).map((k) => keyLabel(k.key));
  return {
    group: 'Running the show',
    rows: [
      { title: 'GO', keys: keys('go') },
      { title: 'Hold / resume', keys: keys('hold') },
      {
        title: 'PANIC: everything to black',
        keys: ['Esc', ...keys('panic').filter((k) => k !== 'Esc')],
      },
      { title: 'Back: undo the last GO', keys: keys('back') },
      { title: 'Next cue on standby', keys: keys('standbyNext') },
      { title: 'Previous cue on standby', keys: keys('standbyPrev') },
      { title: 'Clear text (again: bring it back)', keys: keys('clearText') },
      { title: 'Clear media (again: bring it back)', keys: keys('clearMedia') },
      { title: 'Mute / unmute sound', keys: keys('mute') },
      ...show.triggers.map((t) => ({
        title: `Trigger: ${t.name}`,
        keys: show.inputs.keys
          .filter((k) => k.command.type === 'trigger' && k.command.triggerId === t.id)
          .map((k) => keyLabel(k.key)),
      })),
    ],
  };
}

/** What Rehearsal offers the palette and the `?` sheet. */
function OperatorCommands({ onCheck }: { onCheck: () => void }) {
  const [host, snap] = useHost();
  const map = useMapMode();
  useCommands(
    [
      { id: 'go', group: 'Run', title: 'GO', run: () => host.command({ type: 'go' }, 'operator') },
      {
        id: 'hold',
        group: 'Run',
        title: 'Hold / resume',
        run: () => host.dispatch({ type: 'hold' }),
      },
      {
        id: 'back',
        group: 'Run',
        title: 'Back: undo the last GO',
        disabled: !snap.state.back,
        run: () => host.command({ type: 'back' }, 'operator'),
      },
      {
        id: 'clear-text',
        group: 'Run',
        title: snap.state.cleared?.text ? 'Bring cleared text back' : 'Clear text from the stage',
        aliases: ['caption', 'subtitle', 'panic'],
        run: () => host.command({ type: 'clearText' }, 'operator'),
      },
      {
        id: 'clear-media',
        group: 'Run',
        title: snap.state.cleared?.media
          ? 'Bring cleared pictures and video back'
          : 'Clear pictures and video from the stage',
        aliases: ['image', 'video', 'panic'],
        run: () => host.command({ type: 'clearMedia' }, 'operator'),
      },
      {
        id: 'mute',
        group: 'Run',
        title: snap.state.mute?.to === 1 ? 'Unmute sound' : 'Mute sound',
        aliases: ['audio', 'silence', 'panic'],
        run: () => host.command({ type: 'mute' }, 'operator'),
      },
      {
        id: 'show-mode',
        group: 'Run',
        title: 'Show mode: lock for the performance',
        aliases: ['lock'],
        run: () => host.setMode('show'),
      },
      { id: 'check', group: 'Run', title: 'Pre-show check', aliases: ['checklist'], run: onCheck },
      {
        id: 'map',
        group: 'Controls',
        title: map?.active ? 'Stop mapping keys' : 'Map keys',
        aliases: ['shortcut', 'midi', 'pedal', 'controller'],
        run: () => map?.setActive(!map.active),
      },
      {
        id: 'edit',
        group: 'Show',
        title: 'Edit show',
        run: () => window.open(`/show/${snap.show.id}`, `scrim-edit-${snap.show.id}`),
      },
      {
        id: 'shortcuts',
        group: 'Help',
        title: 'Keyboard shortcuts',
        shortcut: '?',
        run: openShortcutSheet,
      },
      {
        id: 'prefs',
        group: 'Help',
        title: 'Preferences',
        aliases: ['settings', 'theme', 'accent'],
        shortcut: '⌘,',
        run: openPreferences,
      },
    ],
    [host, snap.state.back, snap.state.cleared, snap.state.mute, snap.show.id, map?.active],
  );
  return null;
}

/**
 * A fixed-height strip for operator messages. It is always there, so a message appearing or
 * going away never moves GO or PANIC.
 */
function MessageStrip({ typing }: { typing: boolean }) {
  const [, snap] = useHost();
  const map = useMapMode();
  const [resumeHidden, setResumeHidden] = useState(false);
  const resumed =
    !resumeHidden && ((!!snap.resumedAt && !!snap.state.lastFired) || !!snap.rehearsingFrom);
  const text = useNotice();
  const [pins] = usePins(snap.show.id);
  const pinned = snap.show.vars.filter((v) => pins.includes(v.id));
  return (
    <div className="flex h-11 shrink-0 items-center gap-3 overflow-hidden border-b border-line-subtle px-4 text-ui">
      {map?.active ? (
        <MapBar />
      ) : (
        <>
          {resumed && <ResumeMessage onDone={() => setResumeHidden(true)} />}
          {text && !resumed && <span className="truncate text-fg">{text}</span>}
        </>
      )}
      {pinned.length > 0 && !map?.active && (
        <span className="ml-auto flex shrink-0 gap-3 text-caption" aria-label="Pinned values">
          {pinned.map((v) => {
            const val = snap.state.vars[v.id];
            return (
              <span key={v.id} className="flex gap-1">
                <span className="font-mono text-fg-subtle">{v.name}</span>
                <span className="text-fg tabular-nums">
                  {typeof val === 'string' || typeof val === 'number'
                    ? valueLabel(snap.show, v.id, val) || '—'
                    : formatVar(snap.show, v.id, val) || '—'}
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
