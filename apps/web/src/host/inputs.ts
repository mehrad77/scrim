import type { Command, Inputs } from '@scrim/format';

export interface MidiEvent {
  kind: 'note' | 'cc';
  channel: number;
  number: number;
  device: string;
}

/** Turn a raw MIDI message into a press event: note-on, or a CC crossing 64 upward. */
export function parseMidi(
  data: Uint8Array,
  lastCc: Map<string, number>,
  device: string,
): MidiEvent | null {
  const [status = 0, number = 0, value = 0] = data;
  const type = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  if (type === 0x90 && value > 0) return { kind: 'note', channel, number, device };
  if (type === 0xb0) {
    const key = `${device}:${channel}:${number}`;
    const prev = lastCc.get(key) ?? 0;
    lastCc.set(key, value);
    if (prev < 64 && value >= 64) return { kind: 'cc', channel, number, device };
  }
  return null;
}

export function midiCommand(inputs: Inputs, e: MidiEvent): Command | null {
  const m = inputs.midi.find(
    (x) =>
      x.kind === e.kind && x.number === e.number && (x.channel === null || x.channel === e.channel),
  );
  return m?.command ?? null;
}

export function keyCommand(inputs: Inputs, key: string): Command | null {
  const k = key.length === 1 ? key.toLowerCase() : key;
  return (
    inputs.keys.find((x) => (x.key.length === 1 ? x.key.toLowerCase() : x.key) === k)?.command ??
    null
  );
}

export function keyLabel(key: string): string {
  if (key === ' ') return 'Space';
  if (key.startsWith('Arrow'))
    return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[key] ?? key;
  if (key === 'Escape') return 'Esc';
  return key.length === 1 ? key.toUpperCase() : key;
}

export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Listen to every MIDI input, including ones plugged in later. */
export async function listenMidi(
  onEvent: (e: MidiEvent) => void,
  onDevices?: (names: string[]) => void,
): Promise<() => void> {
  if (!navigator.requestMIDIAccess) throw new Error('This browser has no Web MIDI support');
  const access = await navigator.requestMIDIAccess();
  const lastCc = new Map<string, number>();
  const bind = () => {
    for (const input of access.inputs.values()) {
      input.onmidimessage = (m) => {
        if (!m.data) return;
        const e = parseMidi(m.data, lastCc, input.name ?? input.id);
        if (e) onEvent(e);
      };
    }
    onDevices?.([...access.inputs.values()].map((i) => i.name ?? i.id));
  };
  bind();
  access.onstatechange = bind;
  return () => {
    access.onstatechange = null;
    for (const input of access.inputs.values()) input.onmidimessage = null;
  };
}

/** Poll gamepads and report button presses (rising edges). */
export function listenGamepads(
  onPress: (button: number, pad: string) => void,
  onDevices?: (names: string[]) => void,
): () => void {
  const prev = new Map<number, boolean[]>();
  let names = '';
  let raf = 0;
  const loop = () => {
    const pads = navigator.getGamepads?.() ?? [];
    const list: string[] = [];
    for (const pad of pads) {
      if (!pad) continue;
      list.push(pad.id);
      const before = prev.get(pad.index) ?? [];
      const now = pad.buttons.map((b) => b.pressed);
      now.forEach((pressed, i) => pressed && !before[i] && onPress(i, pad.id));
      prev.set(pad.index, now);
    }
    const joined = list.join('|');
    if (joined !== names) {
      names = joined;
      onDevices?.(list);
    }
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => cancelAnimationFrame(raf);
}

export function describeCommand(c: Command, triggers: { id: string; name: string }[]): string {
  switch (c.type) {
    case 'go':
      return 'GO';
    case 'panic':
      return 'Panic (blackout)';
    case 'hold':
      return 'Hold / resume';
    case 'standbyNext':
      return 'Standby next cue';
    case 'standbyPrev':
      return 'Standby previous cue';
    case 'trigger':
      return `Trigger: ${triggers.find((t) => t.id === c.triggerId)?.name ?? 'missing'}`;
  }
}
