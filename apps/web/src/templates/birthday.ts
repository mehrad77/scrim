import { uid, type Action } from '@scrim/format';
import { addCue, addScene, follows, say } from '../lib/build/common.js';
import { did } from '../lib/learn.js';
import { createResultVars, newMoment } from '../lib/moments.js';
import {
  addMedia,
  fade,
  FULL,
  joinCard,
  kit,
  musicIn,
  musicOut,
  panel,
  picture,
  place,
  play,
  rule,
  sfx,
  sound,
  startShow,
  type,
  valueLayer,
  words,
  type Face,
} from './layout.js';
import type { TemplateSeed } from './types.js';

/** A party at midnight: gold and coral on deep violet, rounded type, photos as Polaroids. */
const NIGHT = 'linear-gradient(160deg, #2a1650, #0b0620)';
const GOLD = '#ffcf5a';
const CORAL = '#ff8a7a';
const CREAM = '#fff6e8';
const INK = '#2a1a12';
const POLAROID = '#fffdf8';

/** The photos through the years, each with what it says under it. */
export const YEARS: { key: string; caption: string }[] = [
  { key: 'photo-1', caption: 'Where it all began' },
  { key: 'photo-2', caption: 'School days' },
  { key: 'photo-3', caption: 'Fun at the fair' },
  { key: 'photo-4', caption: 'The first job' },
  { key: 'photo-5', caption: 'Out dancing' },
  { key: 'photo-6', caption: 'Family dinners' },
  { key: 'photo-7', caption: 'Summers to remember' },
  { key: 'photo-8', caption: 'Many happy returns' },
];
/** The decade the guess photo was taken in, and the choices guests get. */
export const GUESS = { options: ['1930s', '1940s', '1950s', '1960s'], right: 1 };
const CANDLES = 50;

