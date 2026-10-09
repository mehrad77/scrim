import { createCue, createShow, uid, type Cue, type Layer, type Show } from '@scrim/format';
import { readLocal } from './local.js';
import { putInFrame } from './frames.js';
import { syntheticLayer } from './layers.js';
import { createResultVars, newMoment } from './moments.js';

/**
 * Starter shows for the Library's start gallery (UX principle 8): small, real shows that teach
 * one idea each and are ordinary shows once made.
 */
export interface Starter {
  id: string;
  title: string;
  blurb: string;
  make: () => Show;
}

/** What the first-run card asked, applied to every new show on this machine. */
export interface NewShowDefaults {
  /** The physical key that fires GO. */
  goKey: string;
  /** Hold on `[` like QLab, instead of H. */
  qlabKeys: boolean;
}

export const NEW_SHOW_KEY = 'scrim.newShow';

export function newShowDefaults(): NewShowDefaults {
  return readLocal<NewShowDefaults>(NEW_SHOW_KEY, { goKey: 'Space', qlabKeys: false });
}

/** A new, empty show with this machine's GO key. */
export function blankShow(name: string): Show {
  const show = createShow(name);
  const d = newShowDefaults();
  for (const k of show.inputs.keys) {
    if (k.command.type === 'go') k.key = d.goKey;
    if (k.command.type === 'hold' && d.qlabKeys) k.key = 'BracketLeft';
  }
  return show;
}

function text(show: Show, name: string, body: string, y: number, fontSize = 96): Layer {
  const out = show.outputs[0]!;
  const layer = syntheticLayer(show, out, 'text');
  return {
    ...layer,
    name,
    y: Math.round(out.height * y),
    ...(layer.kind === 'text' ? { text: body, fontSize } : {}),
  } as Layer;
}

const fade = { duration: 1, easing: 'easeInOut' as const };

function cue(sceneId: string, name: string, actions: Cue['actions'], notes = ''): Cue {
  return { ...createCue(sceneId, name), actions, notes };
}

function voteThatBranches(): Show {
  const show = blankShow('Audience vote');
  const [intro, left, right, end] = ['Welcome', 'Path A', 'Path B', 'Ending'].map((name) => ({
    id: uid('scn'),
    name,
  }));
  show.scenes = [intro!, left!, right!, end!];
  const title = text(show, 'Title', 'Welcome', 0.375);
  show.layers.push(title);
  const question = text(show, 'Question', 'Which way do we go?', 0.2, 80);
  show.layers.push(question);
  const a = text(show, 'Path A', 'You chose A', 0.375);
  show.layers.push(a);
  const b = text(show, 'Path B', 'You chose B', 0.375);
  show.layers.push(b);

  const vote = newMoment('vote', show);
  vote.name = 'Which way';
  vote.prompt = 'Which way do we go?';
  vote.options = [
    { id: 'a', label: 'Path A' },
    { id: 'b', label: 'Path B' },
  ];
  vote.defaultResult = 'a';
  createResultVars(show, vote);
  show.moments.push(vote);

  show.cues = [
    cue(intro!.id, 'Title up', [{ type: 'show', layerId: title.id, ...fade }]),
    cue(
      intro!.id,
      'Ask the audience',
      [
        { type: 'hide', layerId: title.id, ...fade },
        { type: 'show', layerId: question.id, ...fade },
        { type: 'openMoment', momentId: vote.id },
      ],
      'Phones light up now. The vote closes by itself after 20 s.',
    ),
    cue(left!.id, 'Path A', [
      { type: 'hide', layerId: question.id, ...fade },
      { type: 'show', layerId: a.id, ...fade },
    ]),
    cue(left!.id, 'Leave A', [{ type: 'jumpScene', sceneId: end!.id, fire: false }]),
    cue(right!.id, 'Path B', [
      { type: 'hide', layerId: question.id, ...fade },
      { type: 'show', layerId: b.id, ...fade },
    ]),
    cue(end!.id, 'Blackout', [{ type: 'stopAll', duration: 2 }]),
  ];
  show.rules = vote.options.map((o, i) => ({
    id: uid('rul'),
    name: `${o.label} wins`,
    enabled: true,
    when: { type: 'momentClosed' as const, momentId: vote.id },
    if: [{ varId: vote.resultVarId!, op: 'eq' as const, value: o.id }],
    then: [{ type: 'jumpScene' as const, sceneId: (i === 0 ? left : right)!.id, fire: false }],
  }));
  return show;
}

