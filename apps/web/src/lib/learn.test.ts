import { checkLogic } from './logic.js';
import { parseShow } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import { learnSteps } from './learn.js';
import { STARTERS } from './starters.js';

describe('starters', () => {
  it.each(STARTERS.map((s) => [s.id, s] as const))(
    '%s is a valid show with clean logic',
    (_, s) => {
      const show = s.make();
      expect(() => parseShow(JSON.parse(JSON.stringify(show)))).not.toThrow();
      expect(checkLogic(show).map((i) => i.text)).toEqual([]);
    },
  );
});

describe('learn checklist', () => {
  it('ticks steps from what the person did', () => {
    const show = STARTERS[0]!.make();
    const demo = { id: show.id, inputs: JSON.stringify(show.inputs) };
    const run = (texts: [string, string][], cuesFired = 0) => ({
      id: 'r',
      showId: show.id,
      showName: show.name,
      startedAt: 0,
      endedAt: 0,
      cuesFired,
      entries: texts.map(([kind, text]) => ({ at: 0, kind, text })),
    });
    const done = (runs: ReturnType<typeof run>[]) =>
      learnSteps(show, runs as never, demo)
        .filter((s) => s.done)
        .map((s) => s.id);
    expect(done([])).toEqual(['open']);
    expect(
      done([
        run(
          [
            ['moment', 'Closed "Which way": Path A'],
            ['info', 'Show mode: editing locked'],
          ],
          3,
        ),
      ]),
    ).toEqual(['open', 'go', 'vote', 'show']);
    expect(done([run([['moment', 'Closed "Which way": a (default — no input)']])])).toEqual([
      'open',
    ]);
  });
});
