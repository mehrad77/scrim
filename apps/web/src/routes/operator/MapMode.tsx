import type { Command, Inputs } from '@scrim/format';
import { X } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { keyLabel, sameKey, type MidiEvent } from '../../host/inputs.js';
import type { CapturedInput, ShowHost } from '../../host/ShowHost.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../../ui/Button.js';
import { Select } from '../../ui/Field.js';
import { toast } from '../../ui/toast.js';
import { useHost } from './Operator.js';

/**
 * Map mode (UX principle 9): the real operator view, with GO, Hold, Back, standby, PANIC and
 * triggers outlined. Pick one, press a key, pedal or MIDI pad, and it is mapped. A key that
 * already does something else asks Replace, Swap or Cancel right in the message strip.
 */

type Pressed =
  | { kind: 'key'; code: string }
  | { kind: 'midi'; event: MidiEvent }
  | { kind: 'gamepad'; button: number };

interface Conflict {
  pressed: Pressed;
  /** What the key does today. */
  other: Command;
}

export interface MapApi {
  active: boolean;
  target: Command | null;
  conflict: Conflict | null;
  setActive: (on: boolean) => void;
  pick: (c: Command) => void;
  press: (p: Pressed) => void;
  resolve: (how: 'replace' | 'swap' | 'cancel') => void;
  unbind: (label: string) => void;
  preset: (name: keyof typeof PRESETS) => void;
}

const MapContext = createContext<MapApi | null>(null);
export const MapProvider = MapContext.Provider;
export const useMapMode = () => useContext(MapContext);

const same = (a: Command, b: Command) => JSON.stringify(a) === JSON.stringify(b);

const RUNNING = ['go', 'hold', 'back', 'standbyNext', 'standbyPrev'] as const;
type Running = (typeof RUNNING)[number];

/** Key maps stored as physical keys, so they survive non-US layouts. */
export const PRESETS: Record<'scrim' | 'qlab', { label: string; keys: [string, Running][] }> = {
  scrim: {
    label: 'Scrim',
    keys: [
      ['Space', 'go'],
      ['KeyH', 'hold'],
      ['KeyB', 'back'],
      ['ArrowDown', 'standbyNext'],
      ['ArrowUp', 'standbyPrev'],
    ],
  },
  qlab: {
    label: 'QLab-style',
    keys: [
      ['Space', 'go'],
      ['BracketLeft', 'hold'],
      ['ArrowDown', 'standbyNext'],
      ['ArrowUp', 'standbyPrev'],
    ],
  },
};

function pressedLabel(p: Pressed): string {
  if (p.kind === 'key') return keyLabel(p.code);
  if (p.kind === 'midi') return `MIDI ${p.event.kind === 'note' ? 'note' : 'CC'} ${p.event.number}`;
  return `Pad ${p.button + 1}`;
}

/** Every binding for a command, as people read them. */
export function bindingsOf(inputs: Inputs, c: Command): string[] {
  return [...new Set(all(inputs, c))];
}

function all(inputs: Inputs, c: Command): string[] {
  return [
    ...(c.type === 'panic' ? ['Esc'] : []),
    ...inputs.keys.filter((k) => same(k.command, c)).map((k) => keyLabel(k.key)),
    ...inputs.midi
      .filter((m) => same(m.command, c))
      .map((m) => `MIDI ${m.kind === 'note' ? 'note' : 'CC'} ${m.number}`),
    ...inputs.gamepad.filter((g) => same(g.command, c)).map((g) => `Pad ${g.button + 1}`),
  ];
}

function existing(inputs: Inputs, p: Pressed): Command | null {
  if (p.kind === 'key') return inputs.keys.find((k) => sameKey(k.key, p.code))?.command ?? null;
  if (p.kind === 'midi') {
    const e = p.event;
    return (
      inputs.midi.find(
        (m) =>
          m.kind === e.kind &&
          m.number === e.number &&
          (m.channel === null || m.channel === e.channel),
      )?.command ?? null
    );
  }
  return inputs.gamepad.find((g) => g.button === p.button)?.command ?? null;
}

