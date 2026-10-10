import { uid, type CounterLayer, type Layer, type StateLayer, type TextLayer } from '@scrim/format';
import { addCue, addScene, say } from '../lib/build/common.js';
import { buildQuiz, QUIZ_LEAD, QUIZMASTER_SCORE, ROOM_SCORE } from '../lib/build/quiz.js';
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
  place,
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

/** A TV game show: deep navy, light rails, condensed caps, a gold countdown dial. */
const NAVY = '#0a0e2e';
const PANEL = '#141a52';
const ANSWERS = '#10154a';
const INK = '#ffffff';
const SOFT = '#c9cdf5';
const MAGENTA = '#ff62b8';
const CYAN = '#35e0ff';
const GOLD = '#ffd23e';
const STAGE = 'linear-gradient(160deg, #1d2366, #070a24)';
const RAIL = `linear-gradient(90deg, ${MAGENTA}, ${CYAN})`;

const QUESTIONS = [
  {
    q: 'Which planet is known as the Red Planet?',
    a: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    right: 1,
  },
  { q: 'How many legs does a spider have?', a: ['Six', 'Eight', 'Ten', 'Twelve'], right: 1 },
  {
    q: 'What is the largest ocean on Earth?',
    a: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
    right: 3,
  },
  { q: 'Which instrument has 88 keys?', a: ['Piano', 'Guitar', 'Violin', 'Trumpet'], right: 0 },
  {
    q: 'What is the tallest animal on land?',
    a: ['Elephant', 'Giraffe', 'Horse', 'Camel'],
    right: 1,
  },
];
const TAP_TARGET = 100;

