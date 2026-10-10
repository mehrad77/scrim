import type { Action, ImageLayer, VideoLayer } from '@scrim/format';
import { addCue, addScene, say } from '../lib/build/common.js';
import { buildSong } from '../lib/build/song.js';
import { did } from '../lib/learn.js';
import { createResultVars, newMoment } from '../lib/moments.js';
import { newSong } from '../lib/songs.js';
import {
  across,
  addMedia,
  fade,
  FULL,
  kit,
  musicIn,
  musicOut,
  panel,
  picture,
  place,
  rule,
  scrim,
  sound,
  startShow,
  type,
  words,
  type Face,
} from './layout.js';
import type { TemplateSeed } from './types.js';

/** Warm and unhurried: cream postcards over big photographs, sepia ink, nothing sudden. */
const CREAM = '#f7efe0';
const INK = '#2b1d12';
const SEPIA = '#4a3524';
const TERRACOTTA = '#74300f';
const DUSK = '#1f1610';
/** Every fade at least this long: no snaps, ever. */
const SOFT = 2.5;

/**
 * The photographs, each with the question that starts the conversation. `whole`: shown
 * complete on a warm mat rather than filling the screen.
 */
interface Photo {
  key: string;
  ask: string;
  whole?: boolean;
}

const SEASIDE: Photo[] = [
  { key: 'seaside-1', ask: 'Who went to the seaside\nwhen they were young?' },
  { key: 'seaside-2', ask: 'Which beach did your\nfamily go to?' },
  { key: 'seaside-3', ask: 'What did you pack\nfor a day out?' },
  { key: 'seaside-4', ask: 'Did you ever swim\nin the sea?' },
  { key: 'seaside-5', ask: 'What did you buy\non the pier?' },
  { key: 'seaside-6', ask: 'What is the best thing\nabout a day by the sea?' },
];
const DANCE: Photo[] = [
  { key: 'dance-1', ask: 'Where did you\ngo dancing?' },
  { key: 'dance-2', ask: 'What was your\nfavourite dance?' },
  { key: 'dance-3', ask: 'What did you wear\non a Saturday night?' },
];
const PICNIC: Photo[] = [
  { key: 'picnic-1', ask: 'Where did your family\ngo for a picnic?' },
  { key: 'picnic-2', ask: 'What was in\nthe basket?' },
  { key: 'picnic-3', ask: 'Who made the\nbest sandwiches?' },
];

/** "I Do Like to Be Beside the Seaside", John A. Glover-Kind, 1907: public domain. */
export const SEASIDE_SONG = `Verse 1
Everyone delights to spend their summer’s holiday
Down beside the side of the silvery sea.
I’m no exception to the rule, in fact, if I’d my way,
I’d reside by the side of the silvery sea.
But when you’re just the common garden Smith or Jones or Brown,
At business up in town, you’ve got to settle down.
You save up all the money you can till summer comes around,
Then away you go to a spot you know where the cockleshells are found.

Chorus
Oh! I do like to be beside the seaside!
I do like to be beside the sea!
Oh I do like to stroll along the Prom, Prom, Prom!
Where the brass bands play, “Tiddely-om-pom-pom!”
So just let me be beside the seaside!
I’ll be beside myself with glee,
And there’s lots of girls beside,
I should like to be beside, beside the seaside,
Beside the sea!

Verse 2
Timothy went to Blackpool for the day last Eastertide
To see what he could see by the side of the sea.
As soon as he reached the station there the first thing he espied
Was the wine lodge door stood open invitingly.
To quench his thirst, he toddled inside and called out for a wine,
Which grew to eight or nine, till his nose began to shine.
Said he, “What people see in the sea, I’m sure I fail to see,”
Then he caught the train back home again and to his wife said he:

Chorus

Verse 3
William Sykes the burglar, he’d been out to work one night,
Filled his bags with jewels, cash and plate.
Constable Brown felt quite surprised when William hove in sight.
Said he, “The hours you’re keeping are far too late.”
So he grabbed him by the collar and lodged him safe and sound in jail.
Next morning, looking pale, Bill told a tearful tale.
The judge said, “For a couple of months I’m sending you away!”
Said Bill, “How kind! Well, if you don’t mind, where I spend my holiday!”

Last chorus
Oh! I do like to be beside the seaside!
I do like to be beside the sea!
For the sun’s always shining as I make my way,
And the brass bands play, “Ta-ra-ra-boom-de-ay!”
So just let me be beside the seaside!
I’ll be beside myself with glee,
And there’s lots of girls beside,
I should like to be beside, beside the seaside,
Beside the sea!`;

