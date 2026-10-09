import type { MomentSpec } from '@scrim/protocol';
import { describe, expect, it } from 'vitest';
import { Aggregator } from './aggregate.js';

const base = { min: 0, max: 10, variants: [], options: [], moderated: true, closesAt: null };
const vote: MomentSpec = {
  ...base,
  id: 'v',
  type: 'vote',
  prompt: 'Door?',
  options: [
    { id: 'l', label: 'Left' },
    { id: 'r', label: 'Right' },
  ],
};

describe('Aggregator', () => {
  it('counts one vote per phone, last vote wins', () => {
    const a = new Aggregator();
    a.setOpen('Show', [vote]);
    a.input('p1', { t: 'vote', momentId: 'v', optionId: 'l' }, 0);
    a.input('p1', { t: 'vote', momentId: 'v', optionId: 'r' }, 0);
    a.input('p2', { t: 'vote', momentId: 'v', optionId: 'r' }, 0);
    expect(a.input('p3', { t: 'vote', momentId: 'v', optionId: 'zzz' }, 0)).toBe(false);
    expect(a.takeTotals()[0]).toMatchObject({ tally: { r: 2 }, n: 2 });
    expect(a.dirty).toBe(false);
  });

  it('ignores input after the moment closes or for unknown moments', () => {
    const a = new Aggregator();
    a.setOpen('Show', [{ ...vote, closesAt: 1000 }]);
    expect(a.input('p', { t: 'vote', momentId: 'v', optionId: 'l' }, 2000)).toBe(false);
    expect(a.input('p', { t: 'vote', momentId: 'x', optionId: 'l' }, 0)).toBe(false);
  });

  it('rate-limits taps', () => {
    const a = new Aggregator();
    a.setOpen('Show', [{ ...base, id: 't', type: 'tap', prompt: 'Tap!' }]);
    for (let i = 0; i < 10; i++) a.input('p', { t: 'tap', momentId: 't', count: 5 }, 0);
    expect(a.takeTotals()[0]!.count).toBe(15);
    a.input('p', { t: 'tap', momentId: 't', count: 50 }, 1000);
    expect(a.takeTotals()[0]!.count).toBe(30);
  });

  it('clamps sliders and reports sums', () => {
    const a = new Aggregator();
    a.setOpen('Show', [{ ...base, id: 's', type: 'slider', prompt: 'Fear?' }]);
    a.input('p1', { t: 'slider', momentId: 's', value: 4 }, 0);
    a.input('p2', { t: 'slider', momentId: 's', value: 99 }, 0);
    expect(a.takeTotals()[0]).toMatchObject({ sum: 14, sumSq: 116, n: 2 });
  });

  it('sends only new text entries, and all of them after a reconnect', () => {
    const a = new Aggregator();
    a.setOpen('Show', [{ ...base, id: 'n', type: 'text', prompt: 'Name?' }]);
    a.input('p1', { t: 'text', momentId: 'n', text: 'Ada' }, 0);
    expect(a.takeTotals()[0]!.entries).toHaveLength(1);
    a.input('p2', { t: 'text', momentId: 'n', text: 'Bo' }, 0);
    expect(a.takeTotals()[0]!.entries.map((e) => e.text)).toEqual(['Bo']);
    expect(a.takeTotals(true)[0]!.entries).toHaveLength(2);
    for (let i = 0; i < 5; i++) a.input('p3', { t: 'text', momentId: 'n', text: 'spam' }, 0);
    expect(a.takeTotals()[0]!.entries).toHaveLength(3);
  });

  it('assigns each phone a stable personal prop and survives a snapshot', () => {
    const a = new Aggregator(undefined, () => 0.9);
    a.setOpen('Show', [
      {
        ...base,
        id: 'p',
        type: 'prop',
        prompt: 'Your role',
        variants: [
          { id: 'a', label: 'Spy', content: 'You are the spy', weight: 1 },
          { id: 'b', label: 'Guest', content: 'Enjoy', weight: 3 },
        ],
      },
    ]);
    expect(a.publicView('x')[0]!.prop?.label).toBe('Guest');
    const b = new Aggregator(JSON.parse(JSON.stringify(a.snapshot())), () => 0);
    expect(b.publicView('x')[0]!.prop?.label).toBe('Guest');
    expect(b.publicView('y')[0]!.prop?.label).toBe('Spy');
    expect(b.takeTotals(true)[0]!.tally).toEqual({ a: 1, b: 1 });
  });

  it('counts each ballot of a shared tablet as its own person, up to a cap', () => {
    const a = new Aggregator();
    a.setOpen('Show', [vote]);
    // One tablet, passed around: three people, the third changes their mind.
    a.input('tab', { t: 'vote', momentId: 'v', optionId: 'l' }, 0, 1);
    a.input('tab', { t: 'vote', momentId: 'v', optionId: 'r' }, 0, 2);
    a.input('tab', { t: 'vote', momentId: 'v', optionId: 'l' }, 0, 3);
    a.input('tab', { t: 'vote', momentId: 'v', optionId: 'r' }, 0, 3);
    // Without a ballot, the tablet itself is one more person.
    a.input('tab', { t: 'vote', momentId: 'v', optionId: 'r' }, 0);
    expect(a.takeTotals()[0]).toMatchObject({ tally: { l: 1, r: 3 }, n: 4 });

    const b = new Aggregator();
    b.setOpen('Show', [vote]);
    for (let i = 0; i < 1000; i++)
      b.input('tab', { t: 'vote', momentId: 'v', optionId: 'l' }, 0, i);
    expect(b.input('tab', { t: 'vote', momentId: 'v', optionId: 'l' }, 0, 1000)).toBe(false);
    // Someone already counted can still change their answer.
    expect(b.input('tab', { t: 'vote', momentId: 'v', optionId: 'r' }, 0, 5)).toBe(true);
  });
});