/** Remove the binding for `p`, then bind it to `c`. */
function bind(inputs: Inputs, p: Pressed, c: Command): Inputs {
  const next = structuredClone(inputs);
  if (p.kind === 'key') {
    next.keys = next.keys.filter((k) => !sameKey(k.key, p.code));
    next.keys.push({ key: p.code, command: c });
  } else if (p.kind === 'midi') {
    const e = p.event;
    next.midi = next.midi.filter((m) => !(m.kind === e.kind && m.number === e.number));
    next.midi.push({ kind: e.kind, channel: null, number: e.number, command: c });
  } else {
    next.gamepad = next.gamepad.filter((g) => g.button !== p.button);
    next.gamepad.push({ button: p.button, command: c });
  }
  return next;
}

export function useMapApi(host: ShowHost, inputs: Inputs, allowed: boolean): MapApi {
  const [active, setActiveState] = useState(false);
  const [target, setTarget] = useState<Command | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const latest = useRef(inputs);
  latest.current = inputs;

  const save = (next: Inputs, text: string) => {
    const before = latest.current;
    void host.setInputs(next);
    toast(text, 'good', { label: 'Undo', run: () => void host.setInputs(before) });
  };

  const assign = (p: Pressed, c: Command) =>
    save(bind(latest.current, p, c), `${pressedLabel(p)} now does ${commandName(host, c)}`);

  const api: MapApi = {
    active: active && allowed,
    target,
    conflict,
    setActive: (on) => {
      setActiveState(on);
      setTarget(null);
      setConflict(null);
    },
    pick: (c) => {
      setTarget(c);
      setConflict(null);
    },
    press: (p) => {
      if (!target) return;
      const other = existing(latest.current, p);
      if (other && same(other, target)) return;
      if (other) return setConflict({ pressed: p, other });
      assign(p, target);
    },
    resolve: (how) => {
      if (!conflict || !target) return setConflict(null);
      if (how === 'replace') assign(conflict.pressed, target);
      if (how === 'swap') {
        // The other command takes the target's first binding of the same kind.
        let next = bind(latest.current, conflict.pressed, target);
        const p = conflict.pressed;
        if (p.kind === 'key') {
          const old = latest.current.keys.find((k) => same(k.command, target));
          if (old) next = bind(next, { kind: 'key', code: old.key }, conflict.other);
        }
        save(next, `Swapped: ${pressedLabel(p)} does ${commandName(host, target)} now`);
      }
      setConflict(null);
    },
    unbind: (label) => {
      if (!target) return;
      const next = structuredClone(latest.current);
      next.keys = next.keys.filter((k) => !(same(k.command, target) && keyLabel(k.key) === label));
      next.midi = next.midi.filter(
        (m) =>
          !(
            same(m.command, target) &&
            `MIDI ${m.kind === 'note' ? 'note' : 'CC'} ${m.number}` === label
          ),
      );
      next.gamepad = next.gamepad.filter(
        (g) => !(same(g.command, target) && `Pad ${g.button + 1}` === label),
      );
      save(next, `Removed ${label}`);
    },
    preset: (name) => {
      const keys = PRESETS[name].keys;
      const next = structuredClone(latest.current);
      next.keys = next.keys.filter(
        (k) =>
          !(RUNNING as readonly string[]).includes(k.command.type) &&
          !keys.some(([code]) => sameKey(code, k.key)),
      );
      next.keys.unshift(...keys.map(([key, type]) => ({ key, command: { type } as Command })));
      save(next, `${PRESETS[name].label} keys applied`);
    },
  };

  // MIDI and gamepad presses come through the host while a control is picked.
  const pressRef = useRef(api.press);
  pressRef.current = api.press;
  const capturing = api.active && !!target;
  useEffect(() => {
    if (!capturing) return;
    host.captureInputs((input: CapturedInput) =>
      pressRef.current(
        input.kind === 'midi'
          ? { kind: 'midi', event: input.event }
          : { kind: 'gamepad', button: input.button },
      ),
    );
    return () => host.captureInputs(null);
  }, [capturing, host]);

  return api;
}