export const MEMORY_SESSION: TemplateSeed = {
  id: 'memory-session',
  title: 'A Day at the Seaside',
  group: 'care',
  forWho: 'An activity leader running a reminiscence group in a care home',
  blurb:
    'Big, warm photographs of the seaside, a question on each to start people talking, a choice the group makes together, and a sing-along. Calm from the first cue, and nothing is on a timer.',
  needs: [
    'A big TV',
    'A tablet to run it from, sitting with the group',
    'Optional: a second tablet passed round, or two big buttons, for the choice',
  ],
  replace: [
    'The photographs: your town’s own, with families’ permission',
    'The questions on each photo',
    'The choice and its two sets of photos',
    'The song and the music',
  ],
  limits: [
    'Licences for modern songs are yours to arrange; this template uses only public-domain music.',
    'Nothing is recorded about who said or chose what.',
  ],
  assets: [
    { key: 'display', path: 'fonts/Fraunces.woff2' },
    { key: 'body', path: 'fonts/AtkinsonHyperlegibleNext.woff2' },
    ...[...SEASIDE, ...DANCE, ...PICNIC].map((p) => ({
      key: p.key,
      path: `memory-session/${p.key}.webp`,
    })),
    { key: 'song', path: 'memory-session/song-seaside.m4a' },
    { key: 'closing', path: 'memory-session/music-closing.m4a' },
    { key: 'sea', path: 'memory-session/sfx-sea.m4a' },
  ],
  learn: [
    {
      id: 'photos',
      title: 'Put in photographs of your own town',
      hint: 'Stage tab: drop a photo onto one of the seaside pictures to swap it.',
      done: did.ownMedia,
    },
    {
      id: 'question',
      title: 'Change a question',
      hint: 'Stage tab: click the words on a photo and type your own.',
      done: (ctx) => ctx.show.cues.some((c) => c.updatedAt > ctx.show.createdAt + 1000),
    },
    {
      id: 'tablet',
      title: 'Pass a tablet round for the choice',
      hint: 'Run the show, open the audience room and scan the shared-tablet code.',
      done: did.decided,
    },
    {
      id: 'button',
      title: 'Plug in two big buttons',
      hint: 'Controls tab: map a button to “Count a vote: 1” and another to 2.',
      done: did.mapped,
    },
    {
      id: 'session',
      title: 'Run a session from the simple view',
      hint: 'Run the show on the tablet; it opens in the simple view, relaxed from the start.',
      done: did.go,
    },
  ],
  heroes: [
    'Good afternoon',
    'seaside-1',
    'seaside-4',
    'What next?',
    'dance-1',
    'picnic-1',
    'Chorus (1/3)',
    'Thank you',
  ],
  visual: { minText: 84, minContrast: 7, labels: ['Song credit', 'Choice hint'] },
  make(media) {
    const show = startShow('A Day at the Seaside');
    addMedia(show, media);
    show.editor = { mode: 'simple' };
    show.operator = { layout: 'simple', remoteGo: true };
    show.relaxed = { default: true, brightness: 0.85, volume: 0.6, minFade: 2 };
    show.safety = { noFreeText: true };
    show.defaultFade = { duration: SOFT, easing: 'easeInOut' };
    for (let n = 1; n <= 2; n++) {
      show.inputs.keys.push({ key: `Digit${n}`, command: { type: 'countVote', option: n } });
      show.inputs.gamepad.push({ button: n - 1, command: { type: 'countVote', option: n } });
    }
    const k = kit(show);
    const display: Face = { font: media.display!, weight: 500 };
    const body: Face = { font: media.body!, weight: 600 };

    // A warm mat under pictures shown whole, and a gentle vignette over every photograph.
    const mat = panel(k, 'Photo mat', FULL, 'linear-gradient(180deg, #3a2a1d, #1f1610)');
    const photos = new Map<string, ImageLayer | VideoLayer>();
    for (const p of [...SEASIDE, ...DANCE, ...PICNIC])
      photos.set(p.key, picture(k, media[p.key]!, p.key, FULL, p.whole ? { fit: 'contain' } : {}));
    const vignette = scrim(k, 'photos', 'bottom', DUSK, { reach: 0.55, strength: 0.7 });

    // The postcard: one question at a time, very large, cream on sepia ink.
    const card = panel(k, 'Question card', { x: 160, y: 700, w: 1600, h: 300 }, CREAM, {
      radius: 28,
    });
    const ask = place(
      k,
      card,
      words(k, 'Question', { x: 0, y: 0, w: 1504, h: 248 }, '', {
        ...type({ ...body, lineHeight: 1.2 }, 92, INK),
      }),
      { x: 48, y: 26 },
    );
    ask.visible = false;

    const sea = sound(k, media.sea!, 'Sea', { loop: true, volume: 0.35 });
    const closingMusic = sound(k, media.closing!, 'Closing music', { volume: 0.7 });

    // Welcome.
    const hello = panel(k, 'Welcome card', { x: 260, y: 250, w: 1400, h: 580 }, CREAM, {
      radius: 32,
    });
    place(
      k,
      hello,
      words(k, 'Welcome', { x: 0, y: 0, w: 1400, h: 300 }, 'Good afternoon,\neveryone', {
        ...type({ ...display, lineHeight: 1.05 }, 130, INK),
      }),
      { x: 0, y: 70 },
    );
    place(
      k,
      hello,
      words(k, 'Today', { x: 0, y: 0, w: 1400, h: 120 }, 'Today: a day at the seaside', {
        ...type(body, 84, TERRACOTTA),
      }),
      { x: 0, y: 390 },
    );
    const welcome = addScene(show, 'Welcome');
    addCue(
      show,
      welcome.id,
      'Good afternoon',
      [
        fade(mat.id, true, SOFT),
        fade(photos.get('seaside-1')!.id, true, 4),
        fade(hello.id, true, SOFT, 1),
        ...musicIn(sea.id, 4),
      ],
      {
        notes: 'Take your time. Nothing moves on until you press GO.',
        access: { caption: 'Good afternoon, everyone. Today: a day at the seaside.' },
      },
    );

    // A set of photographs, each on GO with its question.
    let showing: string | null = null;
    const set = (sceneName: string, list: Photo[], first: Action[] = []) => {
      const scene = addScene(show, sceneName);
      list.forEach((p, i) => {
        const photo = photos.get(p.key)!;
        const actions: Action[] = [
          ...(i === 0 ? first : []),
          fade(photo.id, true, SOFT),
          ...(showing && showing !== photo.id ? [fade(showing, false, SOFT, SOFT)] : []),
          fade(vignette.id, true, SOFT),
          fade(card.id, true, SOFT),
          fade(ask.id, false, 1),
          say(ask.id, p.ask, 1),
          fade(ask.id, true, SOFT, 1),
        ];
        showing = photo.id;
        addCue(show, scene.id, p.key, actions, {
          access: { caption: p.ask.replace(/\n/g, ' ') },
        });
      });
      return scene;
    };
    set('At the seaside', SEASIDE, [fade(hello.id, false, SOFT)]);

    // The group chooses together: no time limit, as long as it takes.
    const choice = newMoment('vote', show);
    choice.name = 'What next';
    choice.prompt = 'What shall we talk about next?';
    choice.durationSec = 0;
    choice.options = [
      { id: 'a', label: 'The dance hall' },
      { id: 'b', label: 'A picnic' },
    ];
    choice.defaultResult = 'a';
    createResultVars(show, choice);
    show.moments.push(choice);

    const pick = panel(k, 'Choice', FULL, 'linear-gradient(180deg, #f7efe0, #ead9bd)');
    place(
      k,
      pick,
      words(
        k,
        'Choice question',
        { x: 0, y: 0, w: 1728, h: 140 },
        'What shall we talk about next?',
        {
          ...type(display, 104, INK),
        },
      ),
      { x: 96, y: 70 },
    );
    const option = (key: string, n: number, label: string, x: number) => {
      const frame = place(
        k,
        pick,
        panel(k, `Choice ${n}`, { x: 0, y: 0, w: 780, h: 620 }, '#ffffff', {
          radius: 24,
          clip: true,
        }),
        { x, y: 250 },
      );
      const img = media[key]!;
      place(k, frame, picture(k, img, `Choice ${n} picture`, { x: 0, y: 0, w: 780, h: 460 }), {
        x: 0,
        y: 0,
      });
      place(
        k,
        frame,
        words(
          k,
          `Choice ${n} label`,
          { x: 0, y: 0, w: 780, h: 140 },
          `${n}  ${label}`,
          type(body, 84, INK),
        ),
        { x: 0, y: 470 },
      );
    };
    option('dance-1', 1, 'The dance hall', 150);
    option('picnic-1', 2, 'A picnic', 990);
    place(
      k,
      pick,
      words(
        k,
        'Choice hint',
        { x: 0, y: 0, w: 1728, h: 60 },
        'Pass the tablet round, press a button, or raise your hand',
        {
          ...type({ ...body, weight: 500 }, 44, SEPIA),
        },
      ),
      { x: 96, y: 920 },
    );

    const asking = addScene(show, 'Choose together');
    addCue(
      show,
      asking.id,
      'What next?',
      [
        fade(card.id, false, SOFT),
        fade(vignette.id, false, SOFT),
        ...(showing ? [fade(showing, false, SOFT, SOFT)] : []),
        fade(pick.id, true, SOFT),
        { type: 'openMoment', momentId: choice.id },
      ],
      {
        notes: 'Close the choice when everyone has had their say: “Close now” in the moment card.',
        access: { caption: 'What shall we talk about next: the dance hall, or a picnic?' },
      },
    );

    // GO when everyone has had their say: the choice closes and its rule picks the next set.
    addCue(show, asking.id, 'Choice made', [{ type: 'closeMoment', momentId: choice.id }], {
      notes: 'Press GO when everyone has chosen; then GO again for the photos.',
    });

    // The two ways the afternoon can go; both end at the sing-along.
    const afterChoice: Action[] = [fade(pick.id, false, SOFT)];
    showing = null;
    const dance = set('The dance hall', DANCE, afterChoice);
    showing = null;
    const picnic = set('A picnic', PICNIC, afterChoice);
    for (const [id, scene] of [
      ['a', dance],
      ['b', picnic],
    ] as const)
      rule(
        show,
        `Talk about ${scene.name.toLowerCase()}`,
        { type: 'momentClosed', momentId: choice.id },
        [{ varId: choice.resultVarId!, op: 'eq', value: id }],
        [{ type: 'jumpScene', sceneId: scene.id, fire: false }],
      );

    // The sing-along: big words, the 1907 song under them.
    const singShade = scrim(k, 'song', 'all', DUSK, { strength: 0.62 });
    // The song builder's own layers, in this look.
    words(k, 'Lyrics', across(100, 840), '', {
      ...type({ ...body, lineHeight: 1.2 }, 84, '#ffffff'),
      shadow: 'strong',
    });
    words(k, 'Song credit', across(966, 56), '', {
      ...type({ ...body, weight: 500 }, 36, CREAM),
      shadow: 'strong',
    });
    const songRecording = sound(k, media.song!, 'Song recording', { volume: 0.8 });
    const { sceneId: songScene, cueIds } = buildSong(
      show,
      newSong(
        'I Do Like to Be Beside the Seaside',
        SEASIDE_SONG,
        'John A. Glover-Kind (1907) · Public domain',
      ),
      { linesPerSlide: 3 },
    );
    const leaving = [...DANCE, ...PICNIC].map((p) => fade(photos.get(p.key)!.id, false, SOFT));
    show.cues
      .find((c) => c.id === cueIds[0])!
      .actions.unshift(
        ...leaving,
        fade(card.id, false, SOFT),
        fade(photos.get('seaside-5')!.id, true, SOFT),
        fade(singShade.id, true, SOFT),
        fade(sea.id, false, SOFT),
        ...musicIn(songRecording.id, 1),
      );
    // Both sets end by going to the song.
    for (const scene of [dance, picnic]) {
      const last = show.cues.filter((c) => c.sceneId === scene.id).at(-1)!;
      last.actions.push({ type: 'jumpScene', sceneId: songScene, fire: false });
    }

    // Thank you.
    const bye = panel(k, 'Thank-you card', { x: 260, y: 300, w: 1400, h: 480 }, CREAM, {
      radius: 32,
    });
    place(
      k,
      bye,
      words(
        k,
        'Thank you',
        { x: 0, y: 0, w: 1400, h: 200 },
        'Thank you for today',
        type(display, 120, INK),
      ),
      { x: 0, y: 90 },
    );
    place(
      k,
      bye,
      words(
        k,
        'Until next time',
        { x: 0, y: 0, w: 1400, h: 120 },
        'Same time next week',
        type(body, 84, TERRACOTTA),
      ),
      { x: 0, y: 300 },
    );
    const end = addScene(show, 'Thank you');
    addCue(
      show,
      end.id,
      'Thank you',
      [
        ...musicOut(songRecording.id, 4),
        fade(singShade.id, false, SOFT),
        fade(bye.id, true, SOFT, 1),
        ...musicIn(closingMusic.id, 4),
      ],
      { access: { caption: 'Thank you for today. Same time next week.' } },
    );
    addCue(show, end.id, 'Rest', [
      fade(bye.id, false, 4),
      ...[...photos.values()].map((p) => fade(p.id, false, 4)),
      fade(mat.id, false, 4),
      ...musicOut(closingMusic.id, 8),
    ]);
    return show;
  },
};
