import { uid, type Action, type Layer } from '@scrim/format';
import { addCue, addScene, say } from '../lib/build/common.js';
import { did } from '../lib/learn.js';
import { createResultVars, newMoment } from '../lib/moments.js';
import {
  addMedia,
  fade,
  joinCard,
  kit,
  musicIn,
  musicOut,
  picture,
  place,
  plate,
  rule,
  scrim,
  sfx,
  sound,
  startShow,
  type,
  valueLayer,
  words,
  type Face,
} from './layout.js';
import type { TemplateSeed } from './types.js';

/** A storybook poster: painted meadows, paper plates with hard shadows, one red accent. */
const PAPER = '#fbf3df';
const INK = '#21180e';
const RED = '#b3261e';
const GREEN = '#1f4a2a';
const DUSK = '#14100a';
const BEAT = 1;

export const SCHOOL_PLAY: TemplateSeed = {
  id: 'school-play',
  title: 'The Tortoise and the Hare',
  group: 'schools',
  forWho: 'A teacher putting on a class play, run by the children',
  blurb:
    'Aesop’s fable as a whole play: painted backdrops, a narrator, a whistle for the start, and the parents vote on whether the Hare takes a nap. One big GO that a ten-year-old can run.',
  needs: [
    'The school hall projector, or any big screen',
    'The internet, for parents’ phones (or two big buttons, or a show of hands)',
    'A child at the laptop or tablet to press GO',
  ],
  replace: [
    'Your class’s name on the title',
    'The backdrops: your students’ own paintings',
    'The narration',
    'The cast list',
  ],
  limits: [
    'Phones need the internet; buttons and raised hands work without it.',
    'There’s no view for ushers yet.',
  ],
  assets: [
    { key: 'display', path: 'fonts/Fraunces.woff2' },
    { key: 'italic', path: 'fonts/Fraunces-Italic.woff2' },
    { key: 'body', path: 'fonts/AtkinsonHyperlegibleNext.woff2' },
    { key: 'meadow', path: 'school-play/backdrop-meadow.webp' },
    { key: 'road', path: 'school-play/backdrop-road.webp' },
    { key: 'tree', path: 'school-play/backdrop-tree.webp' },
    { key: 'finish', path: 'school-play/backdrop-finish.webp' },
    { key: 'hare', path: 'school-play/hare.webp' },
    { key: 'tortoise', path: 'school-play/tortoise.webp' },
    { key: 'morning', path: 'school-play/music-morning.m4a' },
    { key: 'race', path: 'school-play/music-race.m4a' },
    { key: 'whistle', path: 'school-play/sfx-whistle.m4a' },
  ],
  learn: [
    {
      id: 'class',
      title: 'Put your class’s name on the title',
      hint: 'Interaction tab › Values: change “class_name”.',
      done: did.value('class_name'),
    },
    {
      id: 'art',
      title: 'Swap a backdrop for your students’ painting',
      hint: 'Stage tab: drop a photo of the painting onto a backdrop.',
      done: did.ownMedia,
    },
    {
      id: 'group',
      title: 'Bring in a group’s scenes',
      hint: 'Cues tab › Build › Scenes from another show: pick the group’s .scrim file.',
      done: did.scenes,
    },
    {
      id: 'vote',
      title: 'Rehearse the vote both ways',
      hint: 'Run the show; at the vote, use Force to try “Yes” and then “No”.',
      done: did.cue('A new ending'),
    },
    {
      id: 'show',
      title: 'Run it in Show mode',
      hint: 'The simple view opens on its own; lock it with Show mode before the parents arrive.',
      done: did.showMode,
    },
  ],
  heroes: ['Title', 'Meet the tortoise', 'Go!', 'The vote', 'Slow and steady', 'Curtain call'],
  visual: {
    minText: 56,
    minContrast: 4.5,
    labels: ['Presents', 'By Aesop', 'Vote hint', 'Character name'],
  },
  make(media) {
    const show = startShow('The Tortoise and the Hare');
    addMedia(show, media);
    show.editor = { mode: 'simple' };
    show.operator = { layout: 'simple', goHoldMs: 400 };
    show.safety = { noFreeText: true };
    show.defaultFade = { duration: BEAT, easing: 'easeInOut' };
    for (let n = 1; n <= 2; n++) {
      show.inputs.keys.push({ key: `Digit${n}`, command: { type: 'countVote', option: n } });
      show.inputs.gamepad.push({ button: n - 1, command: { type: 'countVote', option: n } });
    }
    const k = kit(show);
    const display: Face = { font: media.display!, weight: 800, letterSpacing: -0.01 };
    const italic: Face = { font: media.italic!, weight: 500, italic: true };
    const body: Face = { font: media.body!, weight: 600 };

    show.vars.push({ id: uid('var'), name: 'class_name', type: 'text', initial: 'Class 5B' });
    show.vars.push({
      id: uid('var'),
      name: 'cast',
      type: 'list',
      initial: [
        'The Hare · Sam',
        'The Tortoise · Priya',
        'The Narrator · Jo',
        'The Owl · Alex',
        'Lights and sound · Mia and Leo',
      ],
    });

    const backdrops = {
      meadow: picture(k, media.meadow!, 'Backdrop · meadow'),
      road: picture(k, media.road!, 'Backdrop · road'),
      tree: picture(k, media.tree!, 'Backdrop · tree'),
      finish: picture(k, media.finish!, 'Backdrop · finish'),
    };
    const backdrop = (on: Layer): Action[] =>
      Object.values(backdrops).map((b) => fade(b.id, b === on, 1.5));
    const shade = scrim(k, 'words', 'bottom', DUSK, { reach: 0.45, strength: 0.55 });

    // The title plate.
    const title = plate(k, 'Title plate', { x: 360, y: 200, w: 1200, h: 600 }, PAPER);
    place(
      k,
      title.paper,
      words(k, 'Presents', { x: 0, y: 0, w: 1200, h: 60 }, '{{class_name}} presents', {
        ...type({ ...body, weight: 700, uppercase: true, letterSpacing: 0.18 }, 40, RED),
      }),
      { x: 0, y: 70 },
    );
    place(
      k,
      title.paper,
      words(k, 'Play title', { x: 0, y: 0, w: 1100, h: 340 }, 'The Tortoise\nand the Hare', {
        ...type({ ...display, lineHeight: 1.0 }, 150, INK),
      }),
      { x: 50, y: 150 },
    );
    place(
      k,
      title.paper,
      words(
        k,
        'By Aesop',
        { x: 0, y: 0, w: 1200, h: 70 },
        'A fable by Aesop',
        type(italic, 52, GREEN),
      ),
      { x: 0, y: 500 },
    );

    // Character cards: a picture on paper with a name under it.
    const character = (key: 'hare' | 'tortoise', name: string, x: number) => {
      const card = plate(k, `${name} card`, { x, y: 120, w: 620, h: 600 }, PAPER, { radius: 12 });
      place(
        k,
        card.paper,
        picture(k, media[key]!, name, { x: 0, y: 0, w: 560, h: 450 }, { fit: 'contain' }),
        { x: 30, y: 30 },
      );
      place(
        k,
        card.paper,
        words(k, 'Character name', { x: 0, y: 0, w: 620, h: 90 }, name, type(display, 64, INK)),
        { x: 0, y: 490 },
      );
      return card.outer;
    };
    const hare = character('hare', 'The Hare', 220);
    const tortoise = character('tortoise', 'The Tortoise', 1066);

    // The narrator's plate, low on the stage.
    const line = plate(k, 'Narration plate', { x: 160, y: 800, w: 1600, h: 200 }, PAPER, {
      radius: 14,
    });
    const narration = place(
      k,
      line.paper,
      words(k, 'Narration', { x: 0, y: 0, w: 1504, h: 160 }, '', {
        ...type({ ...body, weight: 600, lineHeight: 1.15 }, 60, INK),
      }),
      { x: 48, y: 20 },
    );
    narration.visible = false;
    const narrate = (text: string): Action[] => [
      fade(line.outer.id, true, BEAT),
      fade(narration.id, false, 0.4),
      say(narration.id, text, 0.4),
      fade(narration.id, true, 0.8, 0.4),
    ];
    const big = words(k, 'Big words', { x: 96, y: 300, w: 1728, h: 300 }, '', {
      ...type({ ...display, lineHeight: 1 }, 220, PAPER),
      shadow: 'strong',
    });

    const morning = sound(k, media.morning!, 'Morning Mood', { volume: 0.6 });
    const race = sound(k, media.race!, 'The race', { volume: 0.75 });
    const whistle = sound(k, media.whistle!, 'Whistle', { volume: 1 });
    const blow = { id: uid('trg'), name: 'Whistle', color: '#b3261e' };
    show.triggers.push(blow);
    show.inputs.keys.push({ key: 'KeyB', command: { type: 'trigger', triggerId: blow.id } });
    rule(show, 'The whistle blows', { type: 'trigger', triggerId: blow.id }, [], sfx(whistle.id));

    const caption = (text: string) => ({ access: { caption: text } });

    // 1. Curtain up.
    const curtain = addScene(show, 'Curtain up');
    addCue(
      show,
      curtain.id,
      'Title',
      [
        ...backdrop(backdrops.meadow),
        fade(title.outer.id, true, 1.5, 0.8),
        ...musicIn(morning.id, 3),
      ],
      { notes: 'Before this, open the audience room so parents can scan the code at the vote.' },
    );

    // 2. The challenge.
    const challenge = addScene(show, 'The challenge');
    const t1 = 'Hare was the fastest animal in the meadow, and he never stopped saying so.';
    addCue(
      show,
      challenge.id,
      'Meet the hare',
      [
        fade(title.outer.id, false, BEAT),
        fade(shade.id, true, BEAT),
        fade(hare.id, true, BEAT, 0.5),
        ...narrate(t1),
      ],
      caption(t1),
    );
    const t2 = 'Tortoise was slow. But Tortoise never, ever gave up.';
    addCue(
      show,
      challenge.id,
      'Meet the tortoise',
      [fade(tortoise.id, true, BEAT), ...narrate(t2)],
      caption(t2),
    );
    const t3 = '“Race me,” said Tortoise. And all the animals laughed.';
    addCue(show, challenge.id, 'The challenge', [...narrate(t3)], caption(t3));

    // 3. The race begins.
    const start = addScene(show, 'The race begins');
    addCue(
      show,
      start.id,
      'On your marks',
      [
        fade(hare.id, false, BEAT),
        fade(tortoise.id, false, BEAT),
        fade(line.outer.id, false, BEAT),
        ...backdrop(backdrops.road),
        ...musicOut(morning.id, 2),
        say(big.id, 'On your marks…'),
        fade(big.id, true, BEAT, 1),
      ],
      caption('On your marks…'),
    );
    const t4 = 'And they’re off! Hare shot away like an arrow.';
    addCue(
      show,
      start.id,
      'Go!',
      [fade(big.id, false, 0.3), ...sfx(whistle.id), ...musicIn(race.id, 0.5), ...narrate(t4)],
      caption(t4),
    );

    // 4. The nap: the parents decide.
    const nap = addScene(show, 'The nap');
    const t5 = 'Hare was so far ahead that he stopped under a tree and looked back, grinning.';
    addCue(
      show,
      nap.id,
      'Halfway',
      [...backdrop(backdrops.tree), ...musicOut(race.id, 3), ...narrate(t5)],
      caption(t5),
    );
    const vote = newMoment('vote', show);
    vote.name = 'The nap';
    vote.prompt = 'Should the Hare stop for a nap?';
    vote.durationSec = 30;
    vote.options = [
      { id: 'a', label: 'Yes, a little nap' },
      { id: 'b', label: 'No, keep running' },
    ];
    vote.defaultResult = 'a';
    createResultVars(show, vote);
    show.moments.push(vote);
    const ask = plate(k, 'Vote plate', { x: 120, y: 150, w: 1180, h: 640 }, PAPER, { radius: 14 });
    place(
      k,
      ask.paper,
      words(
        k,
        'Vote question',
        { x: 0, y: 0, w: 1080, h: 240 },
        'Should the Hare\nstop for a nap?',
        type({ ...display, lineHeight: 1.02 }, 104, INK),
      ),
      { x: 50, y: 40 },
    );
    place(
      k,
      ask.paper,
      words(
        k,
        'Vote options',
        { x: 0, y: 0, w: 1080, h: 200 },
        '1   Yes, a little nap\n2   No, keep running',
        { ...type({ ...body, lineHeight: 1.4 }, 64, GREEN), align: 'left' },
      ),
      { x: 70, y: 300 },
    );
    place(
      k,
      ask.paper,
      words(
        k,
        'Vote hint',
        { x: 0, y: 0, w: 1080, h: 60 },
        'Vote on your phone, or put your hand up',
        type({ ...body, weight: 500 }, 40, RED),
      ),
      { x: 50, y: 540 },
    );
    const join = joinCard(
      k,
      'Join card',
      { x: 1380, y: 150, w: 420, h: 540 },
      {
        ink: INK,
        paper: PAPER,
        codeFace: { ...body, weight: 700 },
        codeSize: 64,
        radius: 14,
      },
    );
    addCue(
      show,
      nap.id,
      'The vote',
      [
        fade(line.outer.id, false, BEAT),
        fade(ask.outer.id, true, BEAT),
        fade(join.id, true, BEAT, 0.3),
        { type: 'openMoment', momentId: vote.id },
      ],
      caption('Should the Hare stop for a nap? Vote on your phone.'),
    );
    // GO before the time is up closes the vote; its rule puts the right ending on standby.
    addCue(show, nap.id, 'The vote closes', [{ type: 'closeMoment', momentId: vote.id }]);

    // 5. Two finishes, then the curtain call.
    const moral = words(k, 'Moral', { x: 96, y: 160, w: 1728, h: 260 }, '', {
      ...type({ ...italic, lineHeight: 1.05 }, 120, PAPER),
      shadow: 'strong',
    });
    const call = addScene(show, 'Curtain call');
    const ending = (name: string, story: string, lesson: string) => {
      const scene = addScene(show, name);
      addCue(
        show,
        scene.id,
        name === 'Slow and steady' ? 'Slow and steady' : 'A new ending',
        [
          fade(ask.outer.id, false, BEAT),
          fade(join.id, false, BEAT),
          ...backdrop(backdrops.finish),
          ...narrate(story),
        ],
        caption(story),
      );
      addCue(
        show,
        scene.id,
        `${name}: the moral`,
        [
          say(moral.id, lesson),
          fade(moral.id, true, 1.5),
          { type: 'jumpScene', sceneId: call.id, fire: false },
        ],
        caption(lesson),
      );
      return scene;
    };
    // Curtain call goes last in the running order.
    show.scenes.pop();
    const classic = ending(
      'Slow and steady',
      'Hare woke with a start. Too late! Tortoise was crossing the finish line.',
      'Slow and steady\nwins the race.',
    );
    const kind = ending(
      'A new ending',
      'Hare kept running and won. Then he waited at the line, and they walked home together.',
      'Winning is better\nwith a friend.',
    );
    show.scenes.push(call);
    for (const [id, scene] of [
      ['a', classic],
      ['b', kind],
    ] as const)
      rule(
        show,
        `The nap: ${scene.name}`,
        { type: 'momentClosed', momentId: vote.id },
        [{ varId: vote.resultVarId!, op: 'eq', value: id }],
        [{ type: 'jumpScene', sceneId: scene.id, fire: false }],
      );

    const bows = plate(k, 'Cast plate', { x: 460, y: 140, w: 1000, h: 780 }, PAPER, { radius: 14 });
    place(
      k,
      bows.paper,
      words(
        k,
        'Cast title',
        { x: 0, y: 0, w: 1000, h: 140 },
        'Thank you\nfor coming!',
        type({ ...display, lineHeight: 1 }, 70, INK),
      ),
      { x: 0, y: 50 },
    );
    const castVar = show.vars.find((v) => v.name === 'cast')!;
    place(
      k,
      bows.paper,
      valueLayer(k, 'Cast', { x: 0, y: 0, w: 900, h: 470 }, castVar.id, {
        ...type({ ...body, weight: 600, lineHeight: 1.45 }, 56, GREEN),
        display: 'list',
      }),
      { x: 50, y: 250 },
    );
    addCue(show, call.id, 'Curtain call', [
      fade(moral.id, false, BEAT),
      fade(line.outer.id, false, BEAT),
      fade(shade.id, false, BEAT),
      fade(bows.outer.id, true, 1.5),
      ...musicIn(morning.id, 2),
    ]);
    addCue(show, call.id, 'Lights down', [
      fade(bows.outer.id, false, 3),
      ...Object.values(backdrops).map((b) => fade(b.id, false, 3)),
      ...musicOut(morning.id, 4),
    ]);
    return show;
  },
};
