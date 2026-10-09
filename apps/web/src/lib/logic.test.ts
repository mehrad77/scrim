import { createCue, createShow, type Layer, type Show } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import {
  checkLogic,
  conditionText,
  cueExits,
  sceneGraph,
  unhandledOptions,
  usage,
  zeroTimeLoops,
} from './logic.js';
import { removeLayer } from './refs.js';
import {
  checkPath,
  momentsBefore,
  previewAt,
  tryOutcomes,
  walkTo,
  bookmarkPath,
} from './simulate.js';

/** Hallway → a door vote → Cellar or Attic → Ending. */
export function doors(): Show {
  const show = createShow('Doors');
  const out = show.outputs[0]!.id;
  show.scenes = [
    { id: 'hall', name: 'Hallway' },
    { id: 'cellar', name: 'Cellar' },
    { id: 'attic', name: 'Attic' },
    { id: 'end', name: 'Ending' },
  ];
  show.layers = [
    {
      id: 'sign',
      name: 'Sign',
      kind: 'text',
      outputId: out,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      z: 0,
      opacity: 1,
      visible: false,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      text: 'Door: {{door}}',
      fontSize: 72,
      color: '#ffffff',
      fontFamily: 'sans-serif',
      fontWeight: 400,
      align: 'center',
      background: 'transparent',
    },
  ];
  show.vars = [
    { id: 'door', name: 'door', type: 'choice', initial: '', options: ['left', 'right', 'up'] },
    { id: 'tally', name: 'tally', type: 'tally', initial: {} },
  ];
  show.moments = [
    {
      id: 'vote',
      name: 'Door vote',
      type: 'vote',
      prompt: 'Which door?',
      options: [
        { id: 'left', label: 'The red door' },
        { id: 'right', label: 'The green door' },
      ],
      min: 0,
      max: 10,
      variants: [],
      durationSec: 20,
      resultVarId: 'door',
      tallyVarId: 'tally',
      defaultResult: 'right',
      moderated: true,
    },
  ];
  const cue = (
    id: string,
    sceneId: string,
    name: string,
    actions: Show['cues'][number]['actions'] = [],
  ) => ({
    ...createCue(sceneId, name),
    id,
    actions,
  });
  show.cues = [
    cue('c1', 'hall', 'Lights up'),
    cue('c2', 'hall', 'Ask', [{ type: 'openMoment', momentId: 'vote' }]),
    cue('c3', 'cellar', 'Cellar', [
      { type: 'show', layerId: 'sign', duration: 2, easing: 'linear', delay: 1 },
    ]),
    cue('c4', 'cellar', 'Leave cellar', [{ type: 'jumpScene', sceneId: 'end', fire: false }]),
    cue('c5', 'attic', 'Attic'),
    cue('c6', 'end', 'Ending'),
  ];
  show.rules = [
    {
      id: 'r1',
      name: 'Red wins',
      enabled: true,
      when: { type: 'momentClosed', momentId: 'vote' },
      if: [{ varId: 'door', op: 'eq', value: 'left' }],
      then: [{ type: 'jumpScene', sceneId: 'cellar', fire: false }],
    },
    {
      id: 'r2',
      name: 'Green wins',
      enabled: true,
      when: { type: 'momentClosed', momentId: 'vote' },
      if: [{ varId: 'door', op: 'eq', value: 'right' }],
      then: [{ type: 'jumpScene', sceneId: 'attic', fire: false }],
    },
  ];
  return show;
}

describe('logic', () => {
  it('reads conditions with labels, not keys', () => {
    const show = doors();
    expect(conditionText(show, show.rules[0]!.if[0]!)).toBe('door is The red door');
  });

  it('derives the scene map from fall-through, jumps and rules', () => {
    const g = sceneGraph(doors());
    const edges = g.edges.map((e) => `${e.from}>${e.to}:${e.kind}`);
    expect(edges).toContain('hall>cellar:next');
    expect(edges).toContain('hall>cellar:rule');
    expect(edges).toContain('hall>attic:rule');
    expect(edges).toContain('cellar>end:jump');
    // The cellar's last cue always jumps, so it never falls through into the attic.
    expect(edges).not.toContain('cellar>attic:next');
    expect([...g.reachable].sort()).toEqual(['attic', 'cellar', 'end', 'hall']);
  });

  it('lists cue exits', () => {
    const show = doors();
    expect(cueExits(show, show.cues[1]!)).toEqual(['Cellar', 'Attic']);
    expect(cueExits(show, show.cues[3]!)).toEqual(['Ending']);
  });

  it('a clean show has no problems', () => {
    expect(checkLogic(doors())).toEqual([]);
  });

  it('flags unhandled options, unreachable scenes, broken refs, unread values and loops', () => {
    const show = doors();
    show.moments[0]!.options.push({ id: 'up', label: 'The trapdoor' });
    show.rules[1]!.enabled = false;
    show.cues[5]!.actions.push({ type: 'goToCue', cueId: 'gone', fire: false });
    show.vars.push({ id: 'score', name: 'score', type: 'number', initial: 0 });
    show.rules.push({
      id: 'r3',
      name: 'Feedback',
      enabled: true,
      when: { type: 'varChanged', varId: 'score' },
      if: [],
      then: [{ type: 'addVar', varId: 'score', amount: 1 }],
    });
    const ids = checkLogic(show).map((i) => i.id);
    expect(ids).toContain('unhandled:vote:up');
    expect(ids).toContain('unhandled:vote:right');
    expect(ids).toContain('unreachable:attic');
    expect(ids).toContain('broken:c6:a cue that was deleted');
    expect(ids).toContain('loop:r3');
    expect(unhandledOptions(show, 'vote').map((o) => o.id)).toEqual(['right', 'up']);
  });

  it('finds cues that fire each other with no time between', () => {
    const show = doors();
    const names = () => zeroTimeLoops(show).map((loop) => loop.map((c) => c.name));
    // Ending jumps back to the hallway and fires it; Lights up follows on at once to Ask, whose
    // rule fires the Ending again.
    show.cues[5]!.actions.push({ type: 'jumpScene', sceneId: 'hall', fire: true });
    show.cues[0]!.follow = { auto: true, delay: 0 };
    show.rules.push({
      id: 'r3',
      name: 'Straight to the end',
      enabled: true,
      when: { type: 'cueFired', cueId: 'c2' },
      if: [],
      then: [{ type: 'goToCue', cueId: 'c6', fire: true }],
    });
    expect(names()).toEqual([['Lights up', 'Ask', 'Ending']]);
    expect(checkLogic(show).map((i) => i.text)).toContain(
      'Cues “Lights up”, “Ask” and “Ending” fire each other with no time between, so the show stops them',
    );
    // A follow delay breaks it, and so does a jump that only puts the cue on standby.
    show.cues[0]!.follow = { auto: true, delay: 2 };
    expect(names()).toEqual([]);
    show.cues[0]!.follow = { auto: true, delay: 0 };
    show.cues[5]!.actions = [{ type: 'jumpScene', sceneId: 'hall', fire: false }];
    expect(names()).toEqual([]);
    // A cue that fires itself.
    show.cues[4]!.actions = [{ type: 'goToCue', cueId: 'c5', fire: true }];
    expect(names()).toEqual([['Attic']]);
  });

  it('counts uses', () => {
    const u = usage(doors());
    expect(u.reads('door')).toBe(3); // two rules and the sign's {{door}}
    expect(u.writes('door')).toBe(1); // the vote
    expect(u.usedBy('vote')).toBe(3); // opened by a cue, closed into two rules
  });
});

