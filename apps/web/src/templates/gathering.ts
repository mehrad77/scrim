import { uid, type Action, type Layer } from '@scrim/format';
import { addCue, addScene, say } from '../lib/build/common.js';
import { buildNotices } from '../lib/build/notices.js';
import { buildSong } from '../lib/build/song.js';
import { did } from '../lib/learn.js';
import { newSong } from '../lib/songs.js';
import {
  across,
  addMedia,
  cols,
  fade,
  joinCard,
  kit,
  musicOut,
  picture,
  play,
  scrim,
  sound,
  startShow,
  type,
  words,
  type Face,
} from './layout.js';
import type { TemplateSeed } from './types.js';

/** Warm and calm: soft skies under a deep scrim, big readable words, slow dissolves. */
const INK = '#fffaf0';
const WARM = '#f3e7d3';
const GOLD = '#f2c66d';
const NIGHT = '#0f0b10';
const SLOW = 1.5;

const AMAZING_GRACE = `Verse 1
Amazing grace! How sweet the sound
That saved a wretch like me!
I once was lost, but now am found;
Was blind, but now I see.

Verse 2
’Twas grace that taught my heart to fear,
And grace my fears relieved;
How precious did that grace appear
The hour I first believed.

Verse 3
Through many dangers, toils and snares,
I have already come;
’Tis grace hath brought me safe thus far,
And grace will lead me home.

Verse 4
The Lord has promised good to me,
His word my hope secures;
He will my shield and portion be,
As long as life endures.

Verse 5
When we’ve been there ten thousand years,
Bright shining as the sun,
We’ve no less days to sing God’s praise
Than when we’d first begun.`;

const AULD_LANG_SYNE = `Verse 1
Should auld acquaintance be forgot,
And never brought to mind?
Should auld acquaintance be forgot,
And auld lang syne?

Chorus
For auld lang syne, my dear,
For auld lang syne,
We’ll take a cup o’ kindness yet,
For auld lang syne.

Verse 2
We twa hae run about the braes,
And pou’d the gowans fine;
But we’ve wander’d mony a weary fit,
Sin’ auld lang syne.

Chorus

Verse 3
And there’s a hand, my trusty fiere!
And gie’s a hand o’ thine!
And we’ll tak a right gude-willie waught,
For auld lang syne.

Chorus`;

/** Psalm 23, World English Bible (British Edition): public domain. */
const PSALM = [
  'The Lord is my shepherd: I shall lack nothing.\nHe makes me lie down in green pastures.\nHe leads me beside still waters.\nHe restores my soul.',
  'He guides me in the paths of righteousness for his name’s sake.\nEven though I walk through the valley of the shadow of death, I will fear no evil, for you are with me.\nYour rod and your staff, they comfort me.',
  'You prepare a table before me in the presence of my enemies.\nYou anoint my head with oil. My cup runs over.\nSurely goodness and loving kindness shall follow me all the days of my life,\nand I will dwell in the Lord’s house for ever.',
];