function slidesWithCues(): Show {
  const show = blankShow('Slides');
  const scene = show.scenes[0]!;
  scene.name = 'Talk';
  const slides = ['Title slide', 'First point', 'Second point', 'Thank you'].map((t, i) =>
    text(show, `Slide ${i + 1}`, t, 0.375),
  );
  show.layers.push(...slides);
  show.defaultFade = { duration: 0.5, easing: 'easeInOut' };
  show.cues = slides.map((s, i) =>
    cue(
      scene.id,
      `Slide ${i + 1}`,
      [
        ...(i > 0
          ? [
              {
                type: 'hide' as const,
                layerId: slides[i - 1]!.id,
                duration: 0.5,
                easing: 'easeInOut' as const,
              },
            ]
          : []),
        { type: 'show', layerId: s.id, duration: 0.5, easing: 'easeInOut' },
      ],
      i === 0 ? 'Drop images on the Stage to replace the text slides.' : '',
    ),
  );
  show.cues.push(cue(scene.id, 'Fade out', [{ type: 'stopAll', duration: 2 }]));
  return show;
}

function performerCounter(): Show {
  const show = blankShow('Performer counter');
  const scene = show.scenes[0]!;
  const bell = { id: uid('trg'), name: 'Bell', color: '#d97706' };
  show.triggers.push(bell);
  const varId = uid('var');
  show.vars.push({ id: varId, name: 'bells', type: 'number', initial: 0 });
  // A bar that grows with the count, centred at the bottom whatever size the output is.
  const out = show.outputs[0]!;
  const bar = syntheticLayer(show, out, 'frame');
  if (bar.kind === 'frame') {
    Object.assign(bar, {
      name: 'Count bar',
      visible: false,
      fill: '#b45309',
      radius: 16,
      pin: { x: 'center', y: 'bottom' },
    });
    bar.layout = { ...bar.layout, padX: 48, padY: 20 };
  }
  show.layers.push(bar);
  const count = {
    ...text(show, 'Bell count', 'Bells rung: {{bells}}', 0.375),
    sizing: 'autoWidth',
  };
  show.layers.push(count as Layer);
  putInFrame(show, count as Layer, bar.id);
  show.rules.push({
    id: uid('rul'),
    name: 'Bell counts',
    enabled: true,
    when: { type: 'trigger', triggerId: bell.id },
    if: [],
    then: [{ type: 'addVar', varId, amount: 1 }],
  });
  show.inputs.keys.push({ key: 'KeyB', command: { type: 'trigger', triggerId: bell.id } });
  show.cues = [
    cue(
      scene.id,
      'Show the count',
      [{ type: 'show', layerId: bar.id, ...fade }],
      'Ring the bell from a performer phone (Audience panel › Performer remote QR) or press B.',
    ),
    { ...cue(scene.id, 'Big finish', [{ type: 'stopAll', duration: 2 }]), waitFor: bell.id },
  ];
  return show;
}

export const STARTERS: Starter[] = [
  {
    id: 'vote',
    title: 'Audience vote that branches',
    blurb: 'Phones vote; each answer goes to its own scene.',
    make: voteThatBranches,
  },
  {
    id: 'slides',
    title: 'Slides with cues',
    blurb: 'Four slides, one cue each, with soft fades.',
    make: slidesWithCues,
  },
  {
    id: 'counter',
    title: 'Performer button counter',
    blurb: 'A performer’s phone button that counts on stage.',
    make: performerCounter,
  },
];