describe('simulate', () => {
  it('walks the branch the assumed result picks', () => {
    const show = doors();
    expect(walkTo(show, 'c6', { vote: 'left' }).fired).toEqual(['c1', 'c2', 'c3', 'c4', 'c6']);
    expect(walkTo(show, 'c6').fired).toEqual(['c1', 'c2', 'c5', 'c6']); // default: right
    expect(walkTo(show, 'c3').reached).toBe(false);
  });

  it('previews off the path in running order, and runs delayed actions', () => {
    const show = doors();
    const on = previewAt(show, 'c3', { vote: 'left' });
    expect(on.onPath).toBe(true);
    expect(on.state.layers.sign!.opacity.to).toBe(1);
    expect(previewAt(show, 'c3').onPath).toBe(false);
  });

  it('knows which moments come before a cue', () => {
    expect(momentsBefore(doors(), 'c5')).toEqual(['vote']);
    // The cue that opens a moment doesn't assume its result.
    expect(momentsBefore(doors(), 'c2')).toEqual([]);
  });

  it('tries every outcome', () => {
    const outcomes = tryOutcomes(doors(), 'vote');
    expect(outcomes.map((o) => [o.label, o.ran, o.standby?.scene])).toEqual([
      ['The red door', ['Red wins'], 'Cellar'],
      ['The green door', ['Green wins'], 'Attic'],
    ]);
    expect(outcomes[0]!.changes).toEqual([{ name: 'door', before: '', after: 'The red door' }]);
  });

  it('notices when an edit breaks or reroutes a saved path', () => {
    const show = doors();
    const path = bookmarkPath(show, 'c6', { vote: 'left' }, 'Red route');
    expect(checkPath(show, path)).toBe('ok');
    show.cues[3]!.actions = [];
    expect(checkPath(show, path)).toBe('rerouted');
    show.cues = show.cues.filter((c) => c.id !== 'c6');
    expect(checkPath(show, path)).toBe('broken');
  });
});

describe('frames', () => {
  /** doors() with the sign inside a hidden frame that a cue shows. */
  function framed(): Show {
    const show = doors();
    const sign = show.layers[0]!;
    const frame = {
      ...sign,
      id: 'box',
      name: 'Box',
      kind: 'frame',
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
    } as unknown as Layer;
    show.layers = [frame, { ...sign, parentId: 'box' }];
    show.cues[0]!.actions.push({ type: 'show', layerId: 'box', duration: 0, easing: 'linear' });
    return show;
  }

  it('a frame a cue shows is fine', () => {
    expect(checkLogic(framed())).toEqual([]);
  });

  it('flags broken frame links and a frame nothing shows', () => {
    const show = framed();
    show.cues[0]!.actions.pop();
    show.layers.push({ ...show.layers[1]!, id: 'lost', name: 'Lost', parentId: 'gone' });
    show.layers.push({ ...show.layers[1]!, id: 'inSign', name: 'In sign', parentId: 'sign' });
    const issues = checkLogic(show);
    expect(issues.map((i) => i.id)).toEqual(
      expect.arrayContaining(['frame:lost', 'frame:inSign', 'hidden-frame:box']),
    );
    expect(issues.find((i) => i.id === 'frame:lost')).toMatchObject({ area: 'stage' });
  });

  it('deleting a frame deletes what is inside it and every action that used them', () => {
    const show = framed();
    show.cues[1]!.actions.push({ type: 'hide', layerId: 'sign', duration: 0, easing: 'linear' });
    removeLayer(show, 'box');
    expect(show.layers).toEqual([]);
    const used = show.cues.flatMap((c) => c.actions).filter((a) => 'layerId' in a);
    expect(used).toEqual([]);
  });
});