export const BIRTHDAY: TemplateSeed = {
  id: 'birthday',
  title: 'Happy 80th!',
  group: 'family',
  forWho: 'A family planning a surprise for a grandparent’s birthday',
  blurb:
    'Their name in lights, a lifetime of photos under music, a game where guests guess the year, and everyone tapping their phones together to blow out the candles.',
  needs: [
    'A TV at the party',
    'The internet, so guests’ phones can join',
    'A folder of their photos',
  ],
  replace: [
    'Their name and age',
    'The photos and what each one says',
    'The guessing game’s photo and answer',
  ],
  limits: ['There’s no camera or recording inside Scrim yet: add photos as files.'],
  assets: [
    { key: 'display', path: 'fonts/Fredoka.woff2' },
    { key: 'body', path: 'fonts/AtkinsonHyperlegibleNext.woff2' },
    ...YEARS.map((y) => ({ key: y.key, path: `birthday/${y.key}.webp` })),
    { key: 'guess', path: 'birthday/photo-guess.webp' },
    { key: 'cake', path: 'birthday/cake.webp' },
    { key: 'fireworks', path: 'birthday/video-fireworks.mp4' },
    { key: 'story', path: 'birthday/music-story.m4a' },
    { key: 'song', path: 'birthday/music-birthday.m4a' },
  ],
  learn: [
    {
      id: 'name',
      title: 'Type their name',
      hint: 'Interaction tab › Values: change “name” (and “age”).',
      done: did.value('name'),
    },
    {
      id: 'photos',
      title: 'Put in their photos',
      hint: 'Stage tab: drop a photo onto each Polaroid.',
      done: did.ownMedia,
    },
    {
      id: 'guess',
      title: 'Change the guessing game',
      hint: 'Interaction tab: open “Guess the year” and set its answers.',
      done: did.moments,
    },
    {
      id: 'candles',
      title: 'Blow out the candles from your phone',
      hint: 'Run it, open the audience room, scan the code and tap away.',
      done: did.room,
    },
    {
      id: 'tv',
      title: 'Put it on the TV',
      hint: 'In the operator view, Go live opens it full screen on the TV.',
      done: did.go,
    },
  ],
  heroes: [
    'Happy birthday',
    'Surprise!',
    'photo-3',
    'Guess the year',
    'It was the 1940s',
    'Blow out the candles',
  ],
  games: ['Guess the year', 'Candles'],
  visual: {
    minText: 56,
    minContrast: 4.5,
    labels: ['Join line', 'Guess hint', 'Join card · code'],
  },
  make(media) {
    const show = startShow('Happy 80th!');
    addMedia(show, media);
    show.editor = { mode: 'simple' };
    show.operator = { layout: 'simple' };
    show.safety = { noFreeText: true };
    show.defaultFade = { duration: 1.2, easing: 'easeInOut' };
    const k = kit(show);
    const display: Face = { font: media.display!, weight: 600 };
    const body: Face = { font: media.body!, weight: 600 };
    show.vars.push({ id: uid('var'), name: 'name', type: 'text', initial: 'Sam' });
    show.vars.push({ id: uid('var'), name: 'age', type: 'text', initial: '80th' });

    const stage = panel(k, 'Party', FULL, NIGHT);
    stage.visible = true;
    const inStage = <L extends { id: string; x: number; y: number; visible: boolean }>(
      l: L,
      x: number,
      y: number,
    ) => {
      place(k, stage, l, { x, y });
      l.visible = false;
      return l;
    };

    // Surprise! Their name, big, and how guests join, with confetti in the corners.
    const confetti = inStage(panel(k, 'Confetti', FULL, 'transparent'), 0, 0);
    const DOTS: [number, number, number, string][] = [
      [140, 90, 34, GOLD],
      [300, 60, 18, CORAL],
      [520, 120, 24, CREAM],
      [1620, 70, 30, CORAL],
      [1780, 160, 20, GOLD],
      [1450, 130, 16, CREAM],
      [110, 980, 26, CORAL],
      [260, 1010, 16, GOLD],
      [1180, 1000, 22, GOLD],
      [980, 60, 14, CORAL],
      [760, 1020, 18, CREAM],
      [1860, 600, 18, CREAM],
      [60, 560, 22, GOLD],
      [1250, 70, 12, GOLD],
    ];
    DOTS.forEach(
      ([x, y, d, colour], i) =>
        (place(
          k,
          confetti,
          panel(k, `Confetti ${i + 1}`, { x: 0, y: 0, w: d, h: d }, colour, { radius: d / 2 }),
          { x, y },
        ).visible = true),
    );
    const hello = inStage(
      words(k, 'Happy', { x: 0, y: 0, w: 1270, h: 160 }, 'Happy {{age}} birthday,', {
        ...type(display, 96, CREAM),
        align: 'left',
      }),
      96,
      240,
    );
    const name = inStage(
      words(k, 'Name', { x: 0, y: 0, w: 1220, h: 560 }, '{{name}}!', {
        ...type({ ...display, weight: 700, lineHeight: 0.95 }, 280, GOLD),
        align: 'left',
      }),
      96,
      360,
    );
    const join = inStage(
      joinCard(
        k,
        'Join card',
        { x: 0, y: 0, w: 400, h: 500 },
        {
          ink: INK,
          paper: POLAROID,
          codeFace: { ...display, weight: 700 },
          codeSize: 64,
          radius: 18,
        },
      ),
      1400,
      260,
    );
    const joinLine = inStage(
      words(k, 'Join line', { x: 0, y: 0, w: 400, h: 110 }, 'Scan to join\nthe fun', {
        ...type({ ...body, weight: 600, lineHeight: 1.2 }, 44, CORAL),
      }),
      1400,
      790,
    );
    const story = sound(k, media.story!, 'Through the years music', { volume: 0.7 });
    const song = sound(k, media.song!, 'Happy Birthday', { volume: 0.9 });

    const party = addScene(show, 'Surprise');
    addCue(
      show,
      party.id,
      'Surprise!',
      [
        fade(confetti.id, true, 1.2),
        fade(hello.id, true, 1.2),
        fade(name.id, true, 1.2, 0.5),
        fade(joinLine.id, true, 1.2, 1.5),
        fade(join.id, true, 1.2, 1.5),
      ],
      {
        notes: 'Open the audience room first, so the code on screen works.',
        access: { caption: 'Happy birthday!' },
      },
    );

    // Through the years: each photo on its own Polaroid, dissolving into the next.
    const polaroid = (key: string, caption: string, mediaKey = key) => {
      const frame = inStage(
        panel(k, `Polaroid ${key}`, { x: 0, y: 0, w: 1000, h: 860 }, POLAROID, { radius: 6 }),
        460,
        110,
      );
      place(k, frame, picture(k, media[mediaKey]!, key, { x: 0, y: 0, w: 920, h: 680 }), {
        x: 40,
        y: 40,
      });
      place(
        k,
        frame,
        words(
          k,
          `Caption ${key}`,
          { x: 0, y: 0, w: 920, h: 110 },
          caption,
          type({ ...display, weight: 500 }, 64, INK),
        ),
        { x: 40, y: 730 },
      );
      return frame;
    };
    const years = addScene(show, 'Through the years');
    const frames = YEARS.map((y) => polaroid(y.key, y.caption));
    frames.forEach((frame, i) => {
      const actions: Action[] = [fade(frame.id, true, 1.5)];
      if (i > 0) actions.push(fade(frames[i - 1]!.id, false, 1.5));
      else
        actions.push(
          fade(confetti.id, false, 1),
          fade(hello.id, false, 1),
          fade(name.id, false, 1),
          fade(joinLine.id, false, 1),
          fade(join.id, false, 1),
          ...musicIn(story.id, 2),
        );
      addCue(show, years.id, YEARS[i]!.key, actions, {
        ...(i < frames.length - 1 ? follows(7) : {}),
        access: { caption: YEARS[i]!.caption },
      });
    });

    // Guess the year.
    const guess = newMoment('vote', show);
    guess.name = 'Guess the year';
    guess.prompt = 'When was this photo taken?';
    guess.durationSec = 30;
    guess.options = GUESS.options.map((label, i) => ({ id: String.fromCharCode(97 + i), label }));
    guess.defaultResult = '';
    createResultVars(show, guess);
    show.moments.push(guess);
    const guessFrame = inStage(
      panel(k, 'Guess Polaroid', { x: 0, y: 0, w: 860, h: 820 }, POLAROID, { radius: 6 }),
      120,
      130,
    );
    place(k, guessFrame, picture(k, media.guess!, 'Guess photo', { x: 0, y: 0, w: 780, h: 640 }), {
      x: 40,
      y: 40,
    });
    place(
      k,
      guessFrame,
      words(
        k,
        'Guess caption',
        { x: 0, y: 0, w: 780, h: 110 },
        'When was this taken?',
        type({ ...display, weight: 500 }, 60, INK),
      ),
      { x: 40, y: 690 },
    );
    const choices = inStage(
      words(
        k,
        'Guess choices',
        { x: 0, y: 0, w: 760, h: 520 },
        GUESS.options.map((o, i) => `${i + 1}   ${o}`).join('\n'),
        {
          ...type({ ...display, weight: 600, lineHeight: 1.45 }, 88, GOLD),
          align: 'left',
        },
      ),
      1060,
      170,
    );
    const hint = inStage(
      words(
        k,
        'Guess hint',
        { x: 0, y: 0, w: 760, h: 60 },
        'Guess on your phone',
        type({ ...body, weight: 500 }, 44, CORAL),
      ),
      1060,
      720,
    );
    const verdict = inStage(
      words(k, 'Verdict', { x: 0, y: 0, w: 760, h: 300 }, '', {
        ...type({ ...display, weight: 700, lineHeight: 1.05 }, 96, GOLD),
        align: 'left',
      }),
      1060,
      560,
    );
    const right = GUESS.options[GUESS.right]!;
    const guessing = addScene(show, 'Guess the year');
    addCue(
      show,
      guessing.id,
      'Guess the year',
      [
        // Whichever photo is up, from a GO or a jump mid-way.
        ...frames.map((f) => fade(f.id, false, 1)),
        ...musicOut(story.id, 3),
        fade(guessFrame.id, true, 1.2),
        fade(choices.id, true, 1.2, 0.3),
        fade(hint.id, true, 1.2, 0.5),
        { type: 'openMoment', momentId: guess.id },
      ],
      { access: { caption: 'Guess the year: when was this photo taken?' } },
    );
    guess.options.forEach((o, i) =>
      rule(
        show,
        i === GUESS.right ? 'Guess: the room got it' : `Guess: not ${o.label}`,
        { type: 'momentClosed', momentId: guess.id },
        [{ varId: guess.resultVarId!, op: 'eq', value: o.id }],
        [say(verdict.id, i === GUESS.right ? 'You got it!' : `Most said ${o.label}…`)],
      ),
    );
    addCue(
      show,
      guessing.id,
      `It was the ${right}`,
      [
        { type: 'closeMoment', momentId: guess.id },
        fade(choices.id, false, 0.8),
        fade(hint.id, false, 0.8),
        fade(verdict.id, true, 0.8),
        say(verdict.id, `It was the ${right}!`, 2.5),
      ],
      { access: { caption: `It was the ${right}!` } },
    );

    // Blow out the candles: everyone taps at once.
    const candles = newMoment('tap', show);
    candles.name = 'Candles';
    candles.prompt = 'Tap to blow out the candles!';
    candles.durationSec = 15;
    createResultVars(show, candles);
    show.moments.push(candles);
    const cakeFrame = inStage(
      panel(k, 'Cake', { x: 0, y: 0, w: 900, h: 760 }, POLAROID, { radius: 6 }),
      120,
      170,
    );
    place(k, cakeFrame, picture(k, media.cake!, 'Cake photo', { x: 0, y: 0, w: 820, h: 680 }), {
      x: 40,
      y: 40,
    });
    const blowTitle = inStage(
      words(k, 'Blow', { x: 0, y: 0, w: 740, h: 340 }, 'Tap to blow\nout the\ncandles!', {
        ...type({ ...display, weight: 700, lineHeight: 1 }, 96, GOLD),
        align: 'left',
      }),
      1080,
      170,
    );
    const puffs = inStage(
      valueLayer(k, 'Puffs', { x: 0, y: 0, w: 740, h: 240 }, candles.resultVarId!, {
        ...type({ ...display, weight: 700 }, 200, CREAM),
        align: 'left',
      }),
      1080,
      540,
    );
    const wish = inStage(
      words(k, 'Wish', { x: 0, y: 0, w: 740, h: 200 }, '', {
        ...type({ ...display, weight: 700, lineHeight: 1 }, 88, CORAL),
        align: 'left',
      }),
      1080,
      780,
    );
    const cakeScene = addScene(show, 'The candles');
    addCue(
      show,
      cakeScene.id,
      'Blow out the candles',
      [
        fade(guessFrame.id, false, 1),
        fade(verdict.id, false, 1),
        fade(cakeFrame.id, true, 1.2),
        fade(blowTitle.id, true, 1.2, 0.3),
        fade(puffs.id, true, 1.2, 0.5),
        { type: 'openMoment', momentId: candles.id },
      ],
      { access: { caption: 'Tap your phone to blow out the candles!' } },
    );
    addCue(show, cakeScene.id, 'Candles out', [{ type: 'closeMoment', momentId: candles.id }]);
    rule(
      show,
      'Candles: all out',
      { type: 'momentClosed', momentId: candles.id },
      [{ varId: candles.resultVarId!, op: 'gte', value: CANDLES }],
      [say(wish.id, 'Make a wish!'), fade(wish.id, true, 0.6)],
    );
    rule(
      show,
      'Candles: one more puff',
      { type: 'momentClosed', momentId: candles.id },
      [{ varId: candles.resultVarId!, op: 'lt', value: CANDLES }],
      [say(wish.id, 'Nearly! Make\na wish anyway'), fade(wish.id, true, 0.6)],
    );

    // The finale: fireworks and the song.
    const fireworks = picture(k, media.fireworks!, 'Fireworks', FULL, {
      loop: true,
      intense: true,
    });
    place(k, stage, fireworks, { x: 0, y: 0 });
    fireworks.visible = false;
    const finalName = inStage(
      words(k, 'Finale', { x: 0, y: 0, w: 1728, h: 420 }, 'Happy birthday,\n{{name}}!', {
        ...type({ ...display, weight: 700, lineHeight: 1 }, 190, GOLD),
        shadow: 'strong',
      }),
      96,
      330,
    );
    const finale = addScene(show, 'Finale');
    addCue(
      show,
      finale.id,
      'Happy birthday',
      [
        fade(cakeFrame.id, false, 1),
        fade(blowTitle.id, false, 1),
        fade(puffs.id, false, 1),
        fade(wish.id, false, 1),
        fade(confetti.id, true, 1.5),
        fade(fireworks.id, true, 1.5),
        play(fireworks.id, { restart: true }),
        fade(finalName.id, true, 1.5, 0.5),
        ...sfx(song.id),
      ],
      { access: { caption: 'Happy birthday!', warning: 'Fireworks on screen next.' } },
    );
    addCue(show, finale.id, 'Lights down', [
      fade(finalName.id, false, 3),
      fade(confetti.id, false, 3),
      fade(fireworks.id, false, 3),
      ...musicOut(song.id, 4),
    ]);
    return show;
  },
};
