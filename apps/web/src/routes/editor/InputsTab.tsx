import type { Command, JumpTarget, Show } from '@scrim/format';
import { Gamepad2, Keyboard, ListMusic, Piano, Plus, Radio, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  keyLabel,
  sameKey,
  listenGamepads,
  listenMidi,
  midiLabel,
  PANIC_KEY,
  type MidiEvent,
} from '../../host/inputs.js';
import { sectionsOf } from '../../lib/jumps.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { Select, Toggle } from '../../ui/Field.js';
import { Empty, Kbd, Panel } from '../../ui/Panel.js';
import { errorToast, toast } from '../../ui/toast.js';
import { SectionInput } from './SectionInput.js';

export function InputsTab() {
  return (
    <div className="grid h-full grid-cols-3 gap-px bg-line-subtle">
      <KeysPanel />
      <MidiPanel />
      <GamepadPanel />
    </div>
  );
}

function encode(c: Command): string {
  if (c.type === 'trigger') return `trigger:${c.triggerId}`;
  if (c.type === 'countVote') return `count:${c.option}`;
  if (c.type !== 'jump') return c.type;
  const t = c.target;
  return t.to === 'scene'
    ? `jump:scene:${t.sceneId}`
    : t.to === 'cue'
      ? `jump:cue:${t.cueId}`
      : `jump:${t.to}`;
}

