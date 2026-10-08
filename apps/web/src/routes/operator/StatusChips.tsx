import { Pause, TriangleAlert, Undo2, X } from 'lucide-react';
import { Button as AriaButton, Dialog, DialogTrigger, Popover } from 'react-aria-components';
import { Button } from '../../ui/Button.js';
import { Lamp, type LampTone } from '../../ui/Lamp.js';
import { useHost } from './Operator.js';

/**
 * Health as four lamps (UX_PRINCIPLES.md › Quiet when normal): off and grey when all is well,
 * warn when degraded but the show runs, fault when the audience is affected now. Each lamp names
 * its problem in the Info strip.
 */
export function StatusChips() {
  const [, snap] = useHost();
  const { relay, show } = snap;

  const outputs = show.outputs.map((o) => ({
    o,
    health: snap.health[o.id] ?? 'none',
    fullscreen: snap.links.some((l) => l.outputId === o.id && l.status?.fullscreen),
  }));
  const lost = outputs.filter((x) => x.health === 'lost');
  const notFull = outputs.filter((x) => x.health === 'ok' && !x.fullscreen);
  const out: [LampTone, string] = lost.length
    ? ['fault', `Output lost: ${lost.map((x) => x.o.name).join(', ')}. Reopen it below.`]
    : notFull.length || !snap.wakeLock
      ? [
          'warn',
          [
            notFull.length && `Not full screen: ${notFull.map((x) => x.o.name).join(', ')}`,
            !snap.wakeLock && 'This machine may sleep: keep the operator tab visible',
          ]
            .filter(Boolean)
            .join(' · '),
        ]
      : ['off', 'Outputs are open and full screen'];

  const sound: [LampTone, string] = snap.audioBlocked.length
    ? ['fault', 'Sound is blocked: click each output window once']
    : ['off', 'Sound is ready'];

  const room: [LampTone, string] =
    relay.status === 'off'
      ? ['off', 'No audience room is open']
      : relay.status === 'open'
        ? ['off', `Room ${relay.room?.code} · ${relay.presence.audience} phones`]
        : [
            'warn',
            relay.status === 'failed'
              ? 'Room offline: moments use their defaults'
              : 'Room reconnecting',
          ];

  const usesMidi = show.inputs.midi.length > 0;
  const inputs: [LampTone, string] =
    usesMidi && snap.midi !== null && snap.midi.length === 0
      ? ['warn', 'No MIDI device connected; pedals mapped in this show will not work']
      : [
          'off',
          `Keyboard${snap.midi?.length ? ` · ${snap.midi.length} MIDI` : ''}${snap.gamepads.length ? ` · ${snap.gamepads.length} gamepad` : ''}`,
        ];

  const icon = (tone: LampTone) =>
    tone === 'fault' ? <X size={12} /> : tone === 'warn' ? <TriangleAlert size={12} /> : undefined;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {(
        [
          ['Outputs', out],
          ['Sound', sound],
          [relay.status === 'open' ? `Room · ${relay.presence.audience}` : 'Room', room],
          ['Inputs', inputs],
        ] as const
      ).map(([name, [tone, info]]) => (
        <Lamp key={name} tone={tone} icon={icon(tone)} title={info}>
          {name}
        </Lamp>
      ))}
      <OffScript />
    </div>
  );
}

/** One chip for deliberate deviations from the script, with a way back. */
function OffScript() {
  const [host, snap] = useHost();
  const items = snap.offScript;
  const count = items.length + (snap.state.held ? 1 : 0);
  if (!count) return null;
  return (
    <DialogTrigger>
      <AriaButton
        data-info="Deliberate changes from the script this run"
        className="label-caps inline-flex h-7 items-center gap-1.5 rounded-control border border-line-control px-2 text-warn outline-none hover:bg-control-hover"
      >
        <TriangleAlert size={12} /> Off script · {count}
      </AriaButton>
      <Popover
        isNonModal
        isKeyboardDismissDisabled
        data-overlay-open
        className="w-80 rounded-overlay border border-line-strong bg-raised p-3 shadow-overlay"
      >
        <Dialog className="outline-none" aria-label="Off script">
          <ul className="mb-3 flex max-h-60 flex-col gap-1 overflow-auto text-ui">
            {snap.state.held && (
              <li className="flex items-center gap-2">
                <Pause size={12} /> Hold is on
              </li>
            )}
            {items
              .slice()
              .reverse()
              .map((e, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="font-mono text-caption text-fg-subtle tabular-nums">
                    {new Date(e.at).toLocaleTimeString()}
                  </span>
                  {e.label}
                </li>
              ))}
          </ul>
          <Button size="sm" icon={<Undo2 size={13} />} onClick={() => host.backToScript()}>
            Back to script
          </Button>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
