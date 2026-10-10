import { uid, type Action, type Cue } from '@scrim/format';
import { addCue, addScene, follows, say } from '../lib/build/common.js';
import { did } from '../lib/learn.js';
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
  scrim,
  sound,
  startShow,
  type,
  words,
  type Face,
} from './layout.js';
import type { TemplateSeed } from './types.js';

/** A gallery wall: warm white, black ink, Hokusai's Prussian blue, wall labels set like print. */
const WALL = '#f4f1ea';
const INK = '#161616';
const GREY = '#4a4740';
const BLUE = '#1f3a64';
const NIGHT = '#05070c';

/** The prints on the wall in the attract loop, with their labels (The Met, Open Access). */
const PRINTS = [
  {
    key: 'wave',
    title: 'Under the Wave off Kanagawa',
    series: 'Thirty-six Views of Mount Fuji',
    artist: 'Katsushika Hokusai (1760–1849)',
    date: 'About 1830–32',
  },
  {
    key: 'print-2',
    title: 'South Wind, Clear Sky (Red Fuji)',
    series: 'Thirty-six Views of Mount Fuji',
    artist: 'Katsushika Hokusai (1760–1849)',
    date: 'About 1830–32',
  },
  {
    key: 'print-3',
    title: 'Kajikazawa in Kai Province',
    series: 'Thirty-six Views of Mount Fuji',
    artist: 'Katsushika Hokusai (1760–1849)',
    date: 'About 1830–32',
  },
  {
    key: 'print-4',
    title: 'Sudden Shower over Shin-Ōhashi Bridge',
    series: 'One Hundred Famous Views of Edo',
    artist: 'Utagawa Hiroshige (1797–1858)',
    date: '1857',
  },
  {
    key: 'print-5',
    title: 'Naruto Whirlpool, Awa Province',
    series: 'Famous Places in the Sixty-odd Provinces',
    artist: 'Utagawa Hiroshige (1797–1858)',
    date: 'About 1853',
  },
];

/**
 * The story, told in close-ups: caption, audio description, and (sample) translations for
 * phones. A native speaker must check the Spanish and French before opening.
 */
const STORY: {
  key: string;
  caption: string;
  describe: string;
  es: string;
  fr: string;
}[] = [
  {
    key: 'sea',
    caption: 'Off the coast of Kanagawa, about 1831, Hokusai looked out at the sea.',
    describe:
      'Moving footage of the open sea: rows of blue-grey swells with white crests rolling towards us.',
    es: 'Frente a la costa de Kanagawa, hacia 1831, Hokusai contempló el mar.',
    fr: 'Au large de Kanagawa, vers 1831, Hokusai a regardé la mer.',
  },
  {
    key: 'wave-detail-1',
    caption: 'The wave rears up, and its foam breaks into claws.',
    describe:
      'A close-up of the crest of the wave: deep blue water curling over into white foam shaped like reaching fingers, against a cream sky.',
    es: 'La ola se alza y su espuma se rompe en garras.',
    fr: 'La vague se dresse et son écume se brise en griffes.',
  },
  {
    key: 'wave-detail-2',
    caption: 'Below it, three boats. The rowers bow their heads and hold on.',
    describe:
      'A long narrow boat low in the swell; the rowers in blue crouch over their oars, heads down.',
    es: 'Debajo, tres barcas. Los remeros agachan la cabeza y resisten.',
    fr: 'Dessous, trois barques. Les rameurs baissent la tête et tiennent bon.',
  },
  {
    key: 'wave-detail-3',
    caption: 'And far away, small and still: Mount Fuji.',
    describe:
      'In the trough of the waves, a small snow-capped mountain, framed by the prow of a boat and falling spray.',
    es: 'Y a lo lejos, pequeño y quieto: el monte Fuji.',
    fr: 'Et au loin, petit et immobile : le mont Fuji.',
  },
  {
    key: 'wave-detail-4',
    caption: 'The title reads: Thirty-six Views of Mount Fuji. Under the Wave off Kanagawa.',
    describe:
      'A ruled box of Japanese characters, the print’s title, and beside it the artist’s signature, on aged cream paper.',
    es: 'El título dice: Treinta y seis vistas del monte Fuji. La gran ola de Kanagawa.',
    fr: 'Le titre indique : Trente-six vues du mont Fuji. Sous la vague au large de Kanagawa.',
  },
  {
    key: 'wave',
    caption: 'The whole print. Press the button to see the story again.',
    describe:
      'The whole print: the great wave on the left about to break over the boats, and Mount Fuji small beneath it.',
    es: 'El grabado completo. Pulse el botón para ver la historia otra vez.',
    fr: 'L’estampe entière. Appuyez sur le bouton pour revoir l’histoire.',
  },
];

