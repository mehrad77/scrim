import { createShow, type Show } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import {
  counterValue,
  Engine,
  initialState,
  interpolate,
  mediaPosition,
  nextWakeup,
  step,
  tweenValue,
  type EngineInput,
  type EngineState,
} from './index.js';

/** A small interactive show: intro, a vote, then two branches. */
function demo(): Show {
  const show = createShow('Demo');
  const out = show.outputs[0]!.id;
  show.scenes = [
    { id: 'intro', name: 'Intro' },
    { id: 'left', name: 'Cellar' },
    { id: 'right', name: 'Attic' },
  ];
  show.layers = [
    {
      id: 'title',
      name: 'Title',
      kind: 'text',
      outputId: out,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      z: 0,
      opacity: 0.8,
      visible: false,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      text: 'Door: {{door}}',
      fontSize: 72,
      color: '#fff',
      fontFamily: 'x',
      fontWeight: 600,
      align: 'center',
      background: 'transparent',
    },
    {
      id: 'vid',
      name: 'Video',
      kind: 'video',
      outputId: out,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      z: 1,
      opacity: 1,
      visible: false,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      mediaId: 'm',
      fit: 'contain',
      loop: false,
      volume: 1,
      bus: 'main',
    },
    {
      id: 'clock',
      name: 'Clock',
      kind: 'counter',
      outputId: out,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      z: 2,
      opacity: 1,
      visible: true,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      mode: 'countdown',
      start: 60,
      format: 'clock',
      fontSize: 72,
      color: '#fff',
      fontFamily: 'x',
      fontWeight: 600,
      align: 'center',
      background: 'transparent',
    },
  ];
  show.vars = [
    { id: 'door', name: 'door', type: 'choice', initial: '', options: ['left', 'right'] },
    { id: 'tally', name: 'tally', type: 'tally', initial: {} },
    { id: 'score', name: 'score', type: 'number', initial: 0 },
  ];
  show.moments = [
    {
      id: 'vote',
      name: 'Which door?',
      type: 'vote',
      prompt: 'Which door?',
      options: [
        { id: 'left', label: 'Left' },
        { id: 'right', label: 'Right' },
      ],
      min: 0,
      max: 10,
      variants: [],
      durationSec: 30,
      resultVarId: 'door',
      tallyVarId: 'tally',
      defaultResult: 'right',
      moderated: true,
    },
  ];
  show.triggers = [{ id: 'bell', name: 'Bell', color: '#f00' }];
  const fade = { duration: 2, easing: 'linear' as const };
  show.cues = [
    {
      id: 'c1',
      sceneId: 'intro',
      name: 'Title up',
      actions: [
        { type: 'show', layerId: 'title', ...fade },
        { type: 'counter', layerId: 'clock', op: 'start' },
      ],
      follow: { auto: true, delay: 5 },
      notes: '',
      updatedAt: 0,
    },
    {
      id: 'c2',
      sceneId: 'intro',
      name: 'Open vote',
      actions: [
        { type: 'openMoment', momentId: 'vote' },
        { type: 'play', layerId: 'vid', restart: true },
      ],
      follow: { auto: false, delay: 0 },
      notes: '',
      updatedAt: 0,
    },
    {
      id: 'c3',
      sceneId: 'left',
      name: 'Cellar',
      actions: [{ type: 'hide', layerId: 'title', duration: 0, easing: 'linear' }],
      follow: { auto: false, delay: 0 },
      notes: '',
      updatedAt: 0,
    },
    {
      id: 'c4',
      sceneId: 'right',
      name: 'Attic',
      actions: [],
      follow: { auto: false, delay: 0 },
      notes: '',
      updatedAt: 0,
    },
  ];
  show.rules = [
    {
      id: 'r1',
      name: 'Branch on vote',
      enabled: true,
      when: { type: 'momentClosed', momentId: 'vote' },
      if: [{ varId: 'door', op: 'eq', value: 'left' }],
      then: [{ type: 'jumpScene', sceneId: 'left', fire: false }],
    },
    {
      id: 'r2',
      name: 'Branch right',
      enabled: true,
      when: { type: 'momentClosed', momentId: 'vote' },
      if: [{ varId: 'door', op: 'eq', value: 'right' }],
      then: [{ type: 'jumpScene', sceneId: 'right', fire: false }],
    },
    {
      id: 'r3',
      name: 'Bell scores',
      enabled: true,
      when: { type: 'trigger', triggerId: 'bell' },
      if: [],
      then: [{ type: 'addVar', varId: 'score', amount: 10 }],
    },
  ];
  return show;
}

function run(show: Show, inputs: [number, EngineInput][], state = initialState(show)): EngineState {
  for (const [t, input] of inputs) state = step(show, state, input, t).state;
  return state;
}

