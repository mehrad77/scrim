import type { EngineState } from '@scrim/engine';
import type { Show } from '@scrim/format';
import { CLOSE, type OutputToRelay, type RelayToOutput } from '@scrim/protocol';
import { FolderOpen, Maximize } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { clientId } from '../lib/config.js';
import { cn } from '../lib/cn.js';
import { Stage } from '../render/Stage.js';
import { storedMediaIds } from '../storage/media.js';
import { importShow } from '../storage/shows.js';
import { RelayClient, type RelayStatus } from '../transport/relay.js';
import { Button } from '../ui/Button.js';
import { errorToast } from '../ui/toast.js';

/**
 * An output on another device, following the show through the relay. Media
 * never crosses the network: this device imports the .scrim bundle once.
 */
export default function RemoteOutput() {
  const [params, setParams] = useSearchParams();
  const code = params.get('r') ?? '';
  const key = params.get('k') ?? '';
  const relayUrl = params.get('relay') ?? '';
  const outputId = params.get('o') ?? '';
  const [show, setShow] = useState<Show | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [hostOffset, setHostOffset] = useState(0);
  const [status, setStatus] = useState<RelayStatus>('connecting');
  const [hostGone, setHostGone] = useState(false);
  const [missing, setMissing] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const relay = useRef<RelayClient<RelayToOutput, OutputToRelay> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!code || !key || !relayUrl) return;
    const client = new RelayClient<RelayToOutput, OutputToRelay>({
      relay: relayUrl,
      code,
      role: 'output',
      key,
      client: `ro-${clientId().slice(0, 12)}`,
      fatal: [CLOSE.unauthorized, CLOSE.notFound],
    });
    relay.current = client;
    client.onStatus(setStatus);
    client.onMessage((m) => {
      if (m.t === 'show') setShow(m.show);
      if (m.t === 'state') {
        setState(m.state);
        setHostOffset(m.offset);
        setHostGone(false);
      }
      if (m.t === 'hostGone') setHostGone(true);
    });
    return () => client.close();
  }, [code, key, relayUrl]);

  const checkMedia = useCallback(async (s: Show) => {
    const have = await storedMediaIds();
    setMissing(s.media.filter((m) => !have.has(m.id)).length);
  }, []);
  useEffect(() => {
    if (show) void checkMedia(show);
  }, [show, checkMedia]);

  useEffect(() => {
    if (!outputId) return;
    const id = setInterval(() => {
      relay.current?.send({
        t: 'outputBeat',
        outputId,
        status: {
          fullscreen: !!document.fullscreenElement,
          width: innerWidth,
          height: innerHeight,
          screen: null,
          errors: [],
        },
      });
    }, 1000);
    return () => clearInterval(id);
  }, [outputId]);

  // Engine times are the operator machine's; convert through the relay clock.
  const clock = useMemo(
    () => () => Date.now() + (relay.current?.offset ?? 0) - hostOffset,
    [hostOffset],
  );

  if (!code || !key || !relayUrl)
    return <Message>This link is incomplete. Open it again from the operator view.</Message>;
  if (status === 'failed')
    return (
      <Message>
        Could not join room {code}. The show may have moved to a new room; ask the operator for a
        fresh link.
      </Message>
    );
  if (!show) return <Message>Connecting to room {code}…</Message>;

  if (!outputId || !show.outputs.some((o) => o.id === outputId)) {
    return (
      <Message>
        <p className="mb-4">Which output is this screen?</p>
        <div className="flex flex-col gap-2">
          {show.outputs.map((o) => (
            <Button key={o.id} onClick={() => setParams((p) => (p.set('o', o.id), p))}>
              {o.name} · {o.width}×{o.height}
            </Button>
          ))}
        </div>
      </Message>
    );
  }

  if (missing === null) return <Message>Checking media…</Message>;
  if (missing > 0) {
    return (
      <Message>
        <p className="mb-2 text-lg font-semibold">{show.name}</p>
        <p className="mb-4 text-sm text-ink-300">
          This screen needs the show's media ({missing} file{missing === 1 ? '' : 's'} missing).
          Export the show as a .scrim file on the operator machine and open it here once. It stays
          on this device for every performance.
        </p>
        <Button
          variant="primary"
          icon={<FolderOpen size={16} />}
          disabled={importing}
          onClick={() => fileInput.current?.click()}
        >
          {importing ? 'Importing…' : 'Open .scrim file'}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".scrim,application/zip"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setImporting(true);
            try {
              await importShow(f, async () => 'replace');
              await checkMedia(show);
            } catch (err) {
              errorToast(err);
            } finally {
              setImporting(false);
            }
          }}
        />
      </Message>
    );
  }

  return (
    <div
      className="fixed inset-0 cursor-none bg-black"
      onClick={() =>
        !document.fullscreenElement &&
        void document.documentElement.requestFullscreen().catch(() => undefined)
      }
    >
      {state && (
        <Stage show={show} state={state} outputId={outputId} variant="output" clock={clock} />
      )}
      {!document.fullscreenElement && (
        <div
          className={cn(
            'absolute right-3 bottom-3 flex items-center gap-2 rounded bg-ink-900/90 px-3 py-2 text-xs',
            (hostGone || status !== 'open') && 'text-amber-300',
          )}
        >
          <Maximize size={12} /> Click for full screen
          {(hostGone || status !== 'open') && ' · operator offline, holding last picture'}
        </div>
      )}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-md text-center text-ink-200">{children}</div>
    </div>
  );
}
