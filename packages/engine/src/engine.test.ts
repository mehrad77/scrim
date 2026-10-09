import {
  createCue,
  createShow,
  layerTree,
  type Action,
  type Layer,
  type Show,
} from '@scrim/format';
import { describe, expect, it } from 'vitest';
import {
  accessText,
  counterValue,
  currentCaption,
  effectiveOpacity,
  Engine,
  formatValue,
  formatVar,
  initialState,
  interpolate,
  mediaPosition,
  nextWakeup,
  optionLabels,
  reconcile,
  relaxedBrightness,
  runOrder,
  sceneSequence,
  soundLevel,
  step,
  tweenValue,
  valueLines,
  type EngineEvent,
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
    expect(interpolate('Door: {{door}} {{nope}}', show, s.vars)).toBe('Door: Left {{nope}}');
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

describe('secondary clears', () => {
  const play = (layerId: string): EngineInput => ({
    type: 'action',
    action: { type: 'play', layerId, restart: true },
  });
  const show = (layerId: string, delay?: number): EngineInput => ({
    type: 'action',
    action: { type: 'show', layerId, duration: 0, easing: 'linear', ...(delay ? { delay } : {}) },
  });

  it('clear text fades text and counters out, leaves video, and undo brings them back', () => {
    const s0 = run(demo(), [
      [0, { type: 'fireCue', cueId: 'c1' }],
      [10, show('vid')],
    ]);
    const { state, events } = step(demo(), s0, { type: 'clear', what: 'text' }, 5000);
    expect(state.layers.title!.opacity.to).toBe(0);
    expect(state.layers.clock!.opacity.to).toBe(0);
    expect(state.layers.vid!.opacity.to).toBe(1);
    expect(events).toContainEqual({ type: 'cleared', what: 'text', layers: 2 });

    const back = step(demo(), state, { type: 'unclear', what: 'text' }, 6000).state;
    expect(back.layers.title!.opacity.to).toBe(0.8);
    expect(back.layers.clock!.opacity.to).toBe(1);
    expect(back.cleared).toEqual({});
  });

  it('clear media pauses video, cancels delayed shows, and undo resumes where it stopped', () => {
    const s0 = run(demo(), [
      [0, show('vid')],
      [0, play('vid')],
      [1000, show('title')],
    ]);
    const withDelay = step(demo(), s0, show('vid', 5), 2000).state;
    const cleared = step(demo(), withDelay, { type: 'clear', what: 'media' }, 3000).state;
    expect(cleared.layers.vid!.opacity.to).toBe(0);
    expect(cleared.layers.vid!.media).toMatchObject({ playing: false, position: 3 });
    expect(cleared.layers.title!.opacity.to).toBe(0.8);
    expect(cleared.timers.some((t) => t.kind === 'action')).toBe(false);

    const back = step(demo(), cleared, { type: 'unclear', what: 'media' }, 10_000).state;
    expect(back.layers.vid!.opacity.to).toBe(1);
    expect(back.layers.vid!.media).toMatchObject({ playing: true, position: 3, anchor: 10_000 });
  });

  it('a new cue forgets what was cleared; with nothing on stage a clear takes nothing', () => {
    const s0 = run(demo(), [[0, { type: 'fireCue', cueId: 'c1' }]]);
    const cleared = step(demo(), s0, { type: 'clear', what: 'text' }, 100).state;
    const next = step(demo(), cleared, { type: 'fireCue', cueId: 'c2' }, 200).state;
    expect(next.cleared).toEqual({});
    const { events } = step(demo(), next, { type: 'unclear', what: 'text' }, 300);
    expect(events.at(-1)).toMatchObject({ type: 'warning' });

    const none = step(demo(), initialState(demo()), { type: 'clear', what: 'media' }, 0);
    expect(none.events).toContainEqual({ type: 'cleared', what: 'media', layers: 0 });
    expect(none.state.cleared).toEqual({});
  });

  it('mute toggles sound on its own, and PANIC, Release and Back leave it alone', () => {
    const s = run(demo(), [
      [0, { type: 'fireCue', cueId: 'c1' }],
      [100, { type: 'mute' }],
      [200, { type: 'panic' }],
      [300, { type: 'release' }],
      [400, { type: 'back' }],
    ]);
    expect(s.mute!.to).toBe(1);
    expect(s.blackout.to).toBe(0);
    const { state, events } = step(demo(), s, { type: 'mute' }, 500);
    expect(state.mute!.to).toBe(0);
    expect(events).toEqual([{ type: 'mute', on: false }]);
    // Asking for the state it is already in does nothing.
    expect(step(demo(), state, { type: 'mute', on: false }, 600).events).toEqual([]);
  });

  it('older journals without mute or clears still load', () => {
    const show = demo();
    const old = initialState(show) as EngineState & { mute?: unknown; cleared?: unknown };
    delete old.mute;
    delete old.cleared;
    const engine = new Engine(show, () => 0, old);
    expect(engine.state.mute!.to).toBe(0);
    expect(engine.state.cleared).toEqual({});
  });
});

describe('frames', () => {
  /** demo() with a lower third holding only text (title, clock) and a box with video and a caption. */
  function framed(): Show {
    const show = demo();
    const out = show.outputs[0]!.id;
    const frame = (id: string, z: number): Layer => ({
      id,
      name: id,
      kind: 'frame',
      outputId: out,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      z,
      opacity: 1,
      visible: false,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      fill: '#000',
      radius: 0,
      clip: false,
      layout: {
        mode: 'free',
        gap: 0,
        padX: 0,
        padY: 0,
        align: 'center',
        justify: 'start',
        hugW: false,
        hugH: false,
      },
    });
    const caption = { ...show.layers[0]!, id: 'cap', name: 'Caption', visible: true };
    show.layers.push(frame('lt', 3), frame('box', 4), { ...caption, parentId: 'box' });
    for (const l of show.layers) {
      if (l.id === 'title' || l.id === 'clock') l.parentId = 'lt';
      if (l.id === 'vid') l.parentId = 'box';
    }
    return show;
  }
  const act = (action: Action): EngineInput => ({ type: 'action', action });
  const on = (layerId: string) => act({ type: 'show', layerId, duration: 0, easing: 'linear' });
  const off = (layerId: string) => act({ type: 'hide', layerId, duration: 0, easing: 'linear' });

  it('a frame fades its content with it and leaves the content’s own opacity alone', () => {
    const show = framed();
    const tree = layerTree(show.layers);
    const s = run(show, [[0, on('title')]]);
    expect(effectiveOpacity(tree, s, 'title', 0)).toBe(0);
    const up = step(show, s, on('lt'), 10).state;
    expect(effectiveOpacity(tree, up, 'title', 10)).toBeCloseTo(0.8);
    const down = step(show, up, off('lt'), 20).state;
    expect(down.layers.title!.opacity.to).toBe(0.8);
    expect(effectiveOpacity(tree, down, 'title', 20)).toBe(0);
  });

  it('Fade all fades what sits on the output, keeps frames’ content, and still stops video', () => {
    const show = framed();
    const tree = layerTree(show.layers);
    const s = run(show, [
      [0, on('lt')],
      [0, on('title')],
      [0, on('box')],
      [0, on('vid')],
      [0, act({ type: 'play', layerId: 'vid', restart: true })],
    ]);
    const faded = step(show, s, act({ type: 'stopAll', duration: 2 }), 1000).state;
    expect(faded.layers.lt!.opacity.to).toBe(0);
    expect(faded.layers.box!.opacity.to).toBe(0);
    expect(faded.layers.title!.opacity.to).toBe(0.8);
    expect(faded.timers).toContainEqual({ at: 3000, kind: 'pause', layerId: 'vid' });
    // Showing the frame again brings its content back with it.
    const again = step(show, faded, on('lt'), 5000).state;
    expect(effectiveOpacity(tree, again, 'title', 5000)).toBeCloseTo(0.8);
  });

  it('clear text takes a frame of only text as one, and just the text from a mixed frame', () => {
    const show = framed();
    const s = run(show, [
      [0, on('lt')],
      [0, on('title')],
      [0, on('box')],
      [0, on('vid')],
    ]);
    const { state, events } = step(show, s, { type: 'clear', what: 'text' }, 1000);
    expect(state.layers.lt!.opacity.to).toBe(0);
    expect(state.layers.title!.opacity.to).toBe(0.8);
    expect(state.layers.box!.opacity.to).toBe(1);
    expect(state.layers.cap!.opacity.to).toBe(0);
    expect(state.layers.vid!.opacity.to).toBe(1);
    expect(events).toContainEqual({ type: 'cleared', what: 'text', layers: 2 });

    const back = step(show, state, { type: 'unclear', what: 'text' }, 2000);
    expect(back.state.layers.lt!.opacity.to).toBe(1);
    expect(back.state.layers.cap!.opacity.to).toBe(0.8);
    expect(back.events).toContainEqual({ type: 'uncleared', what: 'text', layers: 2 });
  });

  it('clear media pauses video inside a cleared frame and counts the frame once', () => {
    const show = framed();
    show.layers = show.layers.filter((l) => l.id !== 'cap');
    const s = run(show, [
      [0, on('box')],
      [0, on('vid')],
      [0, act({ type: 'play', layerId: 'vid', restart: true })],
    ]);
    const { state, events } = step(show, s, { type: 'clear', what: 'media' }, 2000);
    expect(state.layers.box!.opacity.to).toBe(0);
    expect(state.layers.vid!.opacity.to).toBe(1);
    expect(state.layers.vid!.media).toMatchObject({ playing: false, position: 2 });
    expect(events).toContainEqual({ type: 'cleared', what: 'media', layers: 1 });

    const back = step(show, state, { type: 'unclear', what: 'media' }, 9000).state;
    expect(back.layers.box!.opacity.to).toBe(1);
    expect(back.layers.vid!.media).toMatchObject({ playing: true, position: 2, anchor: 9000 });
  });

  it('clear leaves alone what a hidden frame holds', () => {
    const show = framed();
    const s = run(show, [[0, on('title')]]);
    const { state, events } = step(show, s, { type: 'clear', what: 'text' }, 1000);
    expect(events).toContainEqual({ type: 'cleared', what: 'text', layers: 0 });
    expect(state.layers.title!.opacity.to).toBe(0.8);
    expect(state.layers.cap!.opacity.to).toBe(0.8);
  });

  it('Back returns frames too', () => {
    const show = framed();
    show.cues[0]!.actions.push({ type: 'hide', layerId: 'lt', duration: 0, easing: 'linear' });
    const s = run(show, [
      [0, on('lt')],
      [100, { type: 'go' }],
    ]);
    expect(s.layers.lt!.opacity.to).toBe(0);
    expect(step(show, s, { type: 'back' }, 200).state.layers.lt!.opacity.to).toBe(1);
  });

  it('a frame added to a running show joins it hidden, and a loop between frames is harmless', () => {
    const engine = new Engine(framed(), () => 0, initialState(demo()));
    expect(engine.state.layers.lt!.opacity.to).toBe(0);

    const show = framed();
    for (const l of show.layers) {
      if (l.id === 'lt') l.parentId = 'box';
      if (l.id === 'box') l.parentId = 'lt';
    }
    const s = run(show, [
      [0, on('lt')],
      [0, on('box')],
      [0, on('cap')],
    ]);
    expect(() => step(show, s, { type: 'clear', what: 'text' }, 10)).not.toThrow();
    expect(() => step(show, s, act({ type: 'stopAll', duration: 1 }), 10)).not.toThrow();
  });
});

describe('loops and timing', () => {
  const act = (action: Action): EngineInput => ({ type: 'action', action });
  const warnings = (events: EngineEvent[]) =>
    events.flatMap((e) => (e.type === 'warning' ? [e.message] : []));

  it('stops cues that fire each other with no time between, naming them', () => {
    const show = demo();
    show.cues[2]!.actions = [
      { type: 'goToCue', cueId: 'c4', fire: true },
      { type: 'openMoment', momentId: 'vote' },
    ];
    show.cues[3]!.actions = [{ type: 'goToCue', cueId: 'c3', fire: true }];
    const { state, events } = step(show, initialState(show), { type: 'fireCue', cueId: 'c3' }, 0);
    expect(events.filter((e) => e.type === 'cueFired')).toHaveLength(64);
    // What the loop's cues would have done after their jumps stops too.
    expect(events.some((e) => e.type === 'momentOpened')).toBe(false);
    expect(warnings(events)).toEqual([
      'Cues stopped: “Cellar” and “Attic” fire each other with no time between (loop?)',
    ]);
    expect(state.follow).toBeNull();
  });

  it('bounds a loop of zero-second follows in one step instead of spinning on ticks', () => {
    const show = demo();
    show.cues[0]!.follow = { auto: true, delay: 0 };
    show.rules.push({
      id: 'again',
      name: 'Again',
      enabled: true,
      when: { type: 'cueFired', cueId: 'c2' },
      if: [],
      then: [{ type: 'goToCue', cueId: 'c1', fire: true }],
    });
    const { state, events } = step(show, initialState(show), { type: 'go' }, 0);
    expect(warnings(events)[0]).toMatch(/^Cues stopped: “Title up” and “Open vote”/);
    expect(state.follow).toBeNull();
    expect(nextWakeup(state)).not.toBe(0);
  });

  it('fires a zero-second follow in the same step, after the rules of the cue before it', () => {
    const show = demo();
    show.cues[0]!.follow = { auto: true, delay: 0 };
    show.cues[1]!.actions = [
      {
        type: 'branch',
        if: [{ varId: 'door', op: 'eq', value: 'left' }],
        then: [{ type: 'addVar', varId: 'score', amount: 1 }],
        else: [],
      },
    ];
    show.rules.push({
      id: 'pick',
      name: 'Pick',
      enabled: true,
      when: { type: 'cueFired', cueId: 'c1' },
      if: [],
      then: [{ type: 'setVar', varId: 'door', value: 'left' }],
    });
    const { state, events } = step(show, initialState(show), { type: 'go' }, 1000);
    expect(events.filter((e) => e.type === 'cueFired').map((e) => e.source)).toEqual([
      'operator',
      'follow',
    ]);
    expect(state.lastFired).toBe('c2');
    expect(state.vars.score).toBe(1);
    // Back still returns to before the operator's GO.
    expect(state.back?.cueId).toBe('c1');
  });

  it('leaves a follow that is due to its tick when another input arrives first', () => {
    const show = demo();
    const s = run(show, [
      [0, { type: 'go' }],
      [6000, { type: 'setVar', varId: 'score', value: 3 }],
    ]);
    expect(s.lastFired).toBe('c1');
    expect(run(show, [[6000, { type: 'tick' }]], s).lastFired).toBe('c2');
  });

  it('Fade all cancels delayed actions from earlier cues and keeps its own cue’s', () => {
    const show = demo();
    show.cues[0]!.actions = [
      { type: 'show', layerId: 'title', duration: 0, easing: 'linear', delay: 10 },
    ];
    show.cues[0]!.follow = { auto: false, delay: 0 };
    show.cues[3]!.actions = [
      { type: 'stopAll', duration: 1 },
      { type: 'show', layerId: 'clock', duration: 0, easing: 'linear', delay: 3 },
    ];
    const s = run(show, [
      [0, { type: 'go' }],
      [1000, { type: 'fireCue', cueId: 'c4' }],
    ]);
    const pending = s.timers.flatMap((t) =>
      t.kind === 'action' && 'layerId' in t.action ? [t.action.layerId] : [],
    );
    expect(pending).toEqual(['clock']);
    const later = run(show, [[12_000, { type: 'tick' }]], s);
    expect(later.layers.title!.opacity.to).toBe(0);
  });

  it('warns when an action has nothing to act on', () => {
    const show = demo();
    const msgs = (action: Action) =>
      warnings(step(show, initialState(show), act(action), 0).events);
    expect(msgs({ type: 'pause', layerId: 'title' })).toEqual([
      'Layer title has no media to pause',
    ]);
    expect(msgs({ type: 'seek', layerId: '', time: 2 })).toEqual(['Layer  has no media to seek']);
    expect(msgs({ type: 'setText', layerId: 'clock', text: 'x' })).toEqual([
      'Layer clock has no text',
    ]);
    expect(msgs({ type: 'counter', layerId: 'title', op: 'start' })).toEqual([
      'Layer title is not a counter',
    ]);
    expect(msgs({ type: 'closeMoment', momentId: '' })).toEqual(['Audience moment  not found']);
    // Closing a moment that isn't open is normal, not a mistake.
    expect(msgs({ type: 'closeMoment', momentId: 'vote' })).toEqual([]);
  });
});

describe('labels', () => {
  it('shows vote results and tallies by their option labels', () => {
    const show = demo();
    expect(formatVar(show, 'door', 'left')).toBe('Left');
    expect(formatVar(show, 'tally', { left: 2, right: 1 })).toBe('Left: 2, Right: 1');
    expect(valueLines({ left: 2, right: 1 }, optionLabels(show, 'tally'))).toEqual([
      'Left: 2',
      'Right: 1',
    ]);
    // Values no vote writes keep what they hold, even words an object already has.
    expect(formatVar(show, 'score', 2.25)).toBe('2.3');
    expect(formatValue(['constructor', 'toString'])).toBe('constructor, toString');
    expect(optionLabels(show, '')).toEqual({});
  });
});

describe('running order, jumps and sections', () => {
  /** Three songs: Amazing Grace has verses and choruses, Encore has one cue. */
  function gig(): Show {
    const show = createShow('Gig');
    show.scenes = [
      { id: 'grace', name: 'Amazing Grace' },
      { id: 'river', name: 'River' },
      { id: 'encore', name: 'Encore' },
    ];
    const cue = (id: string, sceneId: string, name: string, section?: string) => ({
      ...createCue(sceneId, name),
      id,
      ...(section ? { section } : {}),
    });
    show.cues = [
      cue('g1', 'grace', 'Verse 1', 'Verse'),
      cue('g2', 'grace', 'Chorus', 'Chorus'),
      cue('g3', 'grace', 'Verse 2', 'Verse'),
      cue('g4', 'grace', 'Chorus again', 'chorus'),
      cue('r1', 'river', 'Intro'),
      cue('r2', 'river', 'Chorus', 'Chorus'),
      cue('e1', 'encore', 'Bow'),
    ];
    show.triggers = [{ id: 'pedal', name: 'Pedal', color: '#f00' }];
    return show;
  }
  const order = (scenes: string[], skipped: string[] = []): EngineInput => ({
    type: 'setOrder',
    order: { scenes, skipped },
  });
  const ids = (show: Show, s: EngineState) => runOrder(show, s.order ?? null).map((c) => c.id);

  it('plays scenes in tonight’s order, leaves skipped ones out, and slots in new ones', () => {
    const show = gig();
    const s = run(show, [[0, order(['encore', 'grace'], ['river'])]]);
    expect(ids(show, s)).toEqual(['e1', 'g1', 'g2', 'g3', 'g4']);
    // The natural first cue moved with the order.
    expect(s.standby).toBe('e1');
    // A scene the order doesn't know plays after the one before it in the show.
    show.scenes.splice(1, 0, { id: 'new', name: 'New song' });
    show.cues.push({ ...createCue('new', 'Hello'), id: 'n1' });
    expect(sceneSequence(show, s.order!)).toEqual(['encore', 'grace', 'new', 'river']);
  });

  it('GO, follows and standby next follow the new order', () => {
    const show = gig();
    show.cues[3]!.follow = { auto: true, delay: 1 };
    let s = run(show, [
      [0, { type: 'fireCue', cueId: 'g4' }],
      [100, order(['grace', 'encore', 'river'])],
    ]);
    expect(s.standby).toBe('e1');
    expect(s.follow?.cueId).toBe('e1');
    s = run(show, [[1000, { type: 'tick' }]], s);
    expect(s.lastFired).toBe('e1');
    expect(run(show, [[2000, { type: 'standbyNext' }]], s).standby).toBe('r2');
  });

  it('keeps a standby the operator chose, and never skips what is live', () => {
    const show = gig();
    const s = run(show, [
      [0, { type: 'fireCue', cueId: 'g1' }],
      [10, { type: 'standby', cueId: 'r2' }],
      [20, order(['river', 'grace', 'encore'], ['grace'])],
    ]);
    expect(s.standby).toBe('r2');
    expect(s.order?.skipped).toEqual([]);
  });

  it('a jump into a skipped scene brings it back after the live one', () => {
    const show = gig();
    const s0 = run(show, [
      [0, order(['grace', 'river', 'encore'], ['river'])],
      [10, { type: 'fireCue', cueId: 'g1' }],
    ]);
    const { state, events } = step(
      show,
      s0,
      { type: 'jump', target: { to: 'scene', sceneId: 'river' } },
      20,
    );
    expect(state.standby).toBe('r1');
    expect(state.order).toEqual({ scenes: ['grace', 'river', 'encore'], skipped: [] });
    expect(events).toContainEqual({
      type: 'orderChanged',
      prev: { scenes: ['grace', 'river', 'encore'], skipped: ['river'] },
      order: { scenes: ['grace', 'river', 'encore'], skipped: [] },
    });
  });

  it('jumps to the next cue of a section in the live scene, and repeats the last one', () => {
    const show = gig();
    const chorus: EngineInput = { type: 'jump', target: { to: 'section', section: 'Chorus' } };
    const after = (cueId: string) =>
      step(show, run(show, [[0, { type: 'fireCue', cueId }]]), chorus, 10).state.standby;
    expect(after('g1')).toBe('g2');
    expect(after('g3')).toBe('g4'); // case doesn't matter
    expect(after('g4')).toBe('g4'); // the band repeats the last chorus
    expect(after('r1')).toBe('r2');
    const missing = step(show, run(show, [[0, { type: 'fireCue', cueId: 'e1' }]]), chorus, 10);
    expect(missing.events).toContainEqual({
      type: 'warning',
      message: 'No “Chorus” in “Encore”',
    });
    // Fired at once, from a key.
    const fired = step(
      show,
      run(show, [[0, { type: 'fireCue', cueId: 'g1' }]]),
      { ...chorus, fire: true, source: 'keyboard' },
      10,
    );
    expect(fired.events[0]).toMatchObject({ type: 'cueFired', cueId: 'g2', source: 'keyboard' });
  });

  it('a performer’s trigger can jump to a section through a rule', () => {
    const show = gig();
    show.rules = [
      {
        id: 'r',
        name: 'Back to the chorus',
        enabled: true,
        when: { type: 'trigger', triggerId: 'pedal' },
        if: [],
        then: [{ type: 'jumpSection', section: 'Chorus', fire: true }],
      },
    ];
    const s = run(show, [
      [0, { type: 'fireCue', cueId: 'g3' }],
      [10, { type: 'trigger', triggerId: 'pedal' }],
    ]);
    expect(s.lastFired).toBe('g4');
  });

  it('goes to the next, previous or same scene in running order', () => {
    const show = gig();
    const jump = (to: 'nextScene' | 'prevScene' | 'restartScene'): EngineInput => ({
      type: 'jump',
      target: { to },
    });
    const s = run(show, [
      [0, order(['encore', 'grace', 'river'])],
      [10, { type: 'fireCue', cueId: 'g3' }],
    ]);
    expect(step(show, s, jump('nextScene'), 20).state.standby).toBe('r1');
    expect(step(show, s, jump('prevScene'), 20).state.standby).toBe('e1');
    expect(step(show, s, jump('restartScene'), 20).state.standby).toBe('g1');
    // Before anything fires, "next" is the first scene.
    expect(step(show, initialState(show), jump('nextScene'), 0).state.standby).toBe('g1');
  });

  it('Back and Reset keep tonight’s order; older journals without one still load', () => {
    const show = gig();
    const s = run(show, [
      [0, order(['river', 'grace', 'encore'])],
      [10, { type: 'go' }],
    ]);
    expect(s.lastFired).toBe('r1');
    const backed = step(show, s, { type: 'back' }, 20).state;
    expect(backed.order?.scenes).toEqual(['river', 'grace', 'encore']);
    expect(backed.standby).toBe('r1');
    const reset = step(show, s, { type: 'reset' }, 30).state;
    expect(reset.order?.scenes).toEqual(['river', 'grace', 'encore']);
    expect(reset.standby).toBe('r1');
    const { order: _order, ...older } = initialState(show);
    expect(step(show, older, { type: 'go' }, 0).state.lastFired).toBe('g1');
    // Back to the show's own order.
    expect(ids(show, run(show, [[40, { type: 'setOrder', order: null }]], s))[0]).toBe('g1');
  });
});

describe('counts from every source', () => {
  const open = (show: Show) => run(show, [[0, { type: 'openMoment', momentId: 'vote' }]]);
  const relay = (left: number, right: number): EngineInput => ({
    type: 'momentAgg',
    momentId: 'vote',
    tally: { left, right },
    n: left + right,
  });

  it('adds buttons and typed counts to the phones’ running totals', () => {
    const show = demo();
    const s = run(
      show,
      [
        [10, relay(3, 1)],
        [20, { type: 'countVote', option: 2, source: 'buttons' }],
        [30, { type: 'countVote', option: 2, source: 'buttons' }],
        [40, { type: 'countVote', optionId: 'left', amount: 5, source: 'counted' }],
        // A later relay total replaces only the phones' share.
        [50, relay(4, 1)],
      ],
      open(show),
    );
    const m = s.moments.vote!;
    expect(m.tally).toEqual({ left: 9, right: 3 });
    expect(m.n).toBe(12);
    expect(m.sources).toMatchObject({
      relay: { tally: { left: 4, right: 1 } },
      buttons: { tally: { right: 2 } },
      counted: { tally: { left: 5 } },
    });
    // Live tally on stage follows the sum.
    expect(s.vars.tally).toEqual({ left: 9, right: 3 });
    expect(run(show, [[60, { type: 'closeMoment', momentId: 'vote' }]], s).vars.door).toBe('left');
  });

  it('pretend phones add to real ones instead of replacing them', () => {
    const show = demo();
    const s = run(
      show,
      [
        [10, relay(2, 0)],
        [20, { type: 'momentAgg', momentId: 'vote', source: 'sim', tally: { right: 7 }, n: 7 }],
        [30, relay(2, 1)],
      ],
      open(show),
    );
    expect(s.moments.vote!.tally).toEqual({ left: 2, right: 8 });
  });

  it('uses the default only when every source is empty, and corrections never go below zero', () => {
    const show = demo();
    const s = run(
      show,
      [
        [10, { type: 'countVote', option: 1, amount: 2, source: 'counted' }],
        [20, { type: 'countVote', option: 1, amount: -5, source: 'counted' }],
      ],
      open(show),
    );
    expect(s.moments.vote!.tally.left).toBe(0);
    const closed = step(show, s, { type: 'closeMoment', momentId: 'vote' }, 30);
    expect(closed.events).toContainEqual(
      expect.objectContaining({ type: 'momentClosed', usedDefault: true, result: 'right' }),
    );
  });

  it('warns when nothing is open to count, and counts taps on a tap moment', () => {
    const show = demo();
    const none = step(show, initialState(show), { type: 'countVote', option: 1 }, 0);
    expect(none.events).toEqual([
      { type: 'warning', message: 'A vote was counted, but no vote or tap moment is open' },
    ]);
    show.moments.push({
      ...show.moments[0]!,
      id: 'taps',
      name: 'Taps',
      type: 'tap',
      resultVarId: 'score',
      tallyVarId: null,
    });
    const s = run(show, [
      [0, { type: 'openMoment', momentId: 'vote' }],
      [10, { type: 'openMoment', momentId: 'taps' }],
      [20, { type: 'countVote', option: 3 }],
      [30, { type: 'momentAgg', momentId: 'taps', count: 10 }],
    ]);
    // The newest open moment takes the count.
    expect(s.moments.taps!.count).toBe(11);
    expect(s.vars.score).toBe(11);
  });

  it('a journal from before sources keeps what phones sent', () => {
    const show = demo();
    const s = run(show, [[10, relay(3, 2)]], open(show));
    const older = structuredClone(s);
    delete older.moments.vote!.sources;
    const after = run(show, [[20, { type: 'countVote', option: 1 }]], older);
    expect(after.moments.vote!.tally).toEqual({ left: 4, right: 2 });
  });
});

describe('the personal access channel', () => {
  function captioned(): Show {
    const show = demo();
    show.cues[0]!.access = {
      caption: 'Welcome, everyone.',
      description: 'A door glows red.',
      buzz: true,
      i18n: { fr: { caption: 'Bienvenue à tous.' } },
    };
    show.cues[0]!.follow = { auto: false, delay: 0 };
    // No caption field: the caption stays up.
    show.cues[1]!.access = { warning: 'Loud bang' };
    // An empty caption takes it down.
    show.cues[2]!.access = { caption: '' };
    return show;
  }

  it('keeps the caption until a cue changes or clears it, and counts descriptions and buzzes', () => {
    const show = captioned();
    let s = run(show, [[0, { type: 'go' }]]);
    expect(s.access).toEqual({ captionCue: 'c1', describeCue: 'c1', seq: 1, buzz: 1 });
    expect(currentCaption(show, s.access)).toBe('Welcome, everyone.');
    expect(accessText(show.cues[0], 'caption', 'fr')).toBe('Bienvenue à tous.');
    // A language with no translation falls back to the show's own.
    expect(accessText(show.cues[0], 'description', 'fr')).toBe('A door glows red.');
    s = run(show, [[10, { type: 'go' }]], s);
    expect(s.access?.captionCue).toBe('c1');
    s = run(show, [[20, { type: 'go' }]], s);
    expect(s.access).toMatchObject({ captionCue: null, seq: 1 });
  });

  it('Back puts the caption back; {{caption}} shows it on stage; reset clears it', () => {
    const show = captioned();
    const two = run(show, [
      [0, { type: 'go' }],
      [10, { type: 'fireCue', cueId: 'c3' }],
    ]);
    expect(two.access?.captionCue).toBeNull();
    const back = step(show, two, { type: 'back' }, 20).state;
    expect(back.access?.captionCue).toBe('c1');
    expect(
      interpolate('» {{caption}}', show, back.vars, { caption: currentCaption(show, back.access) }),
    ).toBe('» Welcome, everyone.');
    // A state value named caption keeps its meaning.
    show.vars.push({ id: 'cap', name: 'caption', type: 'text', initial: 'mine' });
    expect(interpolate('{{caption}}', show, { cap: 'mine' }, { caption: 'x' })).toBe('mine');
    expect(step(show, back, { type: 'reset' }, 30).state.access).toBeUndefined();
  });

  it('forgets a caption whose cue was deleted', () => {
    const show = captioned();
    const s = run(show, [[0, { type: 'go' }]]);
    const edited = { ...show, cues: show.cues.slice(1) };
    expect(reconcile(edited, s).access?.captionCue).toBeNull();
  });
});

describe('relaxed performances', () => {
  const evs = (show: Show, state: EngineState, input: EngineInput, t: number) =>
    step(show, state, input, t);

  it('eases in, dims outputs, caps sound and slows every fade to the minimum', () => {
    const show = demo();
    show.relaxed = { brightness: 0.5 };
    const on = evs(show, initialState(show), { type: 'relaxed' }, 0);
    expect(on.events).toContainEqual({ type: 'relaxed', on: true });
    expect(relaxedBrightness(show, on.state, 0)).toBe(1);
    expect(relaxedBrightness(show, on.state, 2000)).toBeCloseTo(0.5);
    // Volume falls back to the default cap of 0.6.
    expect(soundLevel(show, on.state, 2000)).toBeCloseTo(0.6);
    // Cellar hides the title in 0 s; relaxed takes 1 s, and a 2 s fade stays 2 s.
    let s = run(show, [[10_000, { type: 'go' }]], on.state);
    expect(s.layers.title!.opacity.dur).toBe(2000);
    s = run(show, [[20_000, { type: 'fireCue', cueId: 'c3' }]], s);
    expect(s.layers.title!.opacity.dur).toBe(1000);
    // Off again: back to full brightness, and cuts are cuts.
    s = run(show, [[30_000, { type: 'relaxed', on: false }]], s);
    expect(relaxedBrightness(show, s, 32_000)).toBe(1);
    s = run(
      show,
      [
        [40_000, { type: 'fireCue', cueId: 'c1' }],
        [41_000, { type: 'fireCue', cueId: 'c3' }],
      ],
      s,
    );
    expect(s.layers.title!.opacity.dur).toBe(0);
  });

  it('leaves intense layers out, and takes them off stage when it turns on', () => {
    const show = demo();
    show.layers.find((l) => l.id === 'vid')!.intense = true;
    show.cues[1]!.actions.push({ type: 'show', layerId: 'vid', duration: 0, easing: 'linear' });
    let s = run(show, [
      [0, { type: 'go' }],
      [1000, { type: 'go' }],
    ]);
    expect(s.layers.vid!.opacity.to).toBe(1);
    const on = evs(show, s, { type: 'relaxed', on: true }, 2000);
    expect(on.events).toContainEqual({ type: 'leftOut', layerId: 'vid', name: 'Video' });
    expect(on.state.layers.vid!.opacity).toMatchObject({ to: 0, dur: 1000 });
    s = run(show, [[4000, { type: 'tick' }]], on.state);
    expect(s.layers.vid!.media!.playing).toBe(false);
    // Fired again while relaxed, the cue plays everything but the intense video.
    const again = evs(show, s, { type: 'fireCue', cueId: 'c2' }, 5000);
    expect(again.events.filter((e) => e.type === 'leftOut')).toHaveLength(2);
    expect(again.state.layers.vid!.opacity.to).toBe(0);
    expect(again.state.layers.vid!.media!.playing).toBe(false);
    expect(again.state.moments.vote!.status).toBe('open');
  });

  it('plays a cue’s gentler version, and an empty one does nothing', () => {
    const show = demo();
    show.cues[0]!.gentle = [{ type: 'show', layerId: 'title', duration: 4, easing: 'linear' }];
    show.cues[2]!.gentle = [];
    let s = run(show, [
      [0, { type: 'relaxed', on: true }],
      [10, { type: 'go' }],
    ]);
    expect(s.layers.title!.opacity.dur).toBe(4000);
    expect(s.layers.clock!.counter!.running).toBe(false);
    s = run(show, [[10_000, { type: 'fireCue', cueId: 'c3' }]], s);
    expect(s.layers.title!.opacity.to).toBe(0.8);
    expect(s.lastFired).toBe('c3');
  });

  it('keeps intense layers out through Back, unclear, Reset and a relaxed start', () => {
    const show = demo();
    show.layers.find((l) => l.id === 'vid')!.intense = true;
    show.layers.find((l) => l.id === 'vid')!.visible = true;
    show.cues[1]!.actions.push({ type: 'show', layerId: 'vid', duration: 0, easing: 'linear' });
    let s = run(show, [
      [0, { type: 'go' }],
      [1000, { type: 'go' }],
      [2000, { type: 'relaxed', on: true }],
    ]);
    // Back to before Open vote, which was before relaxed: the video stays off.
    const back = step(show, s, { type: 'back' }, 3000);
    expect(back.state.layers.vid!.opacity.to).toBe(0);
    expect(back.events).toContainEqual({ type: 'leftOut', layerId: 'vid', name: 'Video' });
    // Cleared before relaxed began, then brought back: still left out.
    s = run(show, [
      [0, { type: 'go' }],
      [1000, { type: 'go' }],
      [2000, { type: 'clear', what: 'media' }],
      [3000, { type: 'relaxed', on: true }],
      [4000, { type: 'unclear', what: 'media' }],
    ]);
    expect(s.layers.vid!.opacity.to).toBe(0);
    // Reset while relaxed, and a show that starts relaxed, begin with it off.
    expect(step(show, s, { type: 'reset' }, 5000).state.layers.vid!.opacity.to).toBe(0);
    show.relaxed = { default: true };
    expect(initialState(show).layers.vid!.opacity.to).toBe(0);
    show.relaxed = {};
    expect(initialState(show).layers.vid!.opacity.to).toBe(1);
  });

  it('stops intense sound at once, keeping its level, and video inside an intense frame', () => {
    const show = demo();
    const out = show.outputs[0]!.id;
    show.layers.push(
      {
        ...show.layers[1]!,
        id: 'bang',
        name: 'Bang',
        kind: 'audio',
        outputId: null,
        visible: true,
        intense: true,
      } as Layer,
      {
        ...show.layers[1]!,
        id: 'box',
        name: 'Box',
        kind: 'frame',
        outputId: out,
        intense: true,
        fill: '#fff',
        radius: 0,
        clip: false,
        layout: {
          mode: 'free',
          gap: 0,
          padX: 0,
          padY: 0,
          align: 'center',
          justify: 'start',
          hugW: false,
          hugH: false,
        },
      } as Layer,
    );
    show.layers.find((l) => l.id === 'vid')!.parentId = 'box';
    show.cues[0]!.actions.push(
      { type: 'play', layerId: 'bang', restart: true },
      { type: 'show', layerId: 'box', duration: 0, easing: 'linear' },
      { type: 'show', layerId: 'vid', duration: 0, easing: 'linear' },
      { type: 'play', layerId: 'vid', restart: true },
    );
    let s = run(show, [
      [0, { type: 'go' }],
      [1000, { type: 'relaxed', on: true }],
    ]);
    expect(s.layers.bang!.media!.playing).toBe(false);
    expect(s.layers.bang!.opacity.to).toBe(1);
    expect(s.layers.box!.opacity.to).toBe(0);
    s = run(show, [[2000, { type: 'tick' }]], s);
    expect(s.layers.vid!.media!.playing).toBe(false);
    // After the relaxed performance, a cue that only plays the sound is heard.
    s = run(
      show,
      [
        [3000, { type: 'relaxed', on: false }],
        [4000, { type: 'fireCue', cueId: 'c1' }],
      ],
      s,
    );
    expect(s.layers.bang!.media!.playing).toBe(true);
    expect(s.layers.bang!.opacity.to).toBe(1);
  });

  it('outlives Back and Reset, starts on when the show says so, and loads older journals', () => {
    const show = demo();
    let s = run(show, [
      [0, { type: 'go' }],
      [100, { type: 'relaxed', on: true }],
    ]);
    expect(step(show, s, { type: 'back' }, 200).state.relaxed?.to).toBe(1);
    expect(step(show, s, { type: 'reset' }, 200).state.relaxed?.to).toBe(1);
    show.relaxed = { default: true };
    expect(initialState(show).relaxed?.to).toBe(1);
    const old = { ...initialState(show) };
    delete old.relaxed;
    expect(reconcile(show, old).relaxed?.to).toBe(1);
    // A cue can turn it on or off, for a show that changes mood.
    show.relaxed = {};
    show.cues[0]!.actions.push({ type: 'relaxed', on: true });
    s = run(show, [[0, { type: 'go' }]]);
    expect(s.relaxed?.to).toBe(1);
  });
});

describe('safeguarding', () => {
  it('keeps text moments shut when the show lets phones send no words', () => {
    const show = demo();
    show.moments.push({
      ...show.moments[0]!,
      id: 'names',
      name: 'Names',
      type: 'text',
      options: [],
    });
    show.cues[0]!.actions.push({ type: 'openMoment', momentId: 'names' });
    show.safety = { noFreeText: true };
    const { state, events } = step(show, initialState(show), { type: 'go' }, 0);
    expect(state.moments.names!.status).toBe('idle');
    expect(events).toContainEqual({
      type: 'warning',
      message: '“Names” didn’t open: this show doesn’t let phones send words',
    });
  });

  it('shuts a words moment already open when the setting is switched on', () => {
    const show = demo();
    show.moments.push({
      ...show.moments[0]!,
      id: 'names',
      name: 'Names',
      type: 'text',
      options: [],
    });
    let s = run(show, [[0, { type: 'openMoment', momentId: 'names' }]]);
    expect(s.moments.names!.status).toBe('open');
    const safe = { ...show, safety: { noFreeText: true } };
    s = reconcile(safe, s);
    expect(s.moments.names!.status).toBe('closed');
    s = run(
      safe,
      [[10, { type: 'momentAgg', momentId: 'names', entries: [{ id: 'e', text: 'hi' }] }]],
      s,
    );
    expect(s.moments.names!.entries).toEqual([]);
  });
});