describe('cues', () => {
  it('GO fires the standby cue and fades layers on the clock', () => {
    const show = demo();
    const { state, events } = step(show, initialState(show), { type: 'go' }, 1000);
    expect(events[0]).toMatchObject({ type: 'cueFired', cueId: 'c1' });
    expect(state.standby).toBe('c2');
    const op = state.layers.title!.opacity;
    expect(tweenValue(op, 1000)).toBe(0);
    expect(tweenValue(op, 2000)).toBeCloseTo(0.4);
    expect(tweenValue(op, 3000)).toBeCloseTo(0.8);
  });

  it('auto-follows after the delay, and hold pauses the countdown', () => {
    const show = demo();
    let s = run(show, [[0, { type: 'go' }]]);
    expect(nextWakeup(s)).toBe(5000);
    s = run(
      show,
      [
        [2000, { type: 'hold', on: true }],
        [8000, { type: 'tick' }],
      ],
      s,
    );
    expect(s.lastFired).toBe('c1');
    s = run(show, [[10_000, { type: 'hold', on: false }]], s);
    expect(s.follow?.at).toBe(13_000);
    s = run(show, [[13_000, { type: 'tick' }]], s);
    expect(s.lastFired).toBe('c2');
  });

  it('standby moves within bounds', () => {
    const show = demo();
    let s = run(show, [[0, { type: 'standbyPrev' }]]);
    expect(s.standby).toBe('c1');
    s = run(
      show,
      [
        [0, { type: 'standbyNext' }],
        [0, { type: 'standbyNext' }],
        [0, { type: 'standbyNext' }],
        [0, { type: 'standbyNext' }],
      ],
      s,
    );
    expect(s.standby).toBe('c4');
  });

  it('panic blacks out and cancels follows; release restores', () => {
    const show = demo();
    let s = run(show, [
      [0, { type: 'go' }],
      [100, { type: 'panic' }],
    ]);
    expect(tweenValue(s.blackout, 100)).toBe(1);
    expect(s.follow).toBeNull();
    s = run(show, [[200, { type: 'release', fade: 1 }]], s);
    expect(tweenValue(s.blackout, 700)).toBeCloseTo(0.5);
  });
});

describe('media and counters', () => {
  it('tracks media position and pauses', () => {
    const show = demo();
    let s = run(show, [[0, { type: 'fireCue', cueId: 'c2' }]]);
    expect(mediaPosition(s.layers.vid!.media!, 2500)).toBe(2.5);
    s = run(show, [[3000, { type: 'mediaEnded', layerId: 'vid' }]], s);
    expect(s.layers.vid!.media!.playing).toBe(false);
    expect(s.layers.vid!.media!.position).toBe(3);
  });

  it('runs a countdown', () => {
    const show = demo();
    const s = run(show, [[0, { type: 'go' }]]);
    expect(counterValue(s.layers.clock!.counter!, 'countdown', 15_000)).toBe(45);
    expect(counterValue(s.layers.clock!.counter!, 'countdown', 90_000)).toBe(0);
  });

  it('stopAll fades out and pauses media after the fade', () => {
    const show = demo();
    show.cues[3]!.actions = [{ type: 'stopAll', duration: 2 }];
    let s = run(show, [
      [0, { type: 'fireCue', cueId: 'c2' }],
      [1000, { type: 'fireCue', cueId: 'c4' }],
    ]);
    expect(nextWakeup(s)).toBe(3000);
    s = run(show, [[3000, { type: 'tick' }]], s);
    expect(s.layers.vid!.media!.playing).toBe(false);
    expect(s.layers.vid!.media!.position).toBe(3);
  });
});