export function commandName(host: ShowHost, c: Command): string {
  switch (c.type) {
    case 'go':
      return 'GO';
    case 'hold':
      return 'Hold';
    case 'back':
      return 'Back';
    case 'panic':
      return 'PANIC';
    case 'standbyNext':
      return 'Next cue on standby';
    case 'standbyPrev':
      return 'Previous cue on standby';
    case 'trigger':
      return host.engine.show.triggers.find((t) => t.id === c.triggerId)?.name ?? 'a trigger';
    case 'clearText':
      return 'Clear text';
    case 'clearMedia':
      return 'Clear media';
    case 'mute':
      return 'Mute sound';
  }
}

/**
 * Wraps a control so Map mode can outline it. Outside Map mode it renders the control as is,
 * in a box with the same layout.
 */
export function Mappable({
  command,
  className,
  children,
}: {
  command: Command;
  className?: string;
  children: ReactNode;
}) {
  const map = useMapMode();
  const [host, snap] = useHost();
  const on = !!map?.active;
  const picked = on && !!map.target && same(map.target, command);
  const keys = on ? bindingsOf(snap.show.inputs, command) : [];
  return (
    <div className={cn('relative', className)}>
      {children}
      {on && (
        <button
          type="button"
          aria-label={`Map a key to ${commandName(host, command)}${keys.length ? ` (now ${keys.join(', ')})` : ''}`}
          aria-pressed={picked}
          onClick={() => map.pick(command)}
          className={cn(
            'absolute inset-0 flex items-end justify-end rounded-control border-2 bg-app/70 p-1 outline-none focus-visible:outline-2 focus-visible:outline-focus',
            picked ? 'border-accent' : 'border-dashed border-accent',
          )}
        >
          <span className="label-caps rounded-control bg-accent px-1 text-accent-fg">
            {keys.length ? keys.join(' · ') : 'No key'}
          </span>
        </button>
      )}
    </div>
  );
}

/** The message strip while Map mode is on: what to do next, conflicts, presets and Done. */
export function MapBar() {
  const map = useMapMode();
  const [host, snap] = useHost();
  if (!map?.active) return null;
  const { target, conflict } = map;
  const keys = target ? bindingsOf(snap.show.inputs, target) : [];
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-fg">
      <span className="label-caps shrink-0 rounded-control bg-accent px-1.5 py-0.5 text-accent-fg">
        Map keys
      </span>
      {conflict && target ? (
        <>
          <span className="truncate">
            {pressedLabel(conflict.pressed)} already does {commandName(host, conflict.other)}.
          </span>
          <Button size="sm" onClick={() => map.resolve('replace')}>
            Replace
          </Button>
          <Button size="sm" onClick={() => map.resolve('swap')}>
            Swap
          </Button>
          <Button size="sm" variant="ghost" onClick={() => map.resolve('cancel')}>
            Cancel
          </Button>
        </>
      ) : target ? (
        <>
          <span className="truncate">
            Press a key, pedal or MIDI pad for <b>{commandName(host, target)}</b>.
          </span>
          {keys
            .filter((k) => k !== 'Esc')
            .map((k) => (
              <span
                key={k}
                className="flex shrink-0 items-center gap-0.5 rounded-control border border-line-control px-1 text-caption"
              >
                {k}
                <button
                  aria-label={`Remove ${k}`}
                  className="rounded-control text-fg-icon hover:text-fg"
                  onClick={() => map.unbind(k)}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
        </>
      ) : (
        <span className="truncate text-fg-muted">
          Pick GO, Hold, Back, standby, PANIC or a trigger, then press a key. Esc still panics.
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1">
        <Select
          aria-label="Key preset"
          className="w-36"
          value=""
          onChange={(e) => e.target.value && map.preset(e.target.value as keyof typeof PRESETS)}
        >
          <option value="">Preset…</option>
          {Object.entries(PRESETS).map(([id, p]) => (
            <option key={id} value={id}>
              {p.label}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="primary" onClick={() => map.setActive(false)}>
          Done
        </Button>
      </span>
    </div>
  );
}