const OPEN = 'open';
const QUIET = 'quiet';
const CLOSED = 'closed';

export const MUSEUM: TemplateSeed = {
  id: 'museum',
  title: 'The Great Wave',
  group: 'museums',
  forWho: 'A museum’s exhibitions team installing a screen that runs on its own',
  blurb:
    'Prints on a quiet gallery wall until a visitor presses the button, then a short story in close-ups, with captions, translations and audio description on visitors’ own phones. It keeps opening hours and a quiet hour by itself.',
  needs: [
    'A small PC and a wall display (or a projector)',
    'A big arcade button, or any key',
    'The internet, for visitors’ phones (the button works without it)',
  ],
  replace: [
    'The artworks and their labels',
    'The story and its captions',
    'Your opening hours',
    'The translations',
  ],
  limits: [
    'There are no alerts to the office if the screen fails.',
    'The Spanish and French captions are samples: have a native speaker check them.',
  ],
  assets: [
    { key: 'display', path: 'fonts/CormorantGaramond.woff2' },
    { key: 'italic', path: 'fonts/CormorantGaramond-Italic.woff2' },
    { key: 'label', path: 'fonts/IBMPlexSans.woff2' },
    ...PRINTS.map((p) => ({ key: p.key, path: `museum/${p.key}.webp` })),
    ...[1, 2, 3, 4].map((n) => ({ key: `wave-detail-${n}`, path: `museum/wave-detail-${n}.webp` })),
    { key: 'sea', path: 'museum/video-ocean.mp4' },
    { key: 'surf', path: 'museum/sfx-sea.m4a' },
  ],
  learn: [
    {
      id: 'hours',
      title: 'Set your opening hours',
      hint: 'Outputs & audio › Installation: change the hours, then use Try a time.',
      done: did.schedule,
    },
    {
      id: 'button',
      title: 'Map your button',
      hint: 'Controls tab: press “Map a key” on “Visitor button” and press your arcade button.',
      done: did.mapped,
    },
    {
      id: 'installation',
      title: 'Test it as an installation',
      hint: 'Outputs & audio › Installation › Test as installation.',
      done: did.installation,
    },
    {
      id: 'room',
      title: 'Open the room so phones can follow',
      hint: 'Keep the room code, then print the QR code for the wall.',
      done: did.room,
    },
    {
      id: 'captions',
      title: 'Check the captions in each language',
      hint: 'Access tab: read the story’s captions in Spanish and French.',
      done: did.cueEdited,
    },
  ],
  heroes: [
    'Wall · wave',
    'Wall · print-2',
    'Wall · print-4',
    'Story · sea',
    'Story · wave-detail-1',
    'Story · wave-detail-3',
    'Closed',
  ],
  visual: {
    minText: 56,
    minContrast: 4.5,
    labels: [
      'Label series',
      'Label artist',
      'Label date',
      'Label credit',
      'Join line',
      'Join card · code',
      'Prompt',
      'Closed line',
    ],
  },
  make(media) {
    const show = startShow('The Great Wave');
    addMedia(show, media);
    show.editor = { mode: 'simple' };
    show.languages = { base: 'en', others: ['es', 'fr'] };
    show.relaxed = { brightness: 0.8, volume: 0.5, minFade: 2 };
    show.defaultFade = { duration: 2, easing: 'easeInOut' };
    const k = kit(show);
    const display: Face = { font: media.display!, weight: 500 };
    const italic: Face = { font: media.italic!, weight: 500, italic: true };
    const label: Face = { font: media.label!, weight: 500 };

    // Opening hours: the screen sets the scene for the hours it wakes into.
    const hours = {
      id: uid('var'),
      name: 'hours',
      type: 'choice' as const,
      options: [OPEN, QUIET, CLOSED],
      initial: CLOSED,
    };
    show.vars.push(hours);
    show.schedule = {
      varId: hours.id,
      periods: [
        { days: [3], from: 600, to: 660, value: QUIET },
        { days: [0, 2, 3, 4, 5, 6], from: 600, to: 1020, value: OPEN },
      ],
      otherwise: CLOSED,
    };
    // Where the piece is, so the button starts the story only from the wall.
    const now = {
      id: uid('var'),
      name: 'playing',
      type: 'choice' as const,
      options: ['wall', 'story', 'closed'],
      initial: 'wall',
    };
    show.vars.push(now);
    const at = (value: string): Action => ({ type: 'setVar', varId: now.id, value });

    // The wall.
    const wall = panel(k, 'Gallery wall', FULL, WALL);
    const prints = PRINTS.map((p) => {
      const layer = picture(
        k,
        media[p.key]!,
        `Print · ${p.key}`,
        { x: 0, y: 0, w: 1080, h: 800 },
        { fit: 'contain' },
      );
      place(k, wall, layer, { x: 96, y: 96 });
      layer.visible = false;
      return layer;
    });
    const put = <L extends { visible: boolean }>(
      l: L & { id: string; x: number; y: number },
      x: number,
      y: number,
    ) => {
      place(k, wall, l, { x, y });
      l.visible = false;
      return l;
    };
    // The wall label, to the right of the print, as a museum sets it.
    const col = { x: 1256, w: 568 };
    const text = (
      name: string,
      y: number,
      h: number,
      value: string,
      style: Parameters<typeof words>[4],
    ) =>
      put(
        words(k, name, { x: 0, y: 0, w: col.w, h }, value, { ...style, align: 'left' }),
        col.x,
        y,
      );
    const labelTitle = text(
      'Label title',
      96,
      190,
      '',
      type({ ...italic, lineHeight: 1.05 }, 64, INK),
    );
    const labelSeries = text(
      'Label series',
      300,
      90,
      '',
      type({ ...label, lineHeight: 1.3 }, 32, GREY),
    );
    const labelArtist = text('Label artist', 400, 50, '', type({ ...label, weight: 600 }, 32, INK));
    const labelDate = text('Label date', 450, 50, '', type(label, 32, GREY));
    const labelCredit = text(
      'Label credit',
      510,
      90,
      'Woodblock print · The Met, Open Access',
      type({ ...label, lineHeight: 1.3 }, 32, GREY),
    );
    const labels = [labelTitle, labelSeries, labelArtist, labelDate];
    const prompt = put(
      words(k, 'Prompt', { x: 0, y: 0, w: 1080, h: 60 }, 'Press the button to begin', {
        ...type({ ...label, weight: 600, uppercase: true, letterSpacing: 0.14 }, 36, BLUE),
      }),
      96,
      930,
    );
    const join = put(
      joinCard(
        k,
        'Join card',
        { x: 0, y: 0, w: 290, h: 350 },
        {
          ink: INK,
          paper: '#ffffff',
          codeFace: { ...label, weight: 600 },
          codeSize: 32,
          radius: 4,
        },
      ),
      col.x,
      640,
    );
    const joinLine = text(
      'Join line',
      650,
      230,
      'Captions, translations and audio description on your phone',
      type({ ...label, lineHeight: 1.3 }, 32, GREY),
    );
    joinLine.x = col.x + 314;
    joinLine.w = col.w - 314;

    const surf = sound(k, media.surf!, 'Surf', { loop: true, volume: 0.35 });

    // The attract loop: one print at a time, each with its label; the prompt breathes.
    const attract = addScene(show, 'On the wall');
    const wallCues: Cue[] = PRINTS.map((p, i) => {
      const others = prints.filter((_, j) => j !== i);
      return addCue(
        show,
        attract.id,
        `Wall · ${p.key}`,
        [
          at('wall'),
          fade(wall.id, true, 2),
          fade(prints[i]!.id, true, 3),
          ...others.map((o) => fade(o.id, false, 3)),
          ...labels.map((l) => fade(l.id, false, 1)),
          say(labelTitle.id, p.title, 1),
          say(labelSeries.id, `From the series ${p.series}`, 1),
          say(labelArtist.id, p.artist, 1),
          say(labelDate.id, p.date, 1),
          ...labels.map((l) => fade(l.id, true, 2, 1)),
          fade(labelCredit.id, true, 2),
          fade(join.id, true, 2),
          fade(joinLine.id, true, 2),
          fade(prompt.id, true, 3),
          fade(prompt.id, false, 3, 7),
        ],
        {
          ...follows(14),
          access: { caption: `${p.title}. ${p.artist}, ${p.date}.` },
        },
      );
    });
    addCue(show, attract.id, 'Round again', [
      { type: 'goToCue', cueId: wallCues[0]!.id, fire: true },
    ]);

    // The story: close-ups dissolving one into the next, then back to the wall.
    const stage = panel(k, 'Story', FULL, NIGHT);
    const sea = picture(k, media.sea!, 'Sea', FULL, { loop: true });
    place(k, stage, sea, { x: 0, y: 0 });
    sea.visible = false;
    const shots = STORY.map((s) => {
      if (s.key === 'sea') return sea;
      const l = picture(
        k,
        media[s.key]!,
        `Close-up · ${s.key}`,
        FULL,
        s.key === 'wave' ? { fit: 'contain' } : {},
      );
      place(k, stage, l, { x: 0, y: 0 });
      l.visible = false;
      return l;
    });
    const band = scrim(k, 'caption', 'bottom', NIGHT, { reach: 0.42, strength: 0.94 });
    const caption = words(k, 'Story caption', { x: 160, y: 820, w: 1600, h: 180 }, '', {
      ...type({ ...display, lineHeight: 1.12 }, 64, '#ffffff'),
      shadow: 'soft',
    });
    const story = addScene(show, 'The story');
    STORY.forEach(
      (s, i) =>
        void addCue(
          show,
          story.id,
          `Story · ${s.key}`,
          [
            ...(i === 0
              ? [
                  at('story'),
                  fade(wall.id, false, 2),
                  fade(stage.id, true, 2),
                  fade(band.id, true, 2),
                  play(sea.id, { restart: true }),
                  ...musicIn(surf.id, 3),
                ]
              : []),
            fade(shots[i]!.id, true, 2.5),
            // Every other shot goes, so a story cut short never leaves a close-up behind.
            ...shots.filter((_, j) => j !== i).map((l) => fade(l.id, false, 2.5)),
            fade(caption.id, false, 0.8),
            say(caption.id, s.caption, 0.8),
            fade(caption.id, true, 1.5, 0.8),
          ],
          {
            ...follows(i === STORY.length - 1 ? 12 : 10),
            access: {
              caption: s.caption,
              description: s.describe,
              i18n: { es: { caption: s.es }, fr: { caption: s.fr } },
            },
          },
        ),
    );
    addCue(
      show,
      story.id,
      'Back to the wall',
      [
        fade(caption.id, false, 2),
        fade(band.id, false, 2),
        fade(stage.id, false, 2),
        fade(shots.at(-1)!.id, false, 2),
        ...musicOut(surf.id, 3),
        { type: 'goToCue', cueId: wallCues[0]!.id, fire: true },
      ],
      { access: { caption: '' } },
    );

    // Closed: almost dark, saying when it opens.
    const closedScene = addScene(show, 'Closed');
    const closedTitle = words(
      k,
      'Closed title',
      { x: 96, y: 420, w: 1728, h: 140 },
      'Closed for the night',
      {
        ...type(italic, 96, '#9a9488'),
        shadow: 'soft',
      },
    );
    const closedLine = words(
      k,
      'Closed line',
      { x: 96, y: 580, w: 1728, h: 60 },
      'The gallery opens again at 10:00.',
      {
        ...type({ ...label, weight: 400 }, 32, '#8f8a80'),
        shadow: 'soft',
      },
    );
    addCue(
      show,
      closedScene.id,
      'Closed',
      [
        at('closed'),
        fade(wall.id, false, 3),
        fade(stage.id, false, 3),
        fade(band.id, false, 3),
        fade(caption.id, false, 3),
        ...shots.map((l) => fade(l.id, false, 3)),
        ...musicOut(surf.id, 3),
        fade(closedTitle.id, true, 3, 2),
        fade(closedLine.id, true, 3, 2.5),
      ],
      { access: { caption: 'The gallery is closed. It opens again at 10:00.' } },
    );

    // The wall clears whatever was up before: the night's words, or a story the hours cut short.
    wallCues[0]!.actions.push(
      fade(closedTitle.id, false, 2),
      fade(closedLine.id, false, 2),
      fade(stage.id, false, 2),
      fade(band.id, false, 2),
      fade(caption.id, false, 2),
      ...shots.map((l) => fade(l.id, false, 2)),
      ...musicOut(surf.id, 3),
    );

    // The visitor's button starts the story, but only from the wall.
    const button = { id: uid('trg'), name: 'Visitor button', color: '#1f3a64' };
    show.triggers.push(button);
    show.inputs.keys.push({ key: 'Enter', command: { type: 'trigger', triggerId: button.id } });
    show.inputs.gamepad.push({ button: 0, command: { type: 'trigger', triggerId: button.id } });
    rule(
      show,
      'A visitor presses the button',
      { type: 'trigger', triggerId: button.id },
      [{ varId: now.id, op: 'eq', value: 'wall' }],
      [{ type: 'jumpScene', sceneId: story.id, fire: true }],
    );

    // The hours set the scene: the wall when open, quiet (relaxed) for the quiet hour.
    rule(
      show,
      'Opening time',
      { type: 'varChanged', varId: hours.id },
      [{ varId: hours.id, op: 'eq', value: OPEN }],
      [
        { type: 'relaxed', on: false },
        { type: 'goToCue', cueId: wallCues[0]!.id, fire: true },
      ],
    );
    rule(
      show,
      'The quiet hour',
      { type: 'varChanged', varId: hours.id },
      [{ varId: hours.id, op: 'eq', value: QUIET }],
      [
        { type: 'relaxed', on: true },
        { type: 'goToCue', cueId: wallCues[0]!.id, fire: true },
      ],
    );
    rule(
      show,
      'Closing time',
      { type: 'varChanged', varId: hours.id },
      [{ varId: hours.id, op: 'eq', value: CLOSED }],
      [
        { type: 'relaxed', on: false },
        { type: 'jumpScene', sceneId: closedScene.id, fire: true },
      ],
    );
    return show;
  },
};