describe('audience moments and branching', () => {
  it('a vote result branches to the winning scene', () => {
    const show = demo();
    const s = run(show, [
      [0, { type: 'fireCue', cueId: 'c2' }],
      [1000, { type: 'momentAgg', momentId: 'vote', tally: { left: 12, right: 7 }, n: 19 }],
      [2000, { type: 'closeMoment', momentId: 'vote' }],
    ]);
    expect(s.vars.door).toBe('left');
    expect(s.vars.tally).toEqual({ left: 12, right: 7 });
    expect(s.standby).toBe('c3');
  });

  it('falls back to the default when no votes arrive before the timeout', () => {
    const show = demo();
    let s = run(show, [[0, { type: 'fireCue', cueId: 'c2' }]]);
    expect(nextWakeup(s)).toBe(30_000);
    const res = step(show, s, { type: 'tick' }, 30_000);
    s = res.state;
    expect(res.events).toContainEqual({
      type: 'momentClosed',
      momentId: 'vote',
      result: 'right',
      usedDefault: true,
    });
    expect(s.standby).toBe('c4');
  });

  it('the operator can override a result', () => {
    const show = demo();
    const s = run(show, [
      [0, { type: 'fireCue', cueId: 'c2' }],
      [1, { type: 'momentAgg', momentId: 'vote', tally: { right: 3 } }],
      [2, { type: 'closeMoment', momentId: 'vote', result: 'left' }],
    ]);
    expect(s.standby).toBe('c3');
  });

  it('moderates text entries', () => {
    const show = demo();
    show.vars.push({ id: 'names', name: 'names', type: 'list', initial: [] });
    show.moments.push({
      id: 'names',
      name: 'Names',
      type: 'text',
      prompt: 'Your name',
      options: [],
      min: 0,
      max: 10,
      variants: [],
      durationSec: 0,
      resultVarId: 'names',
      tallyVarId: null,
      defaultResult: '',
      moderated: true,
    });
    let s = run(show, [
      [0, { type: 'openMoment', momentId: 'names' }],
      [
        1,
        {
          type: 'momentAgg',
          momentId: 'names',
          entries: [
            { id: 'a', text: 'Ada' },
            { id: 'b', text: 'rude' },
          ],
        },
      ],
      [1, { type: 'momentAgg', momentId: 'names', entries: [{ id: 'a', text: 'Ada' }] }],
    ]);
    expect(s.moments.names!.entries).toHaveLength(2);
    expect(s.vars.names).toEqual([]);
    s = run(
      show,
      [
        [2, { type: 'moderate', momentId: 'names', entryId: 'a', approve: true }],
        [3, { type: 'moderate', momentId: 'names', entryId: 'b', approve: false }],
        [4, { type: 'closeMoment', momentId: 'names' }],
      ],
      s,
    );
    expect(s.vars.names).toEqual(['Ada']);
  });

  it('triggers fire rules', () => {
    const show = demo();
    const s = run(show, [
      [0, { type: 'trigger', triggerId: 'bell' }],
      [1, { type: 'trigger', triggerId: 'bell' }],
    ]);
    expect(s.vars.score).toBe(20);
  });

  it('stops runaway rule loops', () => {
    const show = demo();
    show.rules.push({
      id: 'loop',
      name: 'loop',
      enabled: true,
      when: { type: 'varChanged', varId: 'score' },
      if: [],
      then: [{ type: 'addVar', varId: 'score', amount: 1 }],
    });
    const { events } = step(show, initialState(show), { type: 'trigger', triggerId: 'bell' }, 0);
    expect(events.at(-1)).toMatchObject({ type: 'warning' });
  });

  it('traces every rule whose trigger matched, with the values it saw', () => {
    const show = demo();
    const s = run(show, [[0, { type: 'fireCue', cueId: 'c2' }]]);
    const { events } = step(show, s, { type: 'closeMoment', momentId: 'vote', result: 'right' }, 3);
    const traces = events.filter((e) => e.type === 'ruleEvaluated');
    expect(traces).toEqual([
      {
        type: 'ruleEvaluated',
        ruleId: 'r1',
        ran: false,
        checks: [{ varId: 'door', op: 'eq', expected: 'left', actual: 'right', ok: false }],
      },
      {
        type: 'ruleEvaluated',
        ruleId: 'r2',
        ran: true,
        checks: [{ varId: 'door', op: 'eq', expected: 'right', actual: 'right', ok: true }],
      },
    ]);
  });

  it('traces never trigger rules or count toward the loop cap', () => {
    const show = demo();
    // 150 chained rules: each fires the next. Traces double the event count but must not
    // trip the 200-event loop guard.
    show.rules = Array.from({ length: 150 }, (_, i) => ({
      id: `chain${i}`,
      name: `chain ${i}`,
      enabled: true,
      when: { type: 'varChanged' as const, varId: 'score' },
      if: [{ varId: 'score', op: 'eq' as const, value: i + 1 }],
      then: [{ type: 'addVar' as const, varId: 'score', amount: 1 }],
    }));
    const s = { ...initialState(show), vars: { ...initialState(show).vars, score: 0 } };
    const { state, events } = step(show, s, { type: 'setVar', varId: 'score', value: 1 }, 0);
    expect(state.vars.score).toBe(151);
    expect(events.some((e) => e.type === 'warning')).toBe(false);
  });

  it('conditional branch actions inside a cue', () => {
    const show = demo();
    show.cues[0]!.actions = [
      {
        type: 'branch',
        if: [{ varId: 'score', op: 'gte', value: 10 }],
        then: [{ type: 'setVar', varId: 'door', value: 'left' }],
        else: [{ type: 'setVar', varId: 'door', value: 'right' }],
      },
    ];
    expect(run(show, [[0, { type: 'go' }]]).vars.door).toBe('right');
    expect(
      run(show, [
        [0, { type: 'trigger', triggerId: 'bell' }],
        [1, { type: 'go' }],
      ]).vars.door,
    ).toBe('left');
  });
});