/** The command a picker value stands for; a jump keeps the section and "fire" it had. */
function decode(v: string, prev: Command, show: Show): Command {
  if (v.startsWith('trigger:')) return { type: 'trigger', triggerId: v.slice(8) };
  if (v.startsWith('count:')) return { type: 'countVote', option: Number(v.slice(6)) };
  if (!v.startsWith('jump:'))
    return { type: v as Exclude<Command['type'], 'trigger' | 'jump' | 'countVote'> };
  const [, to = '', id = ''] = v.split(':');
  const was = prev.type === 'jump' ? prev : null;
  const target: JumpTarget =
    to === 'scene'
      ? { to, sceneId: id }
      : to === 'cue'
        ? { to, cueId: id }
        : to === 'section'
          ? {
              to,
              section:
                was?.target.to === 'section'
                  ? was.target.section
                  : (sectionsOf(show)[0] ?? 'Chorus'),
            }
          : { to: to as 'nextScene' | 'prevScene' | 'restartScene' };
  return { type: 'jump', target, fire: was?.fire ?? false };
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
  const jump = value.type === 'jump' ? value : null;
  const cue = jump?.target.to === 'cue' ? jump.target.cueId : null;
  // A jump's section and "fire" wrap under the command when the column is narrow.
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
      <Select
        className="w-48"
        value={encode(value)}
        onChange={(e) => onChange(decode(e.target.value, value, show))}
      >
        <option value="go">GO</option>
        <option value="panic">Panic (blackout)</option>
        <option value="hold">Hold / resume</option>
        <option value="back">Back (undo the last GO)</option>
        <option value="standbyNext">Standby next cue</option>
        <option value="standbyPrev">Standby previous cue</option>
        <optgroup label="Beside PANIC">
          <option value="clearText">Clear text (again: bring it back)</option>
          <option value="clearMedia">Clear pictures and video (again: bring them back)</option>
          <option value="mute">Mute / unmute sound</option>
        </optgroup>
        {show.triggers.length > 0 && (
          <optgroup label="Triggers">
            {show.triggers.map((t) => (
              <option key={t.id} value={`trigger:${t.id}`}>
                {t.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Count a vote (people without a phone)">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={`count:${n}`}>
              Vote for option {n} (or a tap)
            </option>
          ))}
        </optgroup>
        <optgroup label="Jump (tonight's running order)">
          <option value="jump:nextScene">Next scene</option>
          <option value="jump:prevScene">Previous scene</option>
          <option value="jump:restartScene">This scene again</option>
          <option value="jump:section">Section of this scene…</option>
          {show.scenes.map((s) => (
            <option key={s.id} value={`jump:scene:${s.id}`}>
              Scene: {s.name}
            </option>
          ))}
          {cue !== null && (
            <option value={`jump:cue:${cue}`}>
              Cue: {show.cues.find((c) => c.id === cue)?.name ?? 'deleted'}
            </option>
          )}
        </optgroup>
      </Select>
      {jump?.target.to === 'section' && (
        <SectionInput
          show={show}
          className="w-28"
          value={jump.target.section}
          onCommit={(section) => onChange({ ...jump, target: { to: 'section', section } })}
        />
      )}
      {jump && (
        <span data-info="On: fire it at once, like GO. Off: put it on standby.">
          <Toggle
            checked={jump.fire}
            onChange={(fire) => onChange({ ...jump, fire })}
            label={<span className="text-caption">fire</span>}
          />
        </span>
      )}
    </div>
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
      // Store the physical key, so the map survives non-US layouts.
      const key = e.code || e.key;
      if (key === PANIC_KEY) {
        toast('Esc is always Panic. Pick another key.', 'error');
      } else if (show.inputs.keys.some((k, i) => sameKey(k.key, key) && i !== recording)) {
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
      <p className="mb-2 text-caption text-fg-subtle">
        Keys work in the operator view and in output windows. Panic also works from the editor.
      </p>
      <label
        className="mb-3 flex items-center gap-2 text-caption text-fg-muted"
        data-info="Against accidental presses, for shaky hands and nervous volunteers. Applies to keys, pedals, pads and the GO button."
      >
        GO fires
        <Select
          className="w-44"
          value={String(show.operator?.goHoldMs ?? 0)}
          onChange={(e) =>
            update((d) => {
              const ms = Number(e.target.value);
              d.operator = { ...d.operator, goHoldMs: ms };
              if (!ms) delete d.operator.goHoldMs;
            })
          }
        >
          <option value="0">on press</option>
          <option value="300">after a 0.3 s hold</option>
          <option value="500">after a 0.5 s hold</option>
          <option value="1000">after a 1 s hold</option>
        </Select>
      </label>
      <label
        className="mb-3 flex items-center gap-2 text-caption text-fg-muted"
        data-info="Simple: one huge GO, now and next, Hold, Back and PANIC, sized for a tablet. The operator can switch in Rehearsal."
      >
        Operator view
        <Select
          className="w-44"
          value={show.operator?.layout ?? 'full'}
          onChange={(e) =>
            update((d) => {
              d.operator = { ...d.operator, layout: e.target.value as 'full' | 'simple' };
              if (d.operator.layout === 'full') delete d.operator.layout;
            })
          }
        >
          <option value="full">Full</option>
          <option value="simple">Simple, for touch</option>
        </Select>
      </label>
      <div
        className="mb-3"
        data-info="For a leader facing the room with a tablet. GO then goes over the network, so keep a key or pedal on the show machine as well."
      >
        <Toggle
          checked={!!show.operator?.remoteGo}
          onChange={(on) =>
            update((d) => {
              d.operator = { ...d.operator, remoteGo: on };
              if (!on) delete d.operator.remoteGo;
            })
          }
          label={
            <span className="text-caption">Performer remotes can press GO, Hold and Back</span>
          }
        />
      </div>
      <div
        className="mb-1 flex items-center gap-2"
        data-info="Esc always fires Panic, in every window"
      >
        <span className="w-24 py-1 text-center">
          <Kbd>Esc</Kbd>
        </span>
        <span className="text-ui text-fg-muted">Panic (blackout)</span>
        <span className="ml-auto text-caption text-fg-subtle">Always on</span>
      </div>
      {show.inputs.keys.map((k, i) =>
        k.key === PANIC_KEY ? null : (
          <div key={i} className="mb-1 flex items-center gap-2">
            <button
              className="w-24 rounded-control border border-line-subtle py-1 text-center hover:border-fg-subtle"
              onClick={() => setRecording(i)}
              data-info="Click, then press a key"
            >
              {recording === i ? (
                <span className="text-caption text-accent-text">Press a key…</span>
              ) : k.key ? (
                <Kbd>{keyLabel(k.key)}</Kbd>
              ) : (
                <span className="text-caption text-fg-subtle">none</span>
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
    // Learn takes presses, never the release that follows them.
    void listenMidi((e) => !e.release && setLast(e), setDevices)
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
        <p className="mb-2 text-caption text-fg-subtle">
          {devices.length
            ? `Connected: ${devices.join(', ')}`
            : 'No MIDI devices found. Plug one in; it is picked up automatically.'}
          {last && ` · Last: ${midiLabel(last)} ch ${last.channel}`}
        </p>
      )}
      {show.inputs.midi.length === 0 && (
        <Empty>
          Map foot pedals, pads and controllers to GO or to triggers. Click Learn, then press the
          control.
        </Empty>
      )}
      {show.scenes.length > 1 && (
        <Button
          size="sm"
          className="mb-2"
          icon={<ListMusic size={13} />}
          data-info="For a playback rig that sends a program change at the start of each song"
          onClick={() => {
            const free = (n: number) =>
              !show.inputs.midi.some((m) => m.kind === 'program' && m.number === n);
            const scenes = show.scenes.filter((_, i) => free(i));
            if (!scenes.length) return void toast('Every scene already has a program change');
            update((d) => {
              d.scenes.forEach((scene, i) => {
                if (free(i))
                  d.inputs.midi.push({
                    kind: 'program',
                    channel: null,
                    number: i,
                    command: {
                      type: 'jump',
                      target: { to: 'scene', sceneId: scene.id },
                      fire: true,
                    },
                  });
              });
            });
            toast(`Program 1–${show.scenes.length} now start scenes 1–${show.scenes.length}`);
          }}
        >
          Program changes start scenes
        </Button>
      )}
      {show.inputs.midi.map((m, i) => (
        <div key={i} className="mb-1 flex items-center gap-2">
          <span className="w-32 font-mono text-caption text-fg-muted">
            {midiLabel(m)} · {m.channel === null ? 'any ch' : `ch ${m.channel}`}
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
      <p className="mb-2 text-caption text-fg-subtle">
        {pads.length
          ? `Connected: ${pads.join(', ')}`
          : 'Press any button on a controller to connect it.'}
      </p>
      {show.inputs.gamepad.map((g, i) => (
        <div key={i} className="mb-1 flex items-center gap-2">
          <span className="w-32 font-mono text-caption text-fg-muted">Button {g.button}</span>
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
