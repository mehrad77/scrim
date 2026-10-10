import { uid, type Action, type Cue, type VideoLayer } from '@scrim/format';
import { addCue, addScene } from '../lib/build/common.js';
import { did } from '../lib/learn.js';
import { createResultVars, newMoment } from '../lib/moments.js';
import {
  across,
  addMedia,
  fade,
  FULL,
  joinCard,
  kit,
  musicIn,
  musicOut,
  panel,
  picture,
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

/** Dark and cinematic: NASA footage graded blue to magenta, giant condensed words, hard cuts. */
const BLACK = '#04030a';
const INK = '#ffffff';
const MAGENTA = '#ff4fb1';
const CYAN = '#5ee7ff';
/** Cuts between sections: quick, never a flash. */
const CUT = 0.2;

/** "Satellite": written for this template; the chorus is the room's to sing. */
const SATELLITE_CHORUS =
  'We are satellites tonight,\nturning round the same light.\nHold on, hold on:\nwe are satellites tonight.';

const SONGS = [
  { title: 'Afterglow', a: 'earth', b: 'aurora', word: 'Afterglow' },
  { title: 'Satellite', a: 'aurora', b: 'space', word: 'Satellite' },
  { title: 'Gravity', a: 'sun', b: 'space', word: 'Gravity' },
] as const;

export const GIG: TemplateSeed = {
  id: 'gig',
  title: 'Night Shift: Live',
  group: 'music',
  forWho: 'A band with a projector or LED wall and nobody to run the visuals',
  blurb:
    'Big, dark, cinematic visuals for every song, run hands-free: a program change starts a song, a pedal moves to the next section. Change tonight’s order in seconds, and let the crowd vote for the encore.',
  needs: [
    'A projector or LED wall',
    'A MIDI foot controller or the playback laptop sending program changes (keys work too)',
    'Optional: the internet, for the encore vote on phones',
  ],
  replace: [
    'The band’s name and tonight’s city',
    'The songs and their sections',
    'The loops behind each song',
    'The sing-along words',
  ],
  limits: [
    'Visuals follow cues, not the beat: there’s no tempo sync, timecode or audio-reactive effects yet.',
  ],
  assets: [
    { key: 'display', path: 'fonts/Anton.woff2' },
    { key: 'body', path: 'fonts/AtkinsonHyperlegibleNext.woff2' },
    { key: 'earth', path: 'gig/loop-earth.mp4' },
    { key: 'sun', path: 'gig/loop-sun.mp4' },
    { key: 'space', path: 'gig/loop-space.mp4' },
    { key: 'aurora', path: 'gig/loop-aurora.mp4' },
    { key: 'walkin', path: 'gig/music-walkin.m4a' },
  ],
  learn: [
    {
      id: 'band',
      title: 'Put in your band’s name',
      hint: 'Interaction tab › Values: change “band” (and “city” each night).',
      done: did.value('band'),
    },
    {
      id: 'songs',
      title: 'Make the songs yours',
      hint: 'Cues tab: rename the songs and their sections; drop your own loops on the Stage.',
      done: did.cueEdited,
    },
    {
      id: 'midi',
      title: 'Run a song hands-free',
      hint: 'Plug in your controller: program change 1–3 starts a song, the sustain pedal moves on.',
      done: did.midi,
    },
    {
      id: 'setlist',
      title: 'Make tonight’s setlist',
      hint: 'Run the show, then Order: drag the songs, and keep it as a setlist.',
      done: did.setlist,
    },
    {
      id: 'encore',
      title: 'Let the crowd pick the encore',
      hint: 'Open the audience room before the show; the code goes up with the vote.',
      done: did.decided,
    },
  ],
  heroes: [
    'Afterglow · Chorus',
    'Walk-in',
    'Satellite · Chorus',
    'Gravity · Bridge',
    'Encore vote',
    'Thank you',
  ],
  visual: {
    minText: 56,
    minContrast: 4.5,
    labels: ['Live', 'Encore hint', 'Join card · code', 'Song number'],
  },
  make(media) {
    const show = startShow('Night Shift: Live');
    addMedia(show, media);
    show.operator = { goHoldMs: 0 };
    show.defaultFade = { duration: CUT, easing: 'linear' };
    const k = kit(show);
    const display: Face = {
      font: media.display!,
      weight: 400,
      uppercase: true,
      letterSpacing: 0.04,
    };
    const body: Face = { font: media.body!, weight: 700 };
    show.vars.push({ id: uid('var'), name: 'band', type: 'text', initial: 'Night Shift' });
    show.vars.push({ id: uid('var'), name: 'city', type: 'text', initial: 'Leeds' });
    const encoreVar = { id: uid('var'), name: 'encore', type: 'number' as const, initial: 0 };
    show.vars.push(encoreVar);

    const ground = panel(k, 'Black', FULL, BLACK);
    ground.visible = true;
    const loops: Record<string, VideoLayer> = {};
    for (const key of ['earth', 'sun', 'space', 'aurora'])
      loops[key] = picture(k, media[key]!, `Loop · ${key}`, FULL, { loop: true }) as VideoLayer;
    const shade = scrim(k, 'words', 'bottom', BLACK, { reach: 0.6, strength: 0.85 });
    /** One loop on, the rest off; a cut unless `seconds` says otherwise. */
    const loop = (key: string, seconds = CUT, level = 1): Action[] =>
      Object.entries(loops).flatMap(([name, l]): Action[] =>
        name === key
          ? [
              play(l.id),
              level === 1
                ? fade(l.id, true, seconds)
                : ({
                    type: 'fade',
                    layerId: l.id,
                    opacity: level,
                    duration: seconds,
                    easing: 'linear',
                  } as Action),
            ]
          : [fade(l.id, false, seconds)],
      );

    // Words: the band, a song's title, the giant chorus word, the sing-along line.
    const live = words(k, 'Live', { x: 96, y: 300, w: 1728, h: 60 }, 'Live tonight', {
      ...type({ ...display, letterSpacing: 0.4 }, 44, MAGENTA),
      shadow: 'strong',
    });
    const band = words(k, 'Band', across(390, 280), '{{band}}', {
      ...type({ ...display, lineHeight: 0.95 }, 210, INK),
      shadow: 'strong',
    });
    const number = words(k, 'Song number', { x: 96, y: 330, w: 1728, h: 60 }, '', {
      ...type({ ...display, letterSpacing: 0.4 }, 44, CYAN),
      shadow: 'strong',
    });
    const title = words(k, 'Song title', across(400, 360), '', {
      ...type(display, 300, INK),
      shadow: 'strong',
    });
    const giant = words(k, 'Giant word', across(320, 420), '', {
      ...type({ ...display, lineHeight: 0.9 }, 340, INK),
      shadow: 'strong',
    });
    const lyrics = words(k, 'Lyrics', across(640, 380), '', {
      ...type({ ...body, lineHeight: 1.2 }, 72, INK),
      shadow: 'strong',
    });
    const words_ = [live, band, number, title, giant, lyrics];
    const only = (...on: { id: string }[]): Action[] =>
      words_.map((w) => fade(w.id, on.includes(w), CUT));
    const walkin = sound(k, media.walkin!, 'Walk-in music', { loop: true, volume: 0.6 });

    // Walk-in.
    const doors = addScene(show, 'Walk-in');
    addCue(
      show,
      doors.id,
      'Walk-in',
      [
        ...loop('space', 3),
        fade(shade.id, true, 3),
        fade(live.id, true, 3, 1),
        fade(band.id, true, 3, 1.5),
        ...musicIn(walkin.id, 4),
      ],
      { notes: 'Open the audience room before doors, for the encore vote.' },
    );

    // The songs: one scene each, a cue per section, named so a key or pedal can jump.
    const songScenes: string[] = [];
    const outros: Cue[] = [];
    SONGS.forEach((song, i) => {
      const scene = addScene(show, song.title);
      songScenes.push(scene.id);
      const sec = (name: string, actions: Action[], caption?: string) =>
        addCue(show, scene.id, `${song.title} · ${name}`, actions, {
          section: name,
          ...(caption !== undefined ? { access: { caption } } : {}),
        });
      sec('Intro', [
        // Any song can open the set: a setlist or a program change may start here.
        ...musicOut(walkin.id, 2),
        ...loop(song.a, 1.5, 0.55),
        fade(shade.id, true, 1),
        ...only(number, title),
        {
          type: 'setText',
          layerId: number.id,
          text: `${['One', 'Two', 'Three'][i]} · ${song.title}`,
        },
        { type: 'setText', layerId: title.id, text: song.title },
      ]);
      sec('Verse', [...loop(song.a, CUT, 0.7), ...only(), fade(shade.id, false, 1)]);
      sec(
        'Chorus',
        [
          ...loop(song.a),
          { type: 'setText', layerId: giant.id, text: song.word },
          ...(song.title === 'Satellite'
            ? [
                fade(shade.id, true, CUT),
                { type: 'setText', layerId: lyrics.id, text: SATELLITE_CHORUS } as Action,
                ...only(lyrics),
              ]
            : [fade(shade.id, false, CUT), ...only(giant)]),
        ],
        song.title === 'Satellite' ? SATELLITE_CHORUS : undefined,
      );
      sec('Bridge', [...loop(song.b), ...only(), fade(shade.id, false, CUT)], '');
      sec('Last chorus', [
        ...loop(song.a),
        { type: 'setText', layerId: giant.id, text: song.word },
        ...only(giant),
      ]);
      outros.push(sec('Outro', [...loop(song.a, 4, 0.4), ...only(), fade(shade.id, true, 4)], ''));
    });

    // The encore: the crowd picks, the band plays it, then the walk-out.
    const vote = newMoment('vote', show);
    vote.name = 'Encore';
    vote.prompt = 'Which song for the encore?';
    vote.durationSec = 45;
    vote.options = [
      { id: 'a', label: SONGS[0].title },
      { id: 'b', label: SONGS[1].title },
    ];
    vote.defaultResult = 'a';
    createResultVars(show, vote);
    show.moments.push(vote);
    const ask = words(k, 'Encore question', across(180, 360), 'One more?', {
      ...type({ ...display, lineHeight: 0.95 }, 300, INK),
      shadow: 'strong',
    });
    const options = words(
      k,
      'Encore options',
      { x: 96, y: 560, w: 1100, h: 240 },
      `1   ${SONGS[0].title}\n2   ${SONGS[1].title}`,
      {
        ...type({ ...display, lineHeight: 1.1 }, 100, CYAN),
        align: 'left',
        shadow: 'strong',
      },
    );
    const hint = words(
      k,
      'Encore hint',
      { x: 96, y: 860, w: 1100, h: 60 },
      'Vote on your phone: scan the code',
      {
        ...type({ ...body, weight: 600 }, 40, MAGENTA),
        align: 'left',
        shadow: 'strong',
      },
    );
    const join = joinCard(
      k,
      'Join card',
      { x: 1424, y: 520, w: 400, h: 500 },
      {
        ink: BLACK,
        paper: '#ffffff',
        codeFace: { ...display, letterSpacing: 0.12 },
        codeSize: 60,
        radius: 8,
      },
    );
    const encore = addScene(show, 'Encore vote');
    addCue(
      show,
      encore.id,
      'Encore vote',
      [
        ...loop('space', 2, 0.6),
        fade(shade.id, true, 2),
        ...only(),
        fade(ask.id, true, 1),
        fade(options.id, true, 1, 0.3),
        fade(hint.id, true, 1, 0.5),
        fade(join.id, true, 1, 0.5),
        { type: 'openMoment', momentId: vote.id },
      ],
      { access: { caption: 'One more? Vote for the encore on your phone.' } },
    );
    // GO before the timer: the vote closes then, and its rule puts the chosen song on standby.
    addCue(show, encore.id, 'Encore decided', [{ type: 'closeMoment', momentId: vote.id }]);
    const leaveVote = [
      fade(ask.id, false, 1),
      fade(options.id, false, 1),
      fade(hint.id, false, 1),
      fade(join.id, false, 1),
    ];
    vote.options.forEach((o, i) =>
      rule(
        show,
        `Encore: ${o.label}`,
        { type: 'momentClosed', momentId: vote.id },
        [{ varId: vote.resultVarId!, op: 'eq', value: o.id }],
        [
          { type: 'setVar', varId: encoreVar.id, value: 1 },
          ...leaveVote,
          { type: 'jumpScene', sceneId: songScenes[i]!, fire: false },
        ],
      ),
    );

    // Starting any song clears the vote, whichever way the show got there.
    for (const sceneId of songScenes)
      show.cues.find((c) => c.sceneId === sceneId)!.actions.push(...leaveVote);

    // The walk-out, after the encore.
    const out = addScene(show, 'Walk-out');
    const thanks = words(k, 'Thank you', across(250, 580), 'Thank you,\n{{city}}!', {
      ...type({ ...display, lineHeight: 1 }, 240, INK),
      shadow: 'strong',
    });
    addCue(
      show,
      out.id,
      'Thank you',
      [
        ...leaveVote,
        ...loop('earth', 3),
        fade(shade.id, true, 3),
        ...only(),
        fade(thanks.id, true, 2, 1),
        ...musicIn(walkin.id, 4),
      ],
      { access: { caption: 'Thank you! Goodnight.' } },
    );
    addCue(show, out.id, 'House lights', [
      fade(thanks.id, false, 4),
      fade(shade.id, false, 4),
      ...Object.values(loops).map((l) => fade(l.id, false, 4)),
      ...musicOut(walkin.id, 6),
    ]);
    // After an encore, the song's outro leads to the walk-out.
    for (const outro of outros.slice(0, 2))
      rule(
        show,
        `After the encore: ${outro.name}`,
        { type: 'cueFired', cueId: outro.id },
        [{ varId: encoreVar.id, op: 'eq', value: 1 }],
        [{ type: 'jumpScene', sceneId: out.id, fire: false }],
      );

    // Hands-free: program change 1–3 starts a song; the sustain pedal (or a note) is GO.
    songScenes.forEach((sceneId, i) => {
      show.inputs.midi.push({
        kind: 'program',
        channel: null,
        number: i,
        command: { type: 'jump', target: { to: 'scene', sceneId }, fire: true },
      });
      show.inputs.keys.push({
        key: `Digit${i + 1}`,
        command: { type: 'jump', target: { to: 'scene', sceneId }, fire: true },
      });
    });
    show.inputs.midi.push(
      { kind: 'cc', channel: null, number: 64, command: { type: 'go' } },
      { kind: 'note', channel: null, number: 36, command: { type: 'go' } },
    );
    show.inputs.keys.push(
      {
        key: 'KeyC',
        command: { type: 'jump', target: { to: 'section', section: 'Chorus' }, fire: true },
      },
      {
        key: 'KeyB',
        command: { type: 'jump', target: { to: 'section', section: 'Bridge' }, fire: true },
      },
    );
    const all = show.scenes.map((s) => s.id);
    show.setlists = [
      { id: uid('set'), name: 'Full set', scenes: all },
      {
        id: uid('set'),
        name: 'Festival set (short)',
        scenes: [doors.id, songScenes[1]!, songScenes[2]!, out.id],
      },
    ];
    return show;
  },
};
