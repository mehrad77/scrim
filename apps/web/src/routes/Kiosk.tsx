import type { Show } from '@scrim/format';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { openAllOutputs } from '../host/goLive.js';
import { acquireLock, lockName } from '../host/lock.js';
import { storedRoom } from '../host/room.js';
import { ShowHost } from '../host/ShowHost.js';
import { Stage } from '../render/Stage.js';
import { db, getSetting } from '../storage/db.js';
import { getShow } from '../storage/shows.js';
import { HoldButton } from '../ui/HoldButton.js';

/**
 * Hold Ctrl, Alt, Shift and E this long to leave the installation for the Library. Not Ctrl+Shift+Q:
 * on ChromeOS that signs the session out.
 */
export const EXIT_HOLD_MS = 2000;
/** This many errors in a minute and the page starts over, from the journal. */
const ERRORS_BEFORE_RELOAD = 5;

type Phase =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'busy'; show: Show; taken?: boolean }
  | { kind: 'ready'; host: ShowHost };

/**
 * An unattended installation (users-and-journey › museum): the show runs in Show mode in this
 * tab, drawing its first output (or `?output=`) here, from the crash journal if there is one.
 * It reconnects to its room, keeps the opening hours, and opens the other outputs when the
 * browser's policy allows. Keys still work: Esc is PANIC, and holding Ctrl+Alt+Shift+E for two
 * seconds leaves for the Library. Staff on another tab get "Take over".
 */
export default function Kiosk() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [takeover, setTakeover] = useState(0);

  useEffect(() => {
    let host: ShowHost | null = null;
    let release: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      const show = await getShow(id);
      if (!show) return setPhase({ kind: 'missing' });
      // Taken over from another tab or window: stop driving the outputs and say so.
      const lost = () => {
        host?.dispose();
        host = null;
        release = null;
        if (!cancelled) setPhase({ kind: 'busy', show, taken: true });
      };
      const lock = await acquireLock(lockName(id), takeover > 0, lost);
      if (cancelled) return lock?.();
      if (!lock) return setPhase({ kind: 'busy', show });
      release = lock;
      const journal = await (await db()).get('journal', id);
      if (cancelled) return release();
      // Always carry on from where the last run stopped: a power cut is just a pause.
      host = new ShowHost(show, {
        state: journal?.state,
        mode: 'show',
        resumed: !!journal?.state.lastFired,
        kiosk: true,
      });
      setPhase({ kind: 'ready', host });
      const room = await storedRoom(id);
      if (cancelled) return;
      if (room?.keep || (await getSetting<boolean>(`roomActive:${id}`))) void host.connectRelay();
      // The other outputs open themselves where policy allows pop-ups and window placement.
      const others = show.outputs.filter(
        (o) => o.id !== (params.get('output') ?? show.outputs[0]?.id),
      );
      if (others.length) void openAllOutputs({ id: show.id, outputs: others });
    })();
    return () => {
      cancelled = true;
      host?.dispose();
      release?.();
    };
  }, [id, takeover, params]);

  if (phase.kind === 'loading') return <div className="fixed inset-0 bg-black" />;
  if (phase.kind === 'missing')
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-fg-muted">
        This show isn’t on this machine.
      </div>
    );
  if (phase.kind === 'busy')
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black p-8 text-center">
        <p className="max-w-md text-ui text-fg-muted">
          {phase.taken
            ? `“${phase.show.name}” was taken over in another tab or window on this machine.`
            : `“${phase.show.name}” is running in another tab or window on this machine.`}
        </p>
        <HoldButton
          danger
          label="Hold to run the installation here; the other one stops"
          onConfirm={() => setTakeover((n) => n + 1)}
        >
          Hold to take over here
        </HoldButton>
      </div>
    );
  return <Installation host={phase.host} outputId={params.get('output')} />;
}

function Installation({ host, outputId }: { host: ShowHost; outputId: string | null }) {
  const snap = useSyncExternalStore(host.subscribe, host.getSnapshot);
  const navigate = useNavigate();
  const output = snap.show.outputs.find((o) => o.id === outputId) ?? snap.show.outputs[0];

  useEffect(() => {
    document.title = `${snap.show.name} · Scrim installation`;
  }, [snap.show.name]);

  // Full screen at once where the browser's policy allows it without a click
  // (AutomaticFullscreenAllowedForUrls, or Chrome's --kiosk); otherwise the first touch does it.
  useEffect(() => {
    if (!document.fullscreenElement)
      void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  // Keys run the show as in the operator view; Ctrl+Alt+Shift+E held for two seconds leaves.
  useEffect(() => {
    let exit: ReturnType<typeof setTimeout> | null = null;
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault();
        exit ??= setTimeout(() => navigate('/'), EXIT_HOLD_MS);
        return;
      }
      if (e.repeat) return;
      if (host.key(e.key, 'keyboard', e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (
        exit &&
        [
          'KeyE',
          'ControlLeft',
          'ControlRight',
          'AltLeft',
          'AltRight',
          'ShiftLeft',
          'ShiftRight',
        ].includes(e.code)
      ) {
        clearTimeout(exit);
        exit = null;
      }
      host.keyUp(e.key, e.code);
    };
    window.addEventListener('keydown', down, { capture: true });
    window.addEventListener('keyup', up, { capture: true });
    return () => {
      if (exit) clearTimeout(exit);
      window.removeEventListener('keydown', down, { capture: true });
      window.removeEventListener('keyup', up, { capture: true });
    };
  }, [host, navigate]);

  // Unattended means nobody to click "reload": too many errors and it starts over, from the
  // journal, where it was.
  useEffect(() => {
    const times: number[] = [];
    const failed = () => {
      const now = Date.now();
      times.push(now);
      while (times[0]! < now - 60_000) times.shift();
      if (times.length >= ERRORS_BEFORE_RELOAD) location.reload();
    };
    window.addEventListener('error', failed);
    window.addEventListener('unhandledrejection', failed);
    return () => {
      window.removeEventListener('error', failed);
      window.removeEventListener('unhandledrejection', failed);
    };
  }, []);

  const onEnded = useCallback(
    (layerId: string) => host.dispatch({ type: 'mediaEnded', layerId }),
    [host],
  );

  return (
    <div
      className="fixed inset-0 cursor-none bg-black select-none"
      // Browsers allow full screen only after a click unless policy says otherwise.
      onPointerDown={() =>
        !document.fullscreenElement &&
        void document.documentElement.requestFullscreen().catch(() => undefined)
      }
    >
      {output && (
        <Stage
          show={snap.show}
          state={snap.state}
          outputId={output.id}
          variant="output"
          onMediaEnded={onEnded}
          join={snap.join}
        />
      )}
    </div>
  );
}
