import type { Command, Show } from '@scrim/format';
import { Gamepad2, Keyboard, Piano, Plus, Radio, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  keyLabel,
  listenGamepads,
  listenMidi,
  PANIC_KEY,
  type MidiEvent,
} from '../../host/inputs.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { Select } from '../../ui/Field.js';
import { Empty, Kbd, Panel } from '../../ui/Panel.js';
import { errorToast, toast } from '../../ui/toast.js';

export function InputsTab() {
  return (
    <div className="grid h-full grid-cols-3 gap-2 p-2">
      <KeysPanel />
      <MidiPanel />
      <GamepadPanel />
    </div>
  );
}

function encode(c: Command): string {
  return c.type === 'trigger' ? `trigger:${c.triggerId}` : c.type;
}

function decode(v: string): Command {
  if (v.startsWith('trigger:')) return { type: 'trigger', triggerId: v.slice(8) };
  return { type: v as Exclude<Command['type'], 'trigger'> } as Command;
}

function CommandPicker({
  show,
  value,
  onChange,
}: {
  show: Show;
  value: Command;
  onChange: (c: Command) => void;
}) {
  return (
    <Select
      className="w-48"
      value={encode(value)}
      onChange={(e) => onChange(decode(e.target.value))}
    >
      <option value="go">GO</option>
      <option value="panic">Panic (blackout)</option>
      <option value="hold">Hold / resume</option>
      <option value="standbyNext">Standby next cue</option>
      <option value="standbyPrev">Standby previous cue</option>
      {show.triggers.length > 0 && (
        <optgroup label="Triggers">
          {show.triggers.map((t) => (
            <option key={t.id} value={`trigger:${t.id}`}>
              {t.name}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}

function KeysPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const [recording, setRecording] = useState<number | null>(null);

  useEffect(() => {
    if (recording === null) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const key = e.key;
      if (key === PANIC_KEY) {
        toast('Esc is always Panic. Pick another key.', 'error');
      } else if (show.inputs.keys.some((k, i) => k.key === key && i !== recording)) {
        toast(`${keyLabel(key)} is already mapped`, 'error');
      } else {
        update((d) => void (d.inputs.keys[recording]!.key = key));
      }
      setRecording(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [recording, show.inputs.keys, update]);

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Keyboard size={14} /> Keyboard
        </span>
      }
      bodyClassName="p-2"
      actions={
        <IconButton
          label="Add key"
          icon={<Plus size={14} />}
          onClick={() => {
            update((d) => void d.inputs.keys.push({ key: '', command: { type: 'go' } }));
            setRecording(show.inputs.keys.length);
          }}
        />
      }
    >
      <p className="mb-2 text-xs text-fg-subtle">
        Keys work in the operator view and in output windows. Panic also works from the editor.
      </p>
      <div className="mb-1 flex items-center gap-2" title="Esc always fires Panic, in every window">
        <span className="w-24 py-1 text-center">
          <Kbd>Esc</Kbd>
        </span>
        <span className="text-sm text-fg-muted">Panic (blackout)</span>
        <span className="ml-auto text-xs text-fg-subtle">Always on</span>
      </div>
      {show.inputs.keys.map((k, i) =>
        k.key === PANIC_KEY ? null : (
          <div key={i} className="mb-1 flex items-center gap-2">
            <button
              className="w-24 rounded border border-line-subtle py-1 text-center hover:border-fg-subtle"
              onClick={() => setRecording(i)}
              title="Click, then press a key"
            >
              {recording === i ? (
                <span className="text-xs text-accent-text">Press a key…</span>
              ) : k.key ? (
                <Kbd>{keyLabel(k.key)}</Kbd>
              ) : (
                <span className="text-xs text-fg-subtle">none</span>
              )}
            </button>
            <CommandPicker
              show={show}
              value={k.command}
              onChange={(c) => update((d) => void (d.inputs.keys[i]!.command = c))}
            />
            <IconButton
              label="Remove"
              icon={<Trash2 size={12} />}
              onClick={() => update((d) => void d.inputs.keys.splice(i, 1))}
            />
          </div>
        ),
      )}
    </Panel>
  );
}

function MidiPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const [devices, setDevices] = useState<string[] | null>(null);
  const [learning, setLearning] = useState(false);
  const [last, setLast] = useState<MidiEvent | null>(null);

  useEffect(() => {
    if (devices === null) return;
    let stop: (() => void) | null = null;
    void listenMidi(setLast, setDevices)
      .then((s) => (stop = s))
      .catch(errorToast);
    return () => stop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices === null]);

  useEffect(() => {
    if (!learning || !last) return;
    setLearning(false);
    const exists = show.inputs.midi.some(
      (m) => m.kind === last.kind && m.number === last.number && m.channel === last.channel,
    );
    if (exists) return void toast('That control is already mapped', 'error');
    update(
      (d) =>
        void d.inputs.midi.push({
          kind: last.kind,
          channel: last.channel,
          number: last.number,
          command: { type: 'go' },
        }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Piano size={14} /> MIDI
        </span>
      }
      bodyClassName="p-2"
      actions={
        devices === null ? (
          <Button size="sm" onClick={() => setDevices([])}>
            Connect MIDI
          </Button>
        ) : (
          <Button
            size="sm"
            variant={learning ? 'danger' : 'secondary'}
            icon={<Radio size={13} />}
            onClick={() => setLearning(!learning)}
          >
            {learning ? 'Press a pad or pedal…' : 'Learn'}
          </Button>
        )
      }
    >
      {devices !== null && (
        <p className="mb-2 text-xs text-fg-subtle">
          {devices.length
            ? `Connected: ${devices.join(', ')}`
            : 'No MIDI devices found. Plug one in; it is picked up automatically.'}
          {last && ` · Last: ${last.kind} ${last.number} ch ${last.channel}`}
        </p>
      )}
      {show.inputs.midi.length === 0 && (
        <Empty>
          Map foot pedals, pads and controllers to GO or to triggers. Click Learn, then press the
          control.
        </Empty>
      )}
      {show.inputs.midi.map((m, i) => (
        <div key={i} className="mb-1 flex items-center gap-2">
          <span className="w-32 font-mono text-xs text-fg-muted">
            {m.kind === 'note' ? 'Note' : 'CC'} {m.number} ·{' '}
            {m.channel === null ? 'any ch' : `ch ${m.channel}`}
          </span>
          <CommandPicker
            show={show}
            value={m.command}
            onChange={(c) => update((d) => void (d.inputs.midi[i]!.command = c))}
          />
          <IconButton
            label="Remove"
            icon={<Trash2 size={12} />}
            onClick={() => update((d) => void d.inputs.midi.splice(i, 1))}
          />
        </div>
      ))}
    </Panel>
  );
}

function GamepadPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const [learning, setLearning] = useState(false);
  const [pads, setPads] = useState<string[]>([]);

  useEffect(
    () =>
      listenGamepads((button) => {
        if (!learning) return;
        setLearning(false);
        if (show.inputs.gamepad.some((g) => g.button === button))
          return void toast('That button is already mapped', 'error');
        update((d) => void d.inputs.gamepad.push({ button, command: { type: 'go' } }));
      }, setPads),
    [learning, show.inputs.gamepad, update],
  );

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Gamepad2 size={14} /> Gamepads & pedals
        </span>
      }
      bodyClassName="p-2"
      actions={
        <Button
          size="sm"
          variant={learning ? 'danger' : 'secondary'}
          icon={<Radio size={13} />}
          onClick={() => setLearning(!learning)}
        >
          {learning ? 'Press a button…' : 'Learn'}
        </Button>
      }
    >
      <p className="mb-2 text-xs text-fg-subtle">
        {pads.length
          ? `Connected: ${pads.join(', ')}`
          : 'Press any button on a controller to connect it.'}
      </p>
      {show.inputs.gamepad.map((g, i) => (
        <div key={i} className="mb-1 flex items-center gap-2">
          <span className="w-32 font-mono text-xs text-fg-muted">Button {g.button}</span>
          <CommandPicker
            show={show}
            value={g.command}
            onChange={(c) => update((d) => void (d.inputs.gamepad[i]!.command = c))}
          />
          <IconButton
            label="Remove"
            icon={<Trash2 size={12} />}
            onClick={() => update((d) => void d.inputs.gamepad.splice(i, 1))}
          />
        </div>
      ))}
    </Panel>
  );
}