export const GATHERING: TemplateSeed = {
  id: 'gathering',
  title: 'Sunday Gathering',
  group: 'gatherings',
  forWho: 'This week’s volunteer at a church or community hall',
  blurb:
    'Notices that go round as people arrive, then songs the back row can read, a verse at a time, with one key to the chorus and the words on everyone’s phone.',
  needs: [
    'A projector or TV',
    'Optional: the internet, so people can read the words on their own phones',
    'Optional: a pedal or a MIDI keyboard to change slides',
  ],
  replace: [
    'This week’s notices',
    'The songs, from your song library',
    'The pictures behind the words',
    'Your licence number (Preferences, once per machine)',
  ],
  limits: [
    'The song library stays on this machine; move it as a file.',
    'There’s no output for a live stream yet.',
  ],
  assets: [
    { key: 'display', path: 'fonts/Fraunces.woff2' },
    { key: 'body', path: 'fonts/AtkinsonHyperlegibleNext.woff2' },
    { key: 'dawn', path: 'gathering/bg-dawn.webp' },
    { key: 'hills', path: 'gathering/bg-hills.webp' },
    { key: 'water', path: 'gathering/bg-water.webp' },
    { key: 'notices', path: 'gathering/bg-notices.webp' },
    { key: 'music', path: 'gathering/music-gathering.m4a' },
  ],
  learn: [
    {
      id: 'notices',
      title: 'Write this week’s notices',
      hint: 'Cues tab: open each notice and change its words.',
      done: did.cueEdited,
    },
    {
      id: 'song',
      title: 'Add a song from your library',
      hint: 'Cues tab › Build › A song: paste the words, or pick one you’ve used before.',
      done: did.scenes,
    },
    {
      id: 'setlist',
      title: 'Make tonight’s order',
      hint: 'Run the show, then use Order: drag songs, skip one, and keep it as a setlist.',
      done: did.setlist,
    },
    {
      id: 'chorus',
      title: 'Jump to the chorus',
      hint: 'In “Auld Lang Syne”, press C: it goes to the next chorus, wherever you are.',
      done: did.cue('Chorus'),
    },
    {
      id: 'phones',
      title: 'Put the words on people’s phones',
      hint: 'Open the audience room; the code is on the last notice.',
      done: did.room,
    },
  ],
  heroes: ['Verse 1', 'Welcome', 'Psalm 23', 'Chorus', 'Go in peace'],
  visual: {
    minText: 56,
    minContrast: 7,
    labels: ['Song credit', 'Reading credit', 'Notices kicker'],
  },
  make(media) {
    const show = startShow('Sunday Gathering');
    addMedia(show, media);
    show.editor = { mode: 'simple' };
    show.operator = { layout: 'simple', goHoldMs: 300 };
    show.defaultFade = { duration: SLOW, easing: 'easeInOut' };
    const k = kit(show);
    const display: Face = { font: media.display!, weight: 600 };
    const body: Face = { font: media.body!, weight: 600 };

    // The pictures, each under the same deep scrim; one is on at a time.
    const bgs = {
      notices: picture(k, media.notices!, 'Picture · notices'),
      dawn: picture(k, media.dawn!, 'Picture · dawn'),
      hills: picture(k, media.hills!, 'Picture · hills'),
      water: picture(k, media.water!, 'Picture · water'),
    };
    const shade = scrim(k, 'words', 'all', NIGHT, { strength: 0.46 });
    const glow = scrim(k, 'credit', 'bottom', NIGHT, { reach: 0.3, strength: 0.75 });
    const only = (on: Layer): Action[] => [
      fade(on.id, true, SLOW),
      fade(shade.id, true, SLOW),
      fade(glow.id, true, SLOW),
      ...Object.values(bgs)
        .filter((b) => b !== on)
        .map((b) => fade(b.id, false, SLOW)),
    ];
    const music = sound(k, media.music!, 'Gathering music', { loop: true, volume: 0.55 });

    // The builders' own layers, made first in this look, so later songs and notices match.
    const left = cols(1, 8, 0, 0);
    words(k, 'Notice title', { ...left, y: 300, h: 150 }, '', {
      ...type(display, 112, INK),
      align: 'left',
      shadow: 'soft',
    });
    words(k, 'Notice text', { ...left, y: 470, h: 300 }, '', {
      ...type({ ...body, weight: 500, lineHeight: 1.35 }, 60, WARM),
      align: 'left',
      shadow: 'soft',
    });
    words(k, 'Notice title 2', { ...left, y: 300, h: 150 }, '', {
      ...type(display, 112, INK),
      align: 'left',
      shadow: 'soft',
    });
    words(k, 'Notice text 2', { ...left, y: 470, h: 300 }, '', {
      ...type({ ...body, weight: 500, lineHeight: 1.35 }, 60, WARM),
      align: 'left',
      shadow: 'soft',
    });
    const kicker = words(k, 'Notices kicker', { ...left, y: 232, h: 52 }, 'This week at the hall', {
      ...type({ ...body, weight: 700, uppercase: true, letterSpacing: 0.16 }, 36, GOLD),
      align: 'left',
      shadow: 'soft',
    });
    const join = joinCard(
      k,
      'Words on your phone',
      { x: 1424, y: 300, w: 400, h: 500 },
      {
        ink: NIGHT,
        paper: '#fffaf0',
        codeFace: { ...body, weight: 700 },
        codeSize: 60,
        radius: 20,
      },
    );
    words(k, 'Lyrics', across(170, 700), '', {
      ...type({ ...body, lineHeight: 1.3 }, 84, INK),
      shadow: 'soft',
    });
    words(k, 'Song credit', across(968, 52), '', {
      ...type({ ...body, weight: 500 }, 34, WARM),
      shadow: 'soft',
    });

    // Before: the notices go round over soft music.
    buildNotices(show, {
      notices: [
        { title: 'Welcome', body: 'Find a seat and make yourself at home.\nWe begin at ten.' },
        { title: 'Tea and coffee', body: 'Join us in the hall afterwards.\nEveryone is welcome.' },
        {
          title: 'This week',
          body: 'Choir practice: Thursday at seven.\nLunch club: Friday at noon.',
        },
        { title: 'On your phone', body: 'Scan the code to read every song\nin large print.' },
      ],
      seconds: 9,
      loop: true,
    });
    const cue = (name: string) => show.cues.find((c) => c.name === name)!;
    cue('Welcome').actions.push(
      ...only(bgs.notices),
      fade(kicker.id, true, SLOW),
      fade(join.id, true, SLOW),
      play(music.id),
      fade(music.id, true, 3),
    );
    cue('Notices off').actions.push(
      fade(kicker.id, false, SLOW),
      fade(join.id, false, SLOW),
      ...musicOut(music.id, 4),
    );

    // The songs: a cue for each verse and chorus, in the order sung.
    const songs = [
      {
        song: newSong('Amazing Grace', AMAZING_GRACE, 'Words: John Newton (1779) · Public domain'),
        bg: bgs.dawn,
      },
      {
        song: newSong(
          'Auld Lang Syne',
          AULD_LANG_SYNE,
          'Words: Robert Burns (1788) · Tune: traditional · Public domain',
        ),
        bg: bgs.water,
      },
    ];
    const songScenes = songs.map(({ song, bg }) => {
      const { sceneId, cueIds } = buildSong(show, song, { linesPerSlide: 4 });
      // Every slide brings its song's picture, so a jump into any verse looks right.
      for (const id of cueIds.slice(0, -1))
        show.cues.find((c) => c.id === id)!.actions.push(...only(bg));
      return sceneId;
    });
    const [grace, auld] = songScenes as [string, string];

    // A reading between the songs.
    const readingScene = addScene(show, 'A reading');
    const readingTitle = words(k, 'Reading title', across(150, 140), 'Psalm 23', {
      ...type({ ...display, italic: true }, 110, INK),
      shadow: 'soft',
    });
    const readingText = words(k, 'Reading', across(330, 600), '', {
      ...type({ ...body, weight: 500, lineHeight: 1.4 }, 60, INK),
      shadow: 'soft',
    });
    const readingCredit = words(
      k,
      'Reading credit',
      across(968, 52),
      'World English Bible (British Edition) · Public domain',
      { ...type({ ...body, weight: 500 }, 34, WARM), shadow: 'soft' },
    );
    PSALM.forEach((text, i) => {
      addCue(
        show,
        readingScene.id,
        i === 0 ? 'Psalm 23' : `Psalm 23 (${i + 1}/${PSALM.length})`,
        [
          ...(i === 0
            ? [
                ...only(bgs.hills),
                fade(readingTitle.id, true, SLOW),
                fade(readingCredit.id, true, SLOW),
              ]
            : []),
          fade(readingText.id, false, 0.6),
          say(readingText.id, text, 0.6),
          fade(readingText.id, true, SLOW, 0.6),
        ],
        { access: { caption: text } },
      );
    });
    addCue(show, readingScene.id, 'End of reading', [
      fade(readingTitle.id, false, SLOW),
      fade(readingText.id, false, SLOW),
      fade(readingCredit.id, false, SLOW),
    ]);
    // The reading goes between the two songs.
    const scenes = show.scenes;
    scenes.splice(
      scenes.findIndex((s) => s.id === auld),
      0,
      scenes.pop()!,
    );

    // Sending out.
    const closingScene = addScene(show, 'Closing');
    const closing = words(k, 'Closing', across(330, 220), 'Go in peace', {
      ...type(display, 150, INK),
      shadow: 'soft',
    });
    const closingLine = words(
      k,
      'Closing line',
      across(570, 180),
      'Thank you for coming.\nTea and coffee are in the hall.',
      { ...type({ ...body, weight: 500, lineHeight: 1.35 }, 60, WARM), shadow: 'soft' },
    );
    addCue(show, closingScene.id, 'Go in peace', [
      ...only(bgs.hills),
      fade(closing.id, true, SLOW),
      fade(closingLine.id, true, SLOW, 0.5),
      play(music.id),
      fade(music.id, true, 4),
    ]);
    addCue(show, closingScene.id, 'Lights down', [
      fade(closing.id, false, 3),
      fade(closingLine.id, false, 3),
      fade(shade.id, false, 3),
      fade(glow.id, false, 3),
      ...Object.values(bgs).map((b) => fade(b.id, false, 3)),
      ...musicOut(music.id, 5),
    ]);

    // Keys: C the next chorus, R this song again, N the next song; MIDI program 1–2 a song.
    show.inputs.keys.push(
      {
        key: 'KeyC',
        command: { type: 'jump', target: { to: 'section', section: 'Chorus' }, fire: true },
      },
      { key: 'KeyR', command: { type: 'jump', target: { to: 'restartScene' }, fire: true } },
      { key: 'KeyN', command: { type: 'jump', target: { to: 'nextScene' }, fire: false } },
    );
    songScenes.forEach((sceneId, i) =>
      show.inputs.midi.push({
        kind: 'program',
        channel: null,
        number: i,
        command: { type: 'jump', target: { to: 'scene', sceneId }, fire: false },
      }),
    );
    const byName = (n: string) => show.scenes.find((s) => s.name === n)!.id;
    show.setlists = [
      {
        id: uid('set'),
        name: 'Sunday morning',
        scenes: show.scenes.map((s) => s.id),
      },
      {
        id: uid('set'),
        name: 'Community evening',
        scenes: [byName('Notices'), byName('Notices off'), auld, grace, byName('Closing')],
      },
    ];
    return show;
  },
};
