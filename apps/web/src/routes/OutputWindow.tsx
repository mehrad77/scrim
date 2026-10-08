import type { EngineState } from '@scrim/engine';
import type { Show } from '@scrim/format';
import type { OutputStatus } from '@scrim/protocol';
import { Maximize } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { listScreens } from '../host/windows.js';
import { cn } from '../lib/cn.js';
import { Stage } from '../render/Stage.js';
import { db } from '../storage/db.js';
import { ShowChannel } from '../transport/local.js';

const HOST_SILENT_MS = 2500;

/**
 * A clean, full-screen output window. It renders whatever state the operator
 * view broadcasts; if the operator tab goes away it keeps showing the last
 * picture, and on a fresh load with no operator it restores from the journal.
 */
export default function OutputWindow() {
  const { showId = '', outputId = '' } = useParams();
  const [show, setShow] = useState<Show | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [hostAlive, setHostAlive] = useState(false);
  const [hud, setHud] = useState(true);
  const [identify, setIdentify] = useState(false);
  // In Show mode nothing but the stage appears here: no HUD, no Identify (safety invariant 6).
  const [showMode, setShowMode] = useState(false);
  const showModeRef = useRef(false);
  const channel = useRef<ShowChannel | null>(null);
  const errors = useRef<string[]>([]);
  const screenLabel = useRef<string | null>(null);
  const clientId = useRef(`out-${crypto.randomUUID().slice(0, 8)}`);

  useEffect(() => {
    const ch = new ShowChannel(showId);
    channel.current = ch;
    let lastBeat = 0;
    let lastSeq = -1;
    let gotShow = false;
    const off = ch.on((m) => {
      switch (m.t) {
        case 'show':
          gotShow = true;
          setShow(m.show);
          break;
        case 'state':
          lastBeat = Date.now();
          if (m.seq < lastSeq && m.seq !== 1) break;
          lastSeq = m.seq;
          setState(m.state);
          showModeRef.current = m.mode === 'show';
          setShowMode(m.mode === 'show');
          break;
        case 'beat':
          lastBeat = Date.now();
          break;
        case 'identify':
          if (!showModeRef.current && (m.outputId === null || m.outputId === outputId)) {
            setIdentify(true);
            setTimeout(() => setIdentify(false), 3000);
          }
          break;
        case 'closing':
          lastBeat = 0;
          break;
      }
    });
    ch.post({ t: 'hello', clientId: clientId.current, role: 'output', outputId });

    // No operator answered: show the last journaled state so a reloaded
    // output still matches the stage.
    const fallback = setTimeout(async () => {
      if (gotShow) return;
      const d = await db();
      const [s, j] = await Promise.all([d.get('shows', showId), d.get('journal', showId)]);
      if (!gotShow && s) {
        setShow(s);
        if (j) setState(j.state);
      }
    }, 1500);

    const beat = setInterval(() => {
      setHostAlive(Date.now() - lastBeat < HOST_SILENT_MS);
      const status: OutputStatus = {
        fullscreen:
          !!document.fullscreenElement ||
          (innerWidth === screen.width && innerHeight === screen.height),
        width: innerWidth,
        height: innerHeight,
        screen: screenLabel.current,
        errors: errors.current.slice(-5),
      };
      ch.post({ t: 'outputBeat', clientId: clientId.current, outputId, status });
    }, 500);

    const bye = () => ch.post({ t: 'bye', clientId: clientId.current });
    window.addEventListener('pagehide', bye);
    return () => {
      bye();
      off();
      clearTimeout(fallback);
      clearInterval(beat);
      window.removeEventListener('pagehide', bye);
      ch.close();
    };
  }, [showId, outputId]);

  useEffect(() => {
    void listScreens()
      .then((screens) => {
        const mine = screens.find(
          (s) =>
            screenX >= s.left &&
            screenX < s.left + s.width &&
            screenY >= s.top &&
            screenY < s.top + s.height,
        );
        screenLabel.current = mine?.label ?? null;
      })
      .catch(() => undefined);
  }, []);

  // Keys go to the operator view, so GO and panic work from this window too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
      channel.current?.post({ t: 'key', key: e.key, code: e.code });
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  // The cursor and the small status bar appear only while the mouse moves.
  useEffect(() => {
    let timer = setTimeout(() => setHud(false), 5000);
    const move = () => {
      setHud(true);
      clearTimeout(timer);
      timer = setTimeout(() => setHud(false), 2000);
    };
    window.addEventListener('pointermove', move);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  const output = show?.outputs.find((o) => o.id === outputId);
  useEffect(() => {
    document.title = output ? `${output.name} · Scrim output` : 'Scrim output';
  }, [output]);

  const goFullscreen = useCallback(() => {
    if (!document.fullscreenElement)
      void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  const onEnded = useCallback(
    (layerId: string) => channel.current?.post({ t: 'mediaEnded', layerId }),
    [],
  );
  const onBlocked = useCallback(() => {
    errors.current.push('Sound blocked until this window is clicked');
    channel.current?.post({ t: 'audioBlocked', outputId });
  }, [outputId]);

  return (
    <div
      className={cn('fixed inset-0 bg-black select-none', (!hud || showMode) && 'cursor-none')}
      onClick={goFullscreen}
      onDoubleClick={() => document.fullscreenElement && void document.exitFullscreen()}
    >
      {show && state && output ? (
        <Stage
          show={show}
          state={state}
          outputId={outputId}
          variant="output"
          onMediaEnded={onEnded}
          onAudioBlocked={onBlocked}
        />
      ) : null}
      {identify && !showMode && output && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="rounded-2xl border-4 border-white px-16 py-10 text-center">
            <div className="text-7xl font-bold text-white">{output.name}</div>
            <div className="mt-2 text-2xl text-fg-muted">
              {output.width}×{output.height}
            </div>
          </div>
        </div>
      )}
      <div
        className={cn(
          // The HUD appears and disappears instantly: no UI motion on outputs.
          'absolute right-3 bottom-3 flex items-center gap-3 rounded-control bg-panel/90 px-3 py-2 text-caption text-fg-muted',
          hud && !showMode ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <span className={cn('size-2 rounded-full', hostAlive ? 'bg-fg-muted' : 'bg-warn')} />
        <span>
          {output?.name ??
            (show ? `This output is not in “${show.name}” any more` : 'Waiting for the show…')}
        </span>
        <span className="text-fg-subtle">
          {hostAlive ? 'Live' : 'Operator not connected — holding last picture'}
        </span>
        {!document.fullscreenElement && (
          <button
            className="flex items-center gap-1 rounded-control bg-control-active px-2 py-1 hover:bg-line-strong"
            onClick={goFullscreen}
          >
            <Maximize size={12} /> Full screen
          </button>
        )}
      </div>
    </div>
  );
}
