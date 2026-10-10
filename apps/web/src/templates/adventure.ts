import { uid, type Action, type CounterLayer, type Layer } from '@scrim/format';
import { addCue, addScene, say } from '../lib/build/common.js';
import { buildChoice } from '../lib/build/choice.js';
import { did } from '../lib/learn.js';
import { syntheticLayer } from '../lib/layers.js';
import {
  addMedia,
  fade,
  FULL,
  joinCard,
  kit,
  musicIn,
  play,
  musicOut,
  panel,
  picture,
  place,
  sound,
  startShow,
  type,
  words,
  type Face,
} from './layout.js';
import type { TemplateSeed } from './types.js';

/** A storybook at night: deep teal, gold frames, parchment pages, Edmund Dulac’s plates. */
const TEAL = 'linear-gradient(160deg, #0f3a40, #04161a)';
const GOLD = '#c9a14a';
const PARCHMENT = '#f3e6c8';
const INK = '#2a1c0d';
const RUST = '#7a2e12';

/** Each page of the story: its plate and what the narrator reads. */
const PAGES = {
  dark: {
    key: 'scene-1',
    text: 'One night, the lighthouse at the edge of the map went dark. Wren, the fisher’s child, untied the little boat and rowed out into the mist to find its light.',
  },
  storm: {
    key: 'scene-2',
    text: 'Then the storm came. Great waves threw the boat towards the rocks, and Wren saw two ways to go.',
  },
  sea: {
    key: 'scene-3',
    text: 'Wren dived into the wild sea. A mermaid caught her hand and swam down, down, past the crashing waves.',
  },
  king: {
    key: 'scene-5',
    text: 'Deep below, the Sea King’s coral glowed like a thousand lamps. He gave Wren a pearl full of light, and the lighthouse shone again.',
  },
  castle: {
    key: 'scene-4',
    text: 'Up on the hill stood a castle with not one light in its windows. The wind whispered: which way now?',
  },
  home: {
    key: 'scene-6',
    text: 'Wren followed the river home. Grandmother had lit every lamp in the cottage, and from the jetty, Wren saw the lighthouse shining.',
  },
  sky: {
    key: 'scene-7',
    text: 'From the tallest tower, Wren called to the Snow Queen. She swept across the sky, and the stars came down to light every window, and the lighthouse too.',
  },
} as const;