export const QUIZ: TemplateSeed = {
  id: 'quiz',
  title: 'The Big Quiz',
  group: 'family',
  forWho: 'A quiz host with a TV and a room full of phones',
  blurb:
    'Five questions with a countdown and a big reveal, a tap race, and the whole room playing against you for the final score.',
  needs: [
    'A TV or projector, and speakers',
    'The internet, so phones can join (buttons and raised hands work without it)',
    'Optional: four big buttons for people without a phone',
  ],
  replace: ['The questions and their answers', 'The quiz’s name', 'How many points each is worth'],
  limits: [
    'The score is for the whole room, not for each phone or team.',
    'Questions you add with the quiz wizard go at the end: drag their scene before the bonus round.',
  ],
  assets: [
    { key: 'display', path: 'fonts/Anton.woff2' },
    { key: 'body', path: 'fonts/AtkinsonHyperlegibleNext.woff2' },
    { key: 'walkin', path: 'quiz/music-walkin.m4a' },
    { key: 'tick', path: 'quiz/sfx-tick.m4a' },
    { key: 'correct', path: 'quiz/sfx-correct.m4a' },
    { key: 'buzz', path: 'quiz/sfx-wrong.m4a' },
    { key: 'fanfare', path: 'quiz/sfx-fanfare.m4a' },
  ],
  learn: [
    {
      id: 'question',
      title: 'Change the first question',
      hint: 'Interaction tab: open “Question 1” and type your own question and answers.',
      done: did.moments,
    },
    {
      id: 'wizard',
      title: 'Add a question with the quiz wizard',
      hint: 'Interaction tab › Add › Quiz question. Then drag its scene before the bonus round.',
      done: did.scenes,
    },
    {
      id: 'phone',
      title: 'Answer from your own phone',
      hint: 'Run the show, open the audience room and scan the code on the screen.',
      done: did.decided,
    },
    {
      id: 'final',
      title: 'Play through to the final scores',
      hint: 'Press GO all the way: the rules name the winner for you.',
      done: did.cue('Final scores'),
    },
    {
      id: 'show',
      title: 'Run it in Show mode',
      hint: 'The lock in the operator header: nothing can be changed by accident.',
      done: did.showMode,
    },
  ],
  heroes: [
    'Doors',
    'Round one',
    'Question 1',
    'Reveal',
    'Tap race',
    'Final scores',
    'The room wins!',
  ],
  visual: {
    minText: 56,
    minContrast: 4.5,
    labels: ['Kicker', 'Quiz round', 'Quiz score', 'Play along', 'Tap rule'],
  },
  make(media) {
    const show = startShow('The Big Quiz');
    addMedia(show, media);
    show.safety = { noFreeText: true };
    show.editor = { mode: 'simple' };
    show.defaultFade = { duration: 0.6, easing: 'easeOut' };
    // Four arcade buttons (or 1–4 on a keyboard) count a vote for people without a phone.
    for (let n = 1; n <= 4; n++) {
      show.inputs.keys.push({ key: `Digit${n}`, command: { type: 'countVote', option: n } });
      show.inputs.gamepad.push({ button: n - 1, command: { type: 'countVote', option: n } });
    }
    const k = kit(show);
    const display: Face = {
      font: media.display!,
      weight: 400,
      uppercase: true,
      letterSpacing: 0.02,
    };
    const body: Face = { font: media.body!, weight: 600 };

    // The whole stage, with everything that isn't a quiz layer inside it.
    const stage = panel(k, 'Quiz stage', FULL, STAGE);
    stage.visible = true;
    const put = <L extends Layer>(layer: L, x: number, y: number): L => {
      place(k, stage, layer, { x, y });
      layer.visible = false;
      return layer;
    };
    for (const y of [0, 1072])
      place(
        k,
        stage,
        panel(k, y ? 'Rail · bottom' : 'Rail · top', { x: 0, y: 0, w: 1920, h: 8 }, RAIL),
        {
          x: 0,
          y,
        },
      ).visible = true;

    // Walk-in: the title, how to join, and music.
    const kicker = put(
      words(k, 'Kicker', { x: 0, y: 0, w: 1000, h: 60 }, 'Tonight · play on your phone', {
        ...type({ ...display, letterSpacing: 0.12 }, 44, MAGENTA),
        align: 'left',
      }),
      100,
      214,
    );
    const title = put(
      words(k, 'Title', { x: 0, y: 0, w: 1120, h: 400 }, 'The Big\nQuiz', {
        ...type({ ...display, lineHeight: 0.92 }, 210, INK),
        align: 'left',
      }),
      96,
      290,
    );
    const welcome = put(
      words(
        k,
        'Walk-in line',
        { x: 0, y: 0, w: 1100, h: 140 },
        'Scan the code to play along.\nNo app, no sign-up.',
        {
          ...type({ ...body, weight: 500 }, 56, SOFT),
          align: 'left',
        },
      ),
      96,
      712,
    );
    const join = put(
      joinCard(
        k,
        'Join card',
        { x: 0, y: 0, w: 480, h: 600 },
        {
          ink: NAVY,
          paper: '#ffffff',
          codeFace: { ...display, letterSpacing: 0.12 },
          codeSize: 72,
        },
      ),
      1344,
      232,
    );
    const walkin = sound(k, media.walkin!, 'Walk-in music', { loop: true, volume: 0.7 });

    // Round one's title card.
    const round = put(
      words(
        k,
        'Round title',
        { x: 0, y: 0, w: 1728, h: 340 },
        'Round one',
        type(display, 280, MAGENTA),
      ),
      96,
      330,
    );
    const roundLine = put(
      words(
        k,
        'Round line',
        { x: 0, y: 0, w: 1728, h: 90 },
        'General knowledge · five questions',
        type(body, 60, INK),
      ),
      96,
      650,
    );

    // The question set: panels in the stage; the quiz's own layers sit over them.
    const top = put(
      words(k, 'Quiz round', { x: 0, y: 0, w: 440, h: 60 }, 'Round one', {
        ...type({ ...display, letterSpacing: 0.12 }, 44, MAGENTA),
        align: 'left',
      }),
      96,
      64,
    );
    const playAlong = put(
      words(k, 'Play along', { x: 0, y: 0, w: 520, h: 60 }, 'Play along · {{join_code}}', {
        ...type({ ...display, letterSpacing: 0.1 }, 44, CYAN),
        align: 'right',
      }),
      1304,
      64,
    );
    const qPanel = put(
      panel(k, 'Question panel', { x: 0, y: 0, w: 1288, h: 300 }, PANEL, { radius: 28 }),
      96,
      148,
    );
    const dial = put(
      panel(k, 'Countdown dial', { x: 0, y: 0, w: 300, h: 300 }, GOLD, { radius: 150 }),
      1484,
      148,
    );
    const aPanel = put(
      panel(k, 'Answers panel', { x: 0, y: 0, w: 1728, h: 420 }, ANSWERS, { radius: 28 }),
      96,
      480,
    );
    place(
      k,
      aPanel,
      panel(
        k,
        'Answers stripe',
        { x: 0, y: 0, w: 14, h: 420 },
        `linear-gradient(180deg, ${MAGENTA}, ${CYAN})`,
      ),
      { x: 0, y: 0 },
    );
    const panels = [qPanel, dial, aPanel, top, playAlong];

    // Kept by every question, so the rules can name the winner.
    show.vars.push({ id: uid('var'), name: QUIZ_LEAD, type: 'number', initial: 0 });
    const tick = sound(k, media.tick!, 'Countdown tick', { loop: true, volume: 0.5 });
    const correct = sound(k, media.correct!, 'Right answer', { volume: 0.9 });
    const buzz = sound(k, media.buzz!, 'Time’s up', { volume: 0.8 });
    const fanfare = sound(k, media.fanfare!, 'Fanfare', { volume: 0.9 });

    const walkScene = addScene(show, 'Walk-in');
    addCue(
      show,
      walkScene.id,
      'Doors',
      [
        fade(kicker.id, true, 1.2),
        fade(title.id, true, 1.2, 0.2),
        fade(welcome.id, true, 1.2, 0.5),
        fade(join.id, true, 1.2, 0.8),
        ...musicIn(walkin.id, 3),
      ],
      { notes: 'Open the audience room before this, so the code on screen works.' },
    );

    const roundScene = addScene(show, 'Round one');
    addCue(show, roundScene.id, 'Round one', [
      fade(kicker.id, false, 0.6),
      fade(title.id, false, 0.6),
      fade(welcome.id, false, 0.6),
      fade(join.id, false, 0.6),
      ...musicOut(walkin.id, 2),
      fade(round.id, true, 0.8, 0.4),
      fade(roundLine.id, true, 0.8, 0.7),
      ...sfx(fanfare.id),
    ]);

    QUESTIONS.forEach((item, i) => {
      const { cueIds, momentId } = buildQuiz(show, {
        question: item.q,
        options: item.a,
        correct: item.right,
        seconds: 20,
        points: 1,
      });
      const [asked, reveal] = cueIds.map((id) => show.cues.find((c) => c.id === id)!);
      asked!.actions.push(
        say(top.id, `Question ${i + 1} of ${QUESTIONS.length}`),
        ...musicIn(tick.id, 0.3),
      );
      if (i === 0)
        asked!.actions.unshift(
          fade(round.id, false, 0.5),
          fade(roundLine.id, false, 0.5),
          ...panels.map((p) => fade(p.id, true, 0.6)),
        );
      asked!.actions.push(fade(dial.id, true, 0.4));
      reveal!.actions.push(...sfx(correct.id), fade(dial.id, false, 0.4));
      rule(
        show,
        `Question ${i + 1}: time’s up`,
        { type: 'momentClosed', momentId },
        [],
        [...musicOut(tick.id, 0.3), ...sfx(buzz.id)],
      );
    });
    styleQuizLayers(show, display, body);

    // Bonus: a tap race against the clock.
    const bonusScene = addScene(show, 'Bonus round');
    const race = newMoment('tap', show);
    race.name = 'Tap race';
    race.prompt = 'Tap as fast as you can!';
    race.durationSec = 10;
    createResultVars(show, race);
    show.moments.push(race);
    const bonusTitle = put(
      words(
        k,
        'Bonus title',
        { x: 0, y: 0, w: 1728, h: 220 },
        'Bonus: tap race',
        type(display, 180, MAGENTA),
      ),
      96,
      150,
    );
    const tapRule = put(
      words(
        k,
        'Tap rule',
        { x: 0, y: 0, w: 1728, h: 60 },
        `Tap your screen as fast as you can · ${TAP_TARGET} taps beats the quizmaster`,
        {
          ...type({ ...display, letterSpacing: 0.08 }, 44, CYAN),
        },
      ),
      96,
      370,
    );
    const taps = put(
      valueLayer(
        k,
        'Taps',
        { x: 0, y: 0, w: 1728, h: 370 },
        race.resultVarId!,
        type(display, 300, GOLD),
      ),
      96,
      460,
    );
    const tapResult = put(
      words(k, 'Tap result', { x: 0, y: 0, w: 1728, h: 110 }, '', type(display, 96, INK)),
      96,
      860,
    );
    const quizLayers = show.layers.filter((l) =>
      /^Quiz (question|answers|answer|countdown)$|^Question \d votes$/.test(l.name),
    );
    addCue(
      show,
      bonusScene.id,
      'Tap race',
      [
        ...[...panels, ...quizLayers].map((l) => fade(l.id, false, 0.5)),
        fade(bonusTitle.id, true, 0.6),
        fade(tapRule.id, true, 0.6, 0.2),
        fade(taps.id, true, 0.6, 0.3),
        ...sfx(fanfare.id),
        ...musicIn(tick.id, 0.3),
        { type: 'openMoment', momentId: race.id },
      ],
      { access: { caption: 'Bonus round: tap your screen as fast as you can.' } },
    );
    // GO before the ten seconds are up ends the race there.
    addCue(show, bonusScene.id, 'Tap race ends', [{ type: 'closeMoment', momentId: race.id }]);
    const lead = show.vars.find((v) => v.name === QUIZ_LEAD)!;
    const roomVar = show.vars.find((v) => v.name === ROOM_SCORE)!;
    const masterVar = show.vars.find((v) => v.name === QUIZMASTER_SCORE)!;
    rule(
      show,
      'Tap race: the room did it',
      { type: 'momentClosed', momentId: race.id },
      [{ varId: race.resultVarId!, op: 'gte', value: TAP_TARGET }],
      [
        { type: 'addVar', varId: roomVar.id, amount: 2 },
        { type: 'addVar', varId: lead.id, amount: 2 },
        say(tapResult.id, 'The room did it! Two points'),
        fade(tapResult.id, true, 0.4),
        ...musicOut(tick.id, 0.3),
        ...sfx(correct.id),
      ],
    );
    rule(
      show,
      'Tap race: the quizmaster wins it',
      { type: 'momentClosed', momentId: race.id },
      [{ varId: race.resultVarId!, op: 'lt', value: TAP_TARGET }],
      [
        { type: 'addVar', varId: masterVar.id, amount: 2 },
        { type: 'addVar', varId: lead.id, amount: -2 },
        say(tapResult.id, 'So close! Two to the quizmaster'),
        fade(tapResult.id, true, 0.4),
        ...musicOut(tick.id, 0.3),
        ...sfx(buzz.id),
      ],
    );

    // The final scores, then the rules name the winner.
    const finalScene = addScene(show, 'Final scores');
    const finalTitle = put(
      words(
        k,
        'Final title',
        { x: 0, y: 0, w: 1728, h: 200 },
        'Final scores',
        type(display, 170, INK),
      ),
      96,
      110,
    );
    const roomCard = put(
      panel(k, 'Room card', { x: 0, y: 0, w: 780, h: 560 }, CYAN, { radius: 32 }),
      150,
      370,
    );
    place(
      k,
      roomCard,
      words(k, 'Room name', { x: 0, y: 0, w: 780, h: 110 }, 'The room', type(display, 96, NAVY)),
      { x: 0, y: 50 },
    );
    place(
      k,
      roomCard,
      words(
        k,
        'Room points',
        { x: 0, y: 0, w: 780, h: 360 },
        `{{${ROOM_SCORE}}}`,
        type(display, 290, NAVY),
      ),
      { x: 0, y: 160 },
    );
    const masterCard = put(
      panel(k, 'Quizmaster card', { x: 0, y: 0, w: 780, h: 560 }, MAGENTA, { radius: 32 }),
      990,
      370,
    );
    place(
      k,
      masterCard,
      words(
        k,
        'Quizmaster name',
        { x: 0, y: 0, w: 780, h: 110 },
        'Quizmaster',
        type(display, 96, NAVY),
      ),
      { x: 0, y: 50 },
    );
    place(
      k,
      masterCard,
      words(
        k,
        'Quizmaster points',
        { x: 0, y: 0, w: 780, h: 360 },
        `{{${QUIZMASTER_SCORE}}}`,
        type(display, 290, NAVY),
      ),
      { x: 0, y: 160 },
    );
    const score = show.layers.find((l) => l.name === 'Quiz score')!;
    addCue(show, finalScene.id, 'Final scores', [
      fade(bonusTitle.id, false, 0.5),
      fade(tapRule.id, false, 0.5),
      fade(taps.id, false, 0.5),
      fade(tapResult.id, false, 0.5),
      fade(score.id, false, 0.5),
      fade(finalTitle.id, true, 0.8),
      fade(roomCard.id, true, 0.8, 0.3),
      fade(masterCard.id, true, 0.8, 0.6),
    ]);
    const decide = addCue(show, finalScene.id, 'And the winner is…', [
      fade(finalTitle.id, false, 0.5),
      fade(roomCard.id, false, 0.5),
      fade(masterCard.id, false, 0.5),
    ]);

    const goodnight = addScene(show, 'Goodnight');
    const endings = [
      { line: 'The room wins!', op: 'gt' as const, colour: GOLD },
      { line: 'The quizmaster wins!', op: 'lt' as const, colour: MAGENTA },
      { line: 'It’s a draw!', op: 'eq' as const, colour: CYAN },
    ];
    // The ending scenes go before Goodnight in the running order.
    show.scenes.pop();
    const bigs: string[] = [];
    for (const e of endings) {
      const scene = addScene(show, e.line);
      const big = put(
        words(k, e.line, { x: 0, y: 0, w: 1728, h: 520 }, e.line.replace(' wins', '\nwins'), {
          ...type({ ...display, lineHeight: 0.95 }, 230, e.colour),
        }),
        96,
        270,
      );
      addCue(
        show,
        scene.id,
        e.line,
        [
          fade(big.id, true, 0.8),
          ...sfx(fanfare.id),
          { type: 'jumpScene', sceneId: goodnight.id, fire: false },
        ],
        { access: { caption: e.line } },
      );
      rule(
        show,
        `Name the winner: ${e.line}`,
        { type: 'cueFired', cueId: decide.id },
        [{ varId: lead.id, op: e.op, value: 0 }],
        [{ type: 'jumpScene', sceneId: scene.id, fire: true }],
      );
      bigs.push(big.id);
    }
    // Each ending clears the others, however the stage got there.
    endings.forEach((e, i) =>
      show.cues
        .find((c) => c.name === e.line)!
        .actions.unshift(...bigs.filter((_, j) => j !== i).map((id) => fade(id, false, 0.3))),
    );
    show.scenes.push(goodnight);
    const thanks = put(
      words(
        k,
        'Thanks',
        { x: 0, y: 0, w: 1728, h: 240 },
        'Thanks for playing!',
        type(display, 170, INK),
      ),
      96,
      420,
    );
    addCue(show, goodnight.id, 'Goodnight', [
      ...bigs.map((id) => fade(id, false, 0.8)),
      fade(thanks.id, true, 1),
      ...musicIn(walkin.id, 3),
    ]);
    return show;
  },
};