describe('Engine', () => {
  it('reconciles edits without losing the run', () => {
    let now = 0;
    const show = demo();
    const engine = new Engine(show, () => now);
    engine.dispatch({ type: 'go' });
    now = 100;
    engine.dispatch({ type: 'trigger', triggerId: 'bell' });
    const edited = {
      ...show,
      layers: show.layers.filter((l) => l.id !== 'vid'),
      vars: [...show.vars, { id: 'new', name: 'fresh', type: 'number' as const, initial: 5 }],
    };
    engine.setShow(edited);
    expect(engine.state.layers.vid).toBeUndefined();
    expect(engine.state.vars.score).toBe(10);
    expect(engine.state.vars.new).toBe(5);
    expect(engine.state.lastFired).toBe('c1');
    engine.dispose();
  });

  it('interpolates state into text', () => {
    const show = demo();
    const s = run(show, [[0, { type: 'setVar', varId: 'door', value: 'left' }]]);
    expect(interpolate('Door: {{door}} {{nope}}', show, s.vars)).toBe('Door: left {{nope}}');
  });
});

describe('back', () => {
  it('returns to the state before the last GO, fading over the cue’s fade', () => {
    const show = demo();
    const fired = run(show, [[1000, { type: 'go' }]]);
    expect(tweenValue(fired.layers.title!.opacity, 4000)).toBeCloseTo(0.8);
    expect(fired.standby).toBe('c2');

    const { state, events } = step(show, fired, { type: 'back' }, 4000);
    expect(events).toContainEqual({ type: 'back', cueId: 'c1', name: 'Title up' });
    expect(state.standby).toBe('c1');
    expect(state.lastFired).toBeNull();
    expect(state.follow).toBeNull();
    // Fades back down over the cue's 2 s fade, from where it is now.
    expect(tweenValue(state.layers.title!.opacity, 4000)).toBeCloseTo(0.8);
    expect(tweenValue(state.layers.title!.opacity, 5000)).toBeCloseTo(0.4);
    expect(tweenValue(state.layers.title!.opacity, 6000)).toBe(0);
    // One step only.
    expect(step(show, state, { type: 'back' }, 7000).events[0]).toMatchObject({
      type: 'warning',
    });
  });

  it('keeps the blackout and does not record auto-follows', () => {
    const show = demo();
    // GO fires c1, whose 5 s auto-follow then fires c2 on a tick.
    const followed = run(show, [
      [1000, { type: 'go' }],
      [6000, { type: 'tick' }],
      [7000, { type: 'panic' }],
    ]);
    expect(followed.lastFired).toBe('c2');
    expect(followed.back?.cueId).toBe('c1');
    const { state } = step(show, followed, { type: 'back' }, 8000);
    expect(state.standby).toBe('c1');
    expect(state.blackout.to).toBe(1);
  });
});

describe('action delays', () => {
  function delayed(): Show {
    const show = demo();
    show.cues[0]!.actions = [
      { type: 'show', layerId: 'title', duration: 0, easing: 'linear', delay: 2 },
    ];
    show.cues[0]!.follow = { auto: false, delay: 0 };
    return show;
  }

  it('starts an action its delay after the cue fires', () => {
    const show = delayed();
    const fired = run(show, [[1000, { type: 'go' }]]);
    expect(tweenValue(fired.layers.title!.opacity, 1500)).toBe(0);
    expect(nextWakeup(fired)).toBe(3000);
    const later = run(show, [[3000, { type: 'tick' }]], fired);
    expect(tweenValue(later.layers.title!.opacity, 3000)).toBeCloseTo(0.8);
    expect(later.timers).toHaveLength(0);
  });

  it('waits while held and is cancelled by PANIC', () => {
    const show = delayed();
    const held = run(show, [
      [1000, { type: 'go' }],
      [1500, { type: 'hold', on: true }],
      [3500, { type: 'tick' }],
    ]);
    expect(tweenValue(held.layers.title!.opacity, 3500)).toBe(0);
    // Resumed after 2.5 s held: due at 5.5 s instead of 3 s.
    const resumed = run(show, [[4000, { type: 'hold', on: false }]], held);
    expect(nextWakeup(resumed)).toBe(5500);
    const panicked = run(show, [[4100, { type: 'panic' }]], resumed);
    expect(panicked.timers).toHaveLength(0);
  });
});
