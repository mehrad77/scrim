import { createShow, defaultInputs } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import {
  describeCommand,
  keyCommand,
  keyLabel,
  keyMatches,
  midiCommand,
  midiLabel,
  parseMidi,
  sameKey,
} from './inputs.js';

describe('key bindings', () => {
  it('code bindings match the physical key on any layout', () => {
    // AZERTY: the key labelled A sits where QWERTY has Q.
    expect(keyMatches('KeyQ', 'a', 'KeyQ')).toBe(true);
    expect(keyMatches('KeyA', 'a', 'KeyQ')).toBe(false);
    expect(keyMatches('Space', ' ', 'Space')).toBe(true);
  });

  it('older value bindings still match the typed character', () => {
    expect(keyMatches('h', 'H', 'KeyH')).toBe(true);
    expect(keyMatches(' ', ' ', 'Space')).toBe(true);
    // A window that only sends the value still finds code bindings.
    expect(keyMatches('KeyH', 'h')).toBe(true);
  });

  it('Esc is always PANIC and the defaults work', () => {
    const inputs = defaultInputs();
    expect(keyCommand({ ...inputs, keys: [] }, 'Escape', 'Escape')).toEqual({ type: 'panic' });
    expect(keyCommand(inputs, ' ', 'Space')).toEqual({ type: 'go' });
    expect(keyCommand(inputs, 'h', 'KeyH')).toEqual({ type: 'hold' });
  });

  it('labels and conflicts read the same for codes and values', () => {
    expect([keyLabel('Space'), keyLabel(' '), keyLabel('KeyH'), keyLabel('BracketLeft')]).toEqual([
      'Space',
      'Space',
      'H',
      '[',
    ]);
    expect(sameKey('h', 'KeyH')).toBe(true);
    expect(sameKey(' ', 'Space')).toBe(true);
    expect(sameKey('KeyH', 'KeyJ')).toBe(false);
  });
});

describe('MIDI', () => {
  it('reads note-on, a CC crossing 64 upward and a program change', () => {
    const cc = new Map<string, number>();
    expect(parseMidi(new Uint8Array([0x90, 36, 100]), cc, 'pad')).toMatchObject({
      kind: 'note',
      number: 36,
      channel: 1,
    });
    // Note-on with no velocity is a note-off: the end of the press.
    expect(parseMidi(new Uint8Array([0x90, 36, 0]), cc, 'pad')).toMatchObject({ release: true });
    expect(parseMidi(new Uint8Array([0x80, 36, 64]), cc, 'pad')).toMatchObject({ release: true });
    expect(parseMidi(new Uint8Array([0xb0, 64, 127]), cc, 'pedal')).toMatchObject({ kind: 'cc' });
    expect(parseMidi(new Uint8Array([0xb0, 64, 127]), cc, 'pedal')).toBeNull();
    expect(parseMidi(new Uint8Array([0xb0, 64, 0]), cc, 'pedal')).toMatchObject({ release: true });
    expect(parseMidi(new Uint8Array([0xc2, 4]), cc, 'rig')).toEqual({
      kind: 'program',
      number: 4,
      channel: 3,
      device: 'rig',
    });
    expect(midiLabel({ kind: 'program', number: 4 })).toBe('Program 5');
  });

  it('maps a program change to a jump that fires a scene', () => {
    const show = createShow('Gig');
    const sceneId = show.scenes[0]!.id;
    show.inputs.midi.push({
      kind: 'program',
      channel: null,
      number: 0,
      command: { type: 'jump', target: { to: 'scene', sceneId }, fire: true },
    });
    const c = midiCommand(show.inputs, { kind: 'program', number: 0, channel: 9, device: 'rig' });
    expect(c && describeCommand(c, show)).toBe(`Scene “${show.scenes[0]!.name}”, fired`);
    expect(midiCommand(show.inputs, { kind: 'note', number: 0, channel: 1, device: 'rig' })).toBe(
      null,
    );
  });
});
