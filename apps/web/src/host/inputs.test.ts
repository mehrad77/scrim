import { defaultInputs } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import { keyCommand, keyLabel, keyMatches, sameKey } from './inputs.js';

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
