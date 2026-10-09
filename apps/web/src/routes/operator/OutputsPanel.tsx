import type { Output } from '@scrim/format';
import { Copy, ExternalLink, Eye, Monitor, MonitorPlay, ScanEye } from 'lucide-react';
import { useMemo, useState } from 'react';
import { step } from '@scrim/engine';
import { audienceUrl, remoteOutputUrl } from '../../host/room.js';
import { openOutput, SCREENS_KEY } from '../../host/goLive.js';
import { listScreens, windowManagementSupported, type ScreenChoice } from '../../host/windows.js';
import { cn } from '../../lib/cn.js';
import { epochNow } from '../../lib/clock.js';
import { readLocal, writeLocal } from '../../lib/local.js';
import { usePrefs } from '../../lib/usePrefs.js';
import { Stage } from '../../render/Stage.js';
import { Button, IconButton } from '../../ui/Button.js';
import { Select, Toggle } from '../../ui/Field.js';
import { Lamp } from '../../ui/Lamp.js';
import { Badge, Panel } from '../../ui/Panel.js';
import { settle } from '../../lib/simulate.js';
import { errorToast, toast } from '../../ui/toast.js';
import { useHost } from './Operator.js';

export function OutputsPanel() {
  const [host, snap] = useHost();
  const showMode = snap.mode === 'show';
  // What GO will show: the standby cue fired on top of the current state, settled to a still.
  const next = useMemo(
    () =>
      snap.state.standby
        ? settle(
            step(
              snap.show,
              snap.state,
              { type: 'fireCue', cueId: snap.state.standby, source: 'system' },
              epochNow() + 1e7,
            ).state,
          )
        : null,
    [snap.show, snap.state],
  );
  // In the Booth theme a bright slide shouldn't be the brightest light in the room.
  const prefs = usePrefs();
  const dim =
    document.documentElement.dataset.theme === 'booth'
      ? { filter: `brightness(${prefs.thumbBrightness})` }
      : undefined;
  const [screens, setScreens] = useState<ScreenChoice[] | null>(null);
  const [assigned, setAssigned] = useState(() =>
    readLocal<Record<string, string>>(SCREENS_KEY, {}),
  );
  const [live, setLive] = useState(() => readLocal('scrim.liveThumbs', true));

  const loadScreens = async () => {
    try {
      const list = await listScreens();
      setScreens(list);
      return list;
    } catch (e) {
      errorToast(e);
      return [];
    }
  };

  const open = async (o: Output, list = screens) => {
    if (!openOutput(snap.show.id, o.id, list, assigned))
      toast('The browser blocked the window. Allow pop-ups for Scrim and try again.', 'error');
  };

  // "Go live": the single click that opens every output on its display.
  const openAll = async () => {
    const list = windowManagementSupported() ? (screens ?? (await loadScreens())) : null;
    for (const o of snap.show.outputs) await open(o, list);
  };

  return (
    <Panel
      title="Outputs"
      className="flex-1"
      bodyClassName="p-2"
      actions={
        <>
          <Toggle
            checked={live}
            onChange={(v) => {
              setLive(v);
              writeLocal('scrim.liveThumbs', v);
            }}
            label={<span className="text-caption">Live previews</span>}
          />
          {!showMode && (
            <Button size="sm" icon={<ScanEye size={13} />} onClick={() => host.identify(null)}>
              Identify
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            icon={<MonitorPlay size={13} />}
            onClick={() => void openAll()}
          >
            Go live: open all
          </Button>
        </>
      }
    >
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(snap.show.outputs.length, 2)}, minmax(0,1fr))`,
        }}
      >
        {snap.show.outputs.map((o) => {
          const health = snap.health[o.id] ?? 'none';
          const links = snap.links.filter((l) => l.outputId === o.id);
          const fullscreen = links.some((l) => l.status?.fullscreen);
          const blocked = snap.audioBlocked.includes(o.id);
          return (
            <div
              key={o.id}
              className={cn(
                'rounded-control border p-2',
                health === 'lost' ? 'border-lamp-fault' : 'border-line-subtle',
              )}
            >
              <div className="grid grid-cols-[2fr_1fr] gap-2">
                <div
                  className="relative aspect-video overflow-hidden rounded-control bg-black"
                  style={dim}
                >
                  {live ? (
                    <Stage show={snap.show} state={snap.state} outputId={o.id} variant="thumb" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-caption text-fg-subtle">
                      Previews off
                    </div>
                  )}
                  {health === 'lost' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-app/85 text-ui font-semibold text-fault">
                      Output window lost
                      <div className="flex gap-2">
                        <Button size="sm" variant="danger" onClick={() => void open(o)}>
                          Reopen
                        </Button>
                        <Button size="sm" onClick={() => host.dismissOutput(o.id)}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <div
                    className="relative aspect-video overflow-hidden rounded-control bg-black"
                    style={dim}
                  >
                    {live && next && (
                      <Stage show={snap.show} state={next} outputId={o.id} variant="thumb" />
                    )}
                  </div>
                  <Lamp tone={next ? 'standby' : 'off'}>Next</Lamp>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Monitor size={14} className="text-fg-subtle" />
                <span className="text-ui font-medium">{o.name}</span>
                {health === 'ok' && (
                  <Badge tone="good">Open{links.length > 1 ? ` ×${links.length}` : ''}</Badge>
                )}
                {health === 'ok' && !fullscreen && <Badge tone="warn">Not full screen</Badge>}
                {health === 'none' && <Badge>Closed</Badge>}
                {links.some((l) => l.remote) && <Badge tone="neutral">Remote</Badge>}
                {blocked && <Badge tone="warn">Click output once for sound</Badge>}
                <div className="ml-auto flex items-center gap-0.5">
                  {!showMode && (
                    <IconButton
                      label="Identify this output"
                      icon={<Eye size={13} />}
                      onClick={() => host.identify(o.id)}
                    />
                  )}
                  <IconButton
                    label="Open output window"
                    icon={<ExternalLink size={13} />}
                    onClick={() => void open(o)}
                  />
                  {snap.relay.room && !showMode && (
                    <IconButton
                      label="Copy link for a screen on another device"
                      icon={<Copy size={13} />}
                      onClick={() => {
                        void navigator.clipboard.writeText(remoteOutputUrl(snap.relay.room!, o.id));
                        toast('Remote output link copied. Open it on the other device.', 'good');
                      }}
                    />
                  )}
                </div>
              </div>
              {windowManagementSupported() && !showMode && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-caption text-fg-subtle">Display</span>
                  {screens ? (
                    <Select
                      className="h-7 text-caption"
                      value={assigned[o.id] ?? ''}
                      onChange={(e) => {
                        const next = { ...assigned, [o.id]: e.target.value };
                        setAssigned(next);
                        writeLocal(SCREENS_KEY, next);
                      }}
                    >
                      <option value="">Choose when opening</option>
                      {screens.map((s) => (
                        <option key={s.index} value={s.label}>
                          {s.label} {s.primary ? '(this screen)' : ''} · {s.width}×{s.height}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Button size="sm" onClick={() => void loadScreens()}>
                      Detect displays
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {snap.relay.room && !showMode && (
        <p className="mt-2 text-caption text-fg-subtle">
          Audience page: {audienceUrl(snap.relay.room)}
        </p>
      )}
    </Panel>
  );
}