export const ADVENTURE: TemplateSeed = {
  id: 'adventure',
  title: 'The Lost Light',
  group: 'family',
  forWho: 'A child making a story for friends to play, with a grown-up nearby',
  blurb:
    'A choose-your-own-adventure in Edmund Dulac’s storybook pictures: guests choose on their parents’ phones, the story changes, and there are three different endings to find.',
  needs: ['A TV or laptop screen', 'The internet, so guests can choose on phones (or count hands)'],
  replace: [
    'The pictures: a photo of your own drawing works',
    'The story’s words',
    'The choices and where they lead',
  ],
  limits: ['Scrim can’t draw or record yet: take a photo of a drawing and drop it in.'],
  assets: [
    { key: 'display', path: 'fonts/Fraunces.woff2' },
    { key: 'italic', path: 'fonts/Fraunces-Italic.woff2' },
    ...Object.values(PAGES).map((p) => ({ key: p.key, path: `adventure/${p.key}.webp` })),
    { key: 'tense', path: 'adventure/music-tense.m4a' },
    { key: 'calm', path: 'adventure/music-calm.m4a' },
  ],
  learn: [
    {
      id: 'title',
      title: 'Give it your own title',
      hint: 'Stage tab: click the title and type.',
      done: did.text('Title'),
    },
    {
      id: 'drawing',
      title: 'Put in your own drawing',
      hint: 'Take a photo of it, then drop it onto one of the pictures on the Stage tab.',
      done: did.ownMedia,
    },
    {
      id: 'choice',
      title: 'Change what a choice says',
      hint: 'Interaction tab: open “Where should Wren go” and change its answers.',
      done: did.moments,
    },
    {
      id: 'ending',
      title: 'Add another ending',
      hint: 'Interaction tab › Add › Ask the audience, and choose “A new scene named after it”.',
      done: did.scenes,
    },
    {
      id: 'play',
      title: 'Play it with your guests',
      hint: 'Run the show, open the audience room, and let them choose on the phones.',
      done: did.decided,
    },
  ],
  heroes: [
    'Title',
    'The storm',
    'Where should Wren go?',
    'Into the sea',
    'The castle',
    'Home again',
    'The Snow Queen',
  ],
  visual: {
    minText: 56,
    minContrast: 4.5,
    labels: ['Story kicker', 'Choice hint', 'Join card · code'],
  },
  make(media) {
    const show = startShow('The Lost Light');
    addMedia(show, media);
    show.editor = { mode: 'simple' };
    show.operator = { layout: 'simple' };
    show.safety = { noFreeText: true };
    show.defaultFade = { duration: 1.2, easing: 'easeInOut' };
    const k = kit(show);
    const display: Face = { font: media.display!, weight: 600 };
    const italic: Face = { font: media.italic!, weight: 500, italic: true };

    const night = panel(k, 'Night', FULL, TEAL);
    night.visible = true;
    const inNight = <L extends Layer>(l: L, x: number, y: number): L => {
      place(k, night, l, { x, y });
      l.visible = false;
      return l;
    };

    // The plates, each framed in gold on the left.
    const plates = Object.fromEntries(
      Object.entries(PAGES).map(([name, p]) => {
        const frame = inNight(
          panel(k, `Plate · ${name}`, { x: 0, y: 0, w: 720, h: 960 }, GOLD, {
            radius: 6,
            clip: true,
          }),
          120,
          60,
        );
        place(
          k,
          frame,
          picture(
            k,
            media[p.key]!,
            `Picture · ${name}`,
            { x: 0, y: 0, w: 700, h: 940 },
            { fit: 'contain' },
          ),
          { x: 10, y: 10 },
        );
        return [name, frame];
      }),
    ) as Record<keyof typeof PAGES, Layer>;
    const page = (on: Layer): Action[] =>
      Object.values(plates).map((p) => fade(p.id, p === on, 1.4));

    // The page on the right: parchment, with the story in it.
    const parchment = inNight(
      panel(k, 'Page', { x: 0, y: 0, w: 924, h: 960 }, PARCHMENT, { radius: 8 }),
      900,
      60,
    );
    const kicker = place(
      k,
      parchment,
      words(k, 'Story kicker', { x: 0, y: 0, w: 812, h: 50 }, 'A story where you choose', {
        ...type({ ...display, weight: 700, uppercase: true, letterSpacing: 0.16 }, 32, RUST),
      }),
      { x: 56, y: 70 },
    );
    const title = place(
      k,
      parchment,
      words(k, 'Title', { x: 0, y: 0, w: 812, h: 380 }, 'The Lost\nLight', {
        ...type({ ...italic, lineHeight: 1 }, 170, INK),
      }),
      { x: 56, y: 160 },
    );
    const story = place(
      k,
      parchment,
      words(k, 'Story', { x: 0, y: 0, w: 812, h: 520 }, '', {
        ...type({ ...display, weight: 500, lineHeight: 1.28 }, 56, INK),
        align: 'left',
      }),
      { x: 56, y: 70 },
    );
    const question = place(
      k,
      parchment,
      words(k, 'Question', { x: 0, y: 0, w: 812, h: 190 }, '', {
        ...type({ ...italic, weight: 600, lineHeight: 1.05 }, 84, INK),
        align: 'left',
      }),
      { x: 56, y: 70 },
    );
    const choices = place(
      k,
      parchment,
      words(k, 'Choices', { x: 0, y: 0, w: 812, h: 220 }, '', {
        ...type({ ...italic, weight: 600, lineHeight: 1.35 }, 64, RUST),
        align: 'left',
      }),
      { x: 56, y: 300 },
    );
    const hint = place(
      k,
      parchment,
      words(
        k,
        'Choice hint',
        { x: 0, y: 0, w: 420, h: 110 },
        'Choose on a phone,\nor put your hand up',
        {
          ...type({ ...display, weight: 600, lineHeight: 1.3 }, 36, INK),
          align: 'left',
        },
      ),
      { x: 370, y: 610 },
    );
    const theEnd = place(
      k,
      parchment,
      words(k, 'The end', { x: 0, y: 0, w: 812, h: 300 }, 'The End\nPlay again?', {
        ...type({ ...italic, lineHeight: 1.1 }, 104, RUST),
      }),
      { x: 56, y: 620 },
    );
    for (const l of [kicker, title, story, question, choices, hint, theEnd]) l.visible = false;
    const dial = place(
      k,
      parchment,
      panel(k, 'Countdown ring', { x: 0, y: 0, w: 150, h: 150 }, GOLD, { radius: 75 }),
      { x: 370, y: 770 },
    );
    dial.visible = false;
    const clock = syntheticLayer(show, k.out, 'countdown') as CounterLayer;
    Object.assign(clock, {
      name: 'Countdown',
      x: 0,
      y: 0,
      w: 150,
      h: 150,
      start: 15,
      format: 'number',
      ...type({ ...display, weight: 700 }, 72, INK),
    });
    show.layers.push(clock);
    place(k, dial, clock, { x: 0, y: 0 });
    const join = inNight(
      joinCard(
        k,
        'Join card',
        { x: 0, y: 0, w: 290, h: 370 },
        {
          ink: INK,
          paper: '#fffaf0',
          codeFace: { ...display, weight: 700 },
          codeSize: 44,
          radius: 8,
        },
      ),
      956,
      600,
    );
    join.visible = false;

    const calm = sound(k, media.calm!, 'Calm music', { loop: true, volume: 0.6 });
    const tense = sound(k, media.tense!, 'Storm music', { loop: true, volume: 0.75 });
    const read = (text: string): Action[] => [
      // Any page can follow a jump from an ending: clear its words.
      fade(theEnd.id, false, 0.5),
      fade(story.id, false, 0.5),
      say(story.id, text, 0.5),
      fade(story.id, true, 1, 0.5),
    ];
    const caption = (text: string) => ({ access: { caption: text } });
    // Which question is being asked: a vote left open by a jump mustn't move standby later.
    const asking = {
      id: uid('var'),
      name: 'asking',
      type: 'choice' as const,
      options: ['', 'first', 'second'],
      initial: '',
    };
    show.vars.push(asking);
    /**
     * Every cue starts from a clean page, so a jump into any of them from anywhere (mid-vote,
     * from an ending) shows only what it puts up.
     */
    const clean: Action[] = [
      fade(parchment.id, true, 0.6),
      ...[kicker, title, question, choices, hint, join, dial].map((l) => fade(l.id, false, 0.5)),
      { type: 'setVar', varId: asking.id, value: '' },
    ];

    // Title page.
    const opening = addScene(show, 'Once upon a time');
    addCue(
      show,
      opening.id,
      'Title',
      [
        ...clean,
        fade(theEnd.id, false, 0.6),
        fade(story.id, false, 0.6),
        ...page(plates.dark),
        fade(kicker.id, true, 1.4, 0.4),
        fade(title.id, true, 1.4, 0.6),
        ...musicOut(tense.id, 2),
        // Play again carries on the music that's already up, without a cut.
        play(calm.id),
        fade(calm.id, true, 3),
      ],
      { notes: 'Open the audience room before the guests arrive.' },
    );
    addCue(
      show,
      opening.id,
      'The lighthouse goes dark',
      [...clean, ...read(PAGES.dark.text)],
      caption(PAGES.dark.text),
    );

    // The storm, and the first choice.
    const storm = addScene(show, 'The storm');
    addCue(
      show,
      storm.id,
      'The storm',
      [
        ...clean,
        ...page(plates.storm),
        ...musicOut(calm.id, 2),
        ...musicIn(tense.id, 1),
        ...read(PAGES.storm.text),
      ],
      caption(PAGES.storm.text),
    );
    const ask = (text: string, options: string[], which: string): Action[] => [
      ...clean,
      { type: 'setVar', varId: asking.id, value: which },
      fade(story.id, false, 0.5),
      fade(question.id, false, 0.3),
      say(question.id, text, 0.3),
      fade(question.id, true, 1, 0.3),
      say(choices.id, options.map((o, i) => `${i + 1}  ${o}`).join('\n')),
      fade(choices.id, true, 1),
      fade(hint.id, true, 1),
      fade(join.id, true, 1),
      fade(dial.id, true, 1),
      { type: 'counter', layerId: clock.id, op: 'reset', value: 15 },
      { type: 'counter', layerId: clock.id, op: 'start' },
    ];
    const leave: Action[] = [
      fade(question.id, false, 0.6),
      fade(choices.id, false, 0.6),
      fade(hint.id, false, 0.6),
      fade(join.id, false, 0.6),
      fade(dial.id, false, 0.6),
    ];
    const firstAsk = addCue(
      show,
      storm.id,
      'Where should Wren go?',
      ask('Where should Wren go?', ['Dive into the sea', 'Climb up to the castle'], 'first'),
      caption('Where should Wren go? Dive into the sea, or climb up to the castle?'),
    );

    // The sea: one way down, to the Sea King.
    const sea = addScene(show, 'Into the sea');
    addCue(
      show,
      sea.id,
      'Into the sea',
      [...clean, ...leave, ...page(plates.sea), ...read(PAGES.sea.text)],
      caption(PAGES.sea.text),
    );
    addCue(
      show,
      sea.id,
      'The Sea King',
      [
        ...clean,
        ...page(plates.king),
        ...musicOut(tense.id, 2),
        ...musicIn(calm.id, 2),
        ...read(PAGES.king.text),
      ],
      caption(PAGES.king.text),
    );
    const ending = (sceneId: string): Action[] => [
      fade(theEnd.id, true, 1.4),
      { type: 'jumpScene', sceneId, fire: false },
    ];

    // The castle: a second choice, two more endings.
    const castle = addScene(show, 'The castle');
    addCue(
      show,
      castle.id,
      'The castle',
      [...clean, ...leave, ...page(plates.castle), ...read(PAGES.castle.text)],
      caption(PAGES.castle.text),
    );
    const secondAsk = addCue(
      show,
      castle.id,
      'Which way now?',
      ask('Which way now?', ['Follow the river home', 'Climb the tallest tower'], 'second'),
      caption('Which way now? Follow the river home, or climb the tallest tower?'),
    );
    const home = addScene(show, 'Home again');
    addCue(
      show,
      home.id,
      'Home again',
      [
        ...clean,
        ...leave,
        ...page(plates.home),
        ...musicOut(tense.id, 2),
        ...musicIn(calm.id, 2),
        ...read(PAGES.home.text),
        ...ending(opening.id),
      ],
      caption(PAGES.home.text),
    );
    const sky = addScene(show, 'The Snow Queen');
    addCue(
      show,
      sky.id,
      'The Snow Queen',
      [
        ...clean,
        ...leave,
        ...page(plates.sky),
        ...musicOut(tense.id, 2),
        ...musicIn(calm.id, 2),
        ...read(PAGES.sky.text),
        ...ending(opening.id),
      ],
      caption(PAGES.sky.text),
    );
    // The sea's ending plays again from the top too.
    show.cues.find((c) => c.name === 'The Sea King')!.actions.push(...ending(opening.id));

    // The choices: votes on phones, a rule per answer, and GO closing them early.
    const first = buildChoice(show, {
      question: 'Where should Wren go?',
      options: [
        { label: 'Dive into the sea', to: { sceneId: sea.id } },
        { label: 'Climb up to the castle', to: { sceneId: castle.id } },
      ],
      seconds: 15,
      cueId: firstAsk.id,
    });
    addCue(show, storm.id, 'Wren decides', [
      { type: 'closeMoment', momentId: first.momentId },
      { type: 'counter', layerId: clock.id, op: 'pause' },
    ]);
    const second = buildChoice(show, {
      question: 'Which way now?',
      options: [
        { label: 'Follow the river home', to: { sceneId: home.id } },
        { label: 'Climb the tallest tower', to: { sceneId: sky.id } },
      ],
      seconds: 15,
      cueId: secondAsk.id,
    });
    addCue(show, castle.id, 'Wren chooses', [
      { type: 'closeMoment', momentId: second.momentId },
      { type: 'counter', layerId: clock.id, op: 'pause' },
    ]);
    // Each choice's rules act only while its question is the one being asked.
    for (const [momentId, which] of [
      [first.momentId, 'first'],
      [second.momentId, 'second'],
    ] as const)
      for (const r of show.rules)
        if (r.when.type === 'momentClosed' && r.when.momentId === momentId)
          r.if.push({ varId: asking.id, op: 'eq', value: which });
    return show;
  },
};
