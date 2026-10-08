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

/** Esc is PANIC whatever the show's key map says; a show can add more panic keys, not remove this one. */
export const PANIC_KEY = 'Escape';

/** Physical key names (`KeyboardEvent.code`), which new bindings store so they survive layouts. */
const CODE =
  /^(Key[A-Z]|Digit\d|Numpad\w+|Arrow(Up|Down|Left|Right)|F\d{1,2}|Space|Escape|Enter|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Bracket(Left|Right)|Semicolon|Quote|Backquote|Backslash|IntlBackslash|Comma|Period|Slash|Minus|Equal)$/;

export const isKeyCode = (s: string) => CODE.test(s);

/** Best guess at the physical key for a key value, when only the value is known. */
export function keyToCode(key: string): string {
  if (key === ' ') return 'Space';
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^\d$/.test(key)) return `Digit${key}`;
  return key;
}

const norm = (k: string) => (k.length === 1 ? k.toLowerCase() : k);

/**
 * Does a stored binding match this key press? Bindings saved as a code (`KeyH`, `Space`) match
 * the physical key; older bindings saved as a value (`h`, `' '`) match the typed character.
 */
export function keyMatches(binding: string, key: string, code?: string): boolean {
  return isKeyCode(binding) ? binding === (code ?? keyToCode(key)) : norm(binding) === norm(key);
}

/** Whether two bindings name the same key, for conflict checks. */
export function sameKey(a: string, b: string): boolean {
  const code = (k: string) => (isKeyCode(k) ? k : keyToCode(norm(k)));
  return code(a) === code(b);
}

export function keyCommand(inputs: Inputs, key: string, code?: string): Command | null {
  if (key === PANIC_KEY || code === PANIC_KEY) return { type: 'panic' };
  return inputs.keys.find((x) => keyMatches(x.key, key, code))?.command ?? null;
}

const LABELS: Record<string, string> = {
  ' ': 'Space',
  Space: 'Space',
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: '⌫',
  Enter: '↵',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Backslash: '\\',
  IntlBackslash: '\\',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '-',
  Equal: '=',
  PageUp: 'Page ↑',
  PageDown: 'Page ↓',
};

/** How a binding reads on buttons and in the `?` sheet: "Space", "H", "↓", "[". */
export function keyLabel(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const m = /^(?:Key([A-Z])|Digit(\d)|Numpad(\w+))$/.exec(key);
  if (m) return m[1] ?? m[2] ?? `Num ${m[3]}`;
  return key.length === 1 ? key.toUpperCase() : key;
}

const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

/**
 * True only while the user is entering free text, where show keys must not fire. Selects,
 * checkboxes, sliders and buttons never pause GO.
 */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && TEXT_INPUTS.has((el as HTMLInputElement).type);
}

/** True while a modal dialog or an overlay is open, so Esc should close it first (editor only). */
export function overlayOpen(): boolean {
  return document.querySelector('dialog[open], [data-overlay-open]') !== null;
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
    case 'back':
      return 'Back (undo the last GO)';
    case 'standbyNext':
      return 'Standby next cue';
    case 'standbyPrev':
      return 'Standby previous cue';
    case 'trigger':
      return `Trigger: ${triggers.find((t) => t.id === c.triggerId)?.name ?? 'missing'}`;
  }
}