/** The quiz wizard's layers, made by the first question, in the game-show look. */
function styleQuizLayers(show: ReturnType<typeof startShow>, display: Face, body: Face): void {
  const find = <L extends Layer>(name: string) => show.layers.find((l) => l.name === name) as L;
  const textStyle = (face: Face, size: number, color: string) => ({
    ...type(face, size, color),
    shadow: 'soft' as const,
  });
  Object.assign(find<TextLayer>('Quiz question'), {
    x: 144,
    y: 172,
    w: 1192,
    h: 252,
    align: 'left',
    ...textStyle({ ...body, weight: 700, lineHeight: 1.12 }, 68, '#ffffff'),
  });
  Object.assign(find<TextLayer>('Quiz answers'), {
    x: 160,
    y: 510,
    w: 1600,
    h: 360,
    align: 'left',
    ...textStyle({ ...body, lineHeight: 1.5 }, 60, '#ffffff'),
  });
  Object.assign(find<TextLayer>('Quiz answer'), {
    x: 96,
    y: 924,
    w: 1728,
    h: 96,
    ...textStyle({ ...display, letterSpacing: 0.04 }, 80, GOLD),
  });
  Object.assign(find<TextLayer>('Quiz score'), {
    x: 540,
    y: 64,
    w: 740,
    h: 60,
    ...textStyle({ ...display, letterSpacing: 0.1 }, 44, '#ffffff'),
  });
  // The countdown goes in the gold dial, navy on gold.
  const dial = find<Layer>('Countdown dial');
  const clock = find<CounterLayer>('Quiz countdown');
  Object.assign(clock, {
    parentId: dial.id,
    x: 0,
    y: 0,
    w: 300,
    h: 300,
    format: 'number',
    ...type({ ...display, letterSpacing: 0 }, 150, NAVY),
  });
  for (const bars of show.layers.filter(
    (l): l is StateLayer => l.kind === 'state' && / votes$/.test(l.name),
  ))
    Object.assign(bars, {
      x: 160,
      y: 510,
      w: 1600,
      h: 360,
      shadow: 'soft',
      ...type({ ...body, weight: 700 }, 100, CYAN),
    });
}
