import { initialState, step } from '@scrim/engine';
import { createCue, createShow, type Show } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import { accessView, usesAccess } from './access.js';

function captioned(): Show {
  const show = createShow('Access');
  const scene = show.scenes[0]!.id;
  show.languages = { base: 'en', others: ['fr', 'ar'] };
  show.cues = [
    {
      ...createCue(scene, 'Hello'),
      id: 'c1',
      access: {
        caption: 'Hello there.',
        description: 'A lamp flickers.',
        i18n: { fr: { caption: 'Bonjour.' } },
      },
    },
    {
      ...createCue(scene, 'Bang'),
      id: 'c2',
      access: { warning: 'A loud bang', buzz: true, i18n: { ar: { warning: 'صوت عالٍ' } } },
    },
  ];
  return show;
}

describe('access view', () => {
  it('is nothing for a show that does not use the channel', () => {
    const show = createShow('Plain');
    expect(usesAccess(show)).toBe(false);
    expect(accessView(show, initialState(show))).toBeNull();
  });

  it('carries every language of the caption, the latest description and the standby warning', () => {
    const show = captioned();
    const s = step(show, initialState(show), { type: 'go' }, 0).state;
    expect(accessView(show, s)).toEqual({
      languages: { base: 'en', others: ['fr', 'ar'] },
      caption: { text: 'Hello there.', i18n: { fr: 'Bonjour.' } },
      description: { text: 'A lamp flickers.', i18n: {}, seq: 1 },
      // c2 is on standby: its warning shows before it comes.
      warning: { text: 'A loud bang', i18n: { ar: 'صوت عالٍ' } },
      buzz: 0,
    });
    const after = step(show, s, { type: 'go' }, 10).state;
    expect(accessView(show, after)).toMatchObject({
      caption: { text: 'Hello there.' },
      warning: null,
      buzz: 1,
    });
  });

  it('tells phones about a relaxed performance, even in a show with nothing else to say', () => {
    const show = createShow('Plain');
    const on = step(show, initialState(show), { type: 'relaxed', on: true }, 0).state;
    expect(accessView(show, on)).toMatchObject({ relaxed: true, caption: null });
    const off = step(show, on, { type: 'relaxed', on: false }, 10).state;
    // Null goes to phones too, so they hear that it ended.
    expect(accessView(show, off)).toBeNull();
  });
});
