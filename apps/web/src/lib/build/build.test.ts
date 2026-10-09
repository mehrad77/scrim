import { initialState, step, type EngineInput, type EngineState } from '@scrim/engine';
import { createShow, cueOrder, parseShow, type Media, type Show } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import { checkFlashes } from '../flash.js';
import { checkLogic } from '../logic.js';
import { syncResultVars } from '../moments.js';
import { newSong } from '../songs.js';
import { buildChoice } from './choice.js';
import { buildNotices } from './notices.js';
import { buildPhotoStory } from './photoStory.js';
import { buildQuiz } from './quiz.js';
import { buildSong } from './song.js';

/** What every built show must be: a valid show, with nothing for the logic or flash checks. */
function sound(show: Show) {
  expect(() => parseShow(structuredClone(show))).not.toThrow();
  expect(checkLogic(show).map((i) => i.text)).toEqual([]);
  expect(checkFlashes(show)).toEqual([]);
}

function run(show: Show, inputs: [number, EngineInput][], state = initialState(show)) {
  for (const [t, input] of inputs) state = step(show, state, input, t).state;
  return state;
}

const textOf = (show: Show, s: EngineState, name: string) => {
  const layer = show.layers.find((l) => l.name === name)!;
  return s.layers[layer.id]!.text;
};

const media = (id: string, kind: Media['kind']): Media => ({
  id,
  kind,
  name: `${id}.${kind === 'audio' ? 'mp3' : 'jpg'}`,
  mime: kind === 'audio' ? 'audio/mpeg' : 'image/jpeg',
  size: 1,
});

describe('builders', () => {
  it('a song: one cue per slide in the order sung, captioned, with the credit line', () => {
    const show = createShow('Service');
    const song = newSong(
      'Amazing Grace',
      'Amazing grace\nhow sweet the sound\n\nChorus\nPraise the Lord\n\nI once was lost\nbut now am found\n\nChorus',
      'Words: John Newton',
    );
    const built = buildSong(show, song, { licence: '123456' });
    sound(show);
    const cues = cueOrder(show).filter((c) => c.sceneId === built.sceneId);
    expect(cues.map((c) => c.name)).toEqual([
      'Verse 1',
      'Chorus',
      'Verse 2',
      'Chorus',
      'End of song',
    ]);
    expect(cues[1]).toMatchObject({ section: 'Chorus', access: { caption: 'Praise the Lord' } });
    let s = run(show, [[0, { type: 'fireCue', cueId: cues[0]!.id }]]);
    expect(textOf(show, s, 'Song credit')).toBe(
      'Amazing Grace · Words: John Newton · Licence 123456',
    );
    // A key that jumps to the chorus finds it.
    s = run(
      show,
      [[10, { type: 'jump', target: { to: 'section', section: 'Chorus' }, fire: true }]],
      s,
    );
    expect(textOf(show, s, 'Lyrics')).toBe('Praise the Lord');
    // A second song shares the lyrics layer.
    buildSong(show, newSong('Be Thou My Vision', 'Be thou my vision'));
    expect(show.layers.filter((l) => l.name === 'Lyrics')).toHaveLength(1);
    sound(show);
  });

  it('notices crossfade on their own, go round again, and end from their own scene', () => {
    const show = createShow('Notices');
    const built = buildNotices(show, {
      notices: [
        { title: 'Welcome', body: 'Tea after the service' },
        { title: 'Choir', body: 'Thursdays at 7' },
        { title: 'Flowers', body: 'Thank you, Ann' },
      ],
      seconds: 8,
      loop: true,
    });
    sound(show);
    // What the audience reads: the title layer that is up.
    const up = (s: EngineState) =>
      show.layers
        .filter((l) => l.name.startsWith('Notice title') && s.layers[l.id]!.opacity.to > 0)
        .map((l) => s.layers[l.id]!.text);
    let s = run(show, [[0, { type: 'fireCue', cueId: built.cueIds[0]! }]]);
    expect(up(s)).toEqual(['Welcome']);
    s = run(show, [[8000, { type: 'tick' }]], s);
    expect(up(s)).toEqual(['Choir']);
    s = run(show, [[16_000, { type: 'tick' }]], s);
    expect(up(s)).toEqual(['Flowers']);
    // After the last one, round again to the first, on a pair the last one isn't using.
    s = run(show, [[24_000, { type: 'tick' }]], s);
    expect(up(s)).toEqual(['Welcome']);
    // Moving on reaches the end, which leaves nothing on stage, even mid-change.
    const end = run(show, [[24_100, { type: 'jump', target: { to: 'nextScene' }, fire: true }]], s);
    expect(up(end)).toEqual([]);
    expect(run(show, [[30_000, { type: 'tick' }]], end).timers).toEqual([]);
  });

  it('a song cue jumped to from a fresh start shows its words', () => {
    const show = createShow('Service');
    const built = buildSong(show, newSong('Hymn', 'One\n\nChorus\nTwo'), { linesPerSlide: 8 });
    const s = run(show, [[0, { type: 'fireCue', cueId: built.cueIds[1]! }]]);
    expect(s.layers[built.lyricsId]!.opacity.to).toBe(1);
    // Eight lines and a wrapped one fit the box.
    const lyrics = show.layers.find((l) => l.id === built.lyricsId)!;
    expect(lyrics.kind === 'text' && lyrics.fontSize * 1.2 * 9).toBeLessThanOrEqual(lyrics.h);
  });

  it('a photo story dissolves each picture into the next under music, and can loop', () => {
    const show = createShow('Memories');
    const built = buildPhotoStory(show, {
      title: 'Summer 1975',
      photos: [media('p1', 'image'), media('p2', 'image'), media('p3', 'image')],
      music: media('song', 'audio'),
      seconds: 6,
      fade: 2,
      loop: true,
    });
    sound(show);
    expect(show.media).toHaveLength(4);
    const [p1, p2] = show.layers.filter((l) => l.kind === 'image');
    let s = run(show, [[0, { type: 'fireCue', cueId: built.cueIds[0]! }]]);
    expect(s.layers[p1!.id]!.opacity).toMatchObject({ to: 1, dur: 2000 });
    s = run(
      show,
      [
        [6000, { type: 'tick' }],
        [8000, { type: 'tick' }],
      ],
      s,
    );
    expect(s.layers[p2!.id]!.opacity.to).toBe(1);
    // The picture underneath goes once the new one covers it.
    expect(s.layers[p1!.id]!.opacity.to).toBe(0);
    const music = show.layers.find((l) => l.kind === 'audio')!;
    expect(s.layers[music.id]!.media!.playing).toBe(true);
    // Back to the start from the third picture: the pictures above the first dissolve away.
    const p3 = show.layers.filter((l) => l.kind === 'image')[2]!;
    s = run(
      show,
      [
        [20_000, { type: 'fireCue', cueId: built.cueIds[2]! }],
        [21_000, { type: 'fireCue', cueId: built.cueIds[0]! }],
      ],
      s,
    );
    expect(s.layers[p3.id]!.opacity.to).toBe(0);
  });

  it('a quiz question: the room scores when it is right, the quizmaster when it is wrong', () => {
    const show = createShow('Quiz night');
    const built = buildQuiz(show, {
      question: 'What is the capital of Wales?',
      options: ['Swansea', 'Cardiff', 'Bangor'],
      correct: 1,
      seconds: 20,
      points: 1,
    });
    sound(show);
    const room = show.vars.find((v) => v.name === 'room_score')!;
    const master = show.vars.find((v) => v.name === 'quizmaster_score')!;
    let s = run(show, [
      [0, { type: 'fireCue', cueId: built.cueIds[0]! }],
      [1000, { type: 'countVote', option: 2, amount: 5 }],
      [21_000, { type: 'tick' }],
    ]);
    expect(s.vars[room.id]).toBe(1);
    s = run(show, [[22_000, { type: 'fireCue', cueId: built.cueIds[1]! }]], s);
    expect(textOf(show, s, 'Quiz answer')).toBe('The answer: Cardiff');
    // A second question keeps the score and the layers, and a wrong room scores the quizmaster.
    const next = buildQuiz(show, {
      question: 'Two plus two?',
      options: ['Four', 'Five'],
      correct: 0,
      seconds: 10,
      points: 2,
    });
    sound(show);
    expect(show.vars.filter((v) => v.name === 'room_score')).toHaveLength(1);
    s = run(
      show,
      [
        [30_000, { type: 'fireCue', cueId: next.cueIds[0]! }],
        [31_000, { type: 'countVote', option: 2 }],
        [41_000, { type: 'tick' }],
      ],
      s,
    );
    expect(s.vars[master.id]).toBe(2);
    // Nobody answered: nobody scores, even after the question is edited.
    const third = buildQuiz(show, {
      question: 'Q?',
      options: ['A', 'B'],
      correct: 0,
      seconds: 5,
      points: 1,
    });
    const m = show.moments.find((x) => x.id === third.momentId)!;
    syncResultVars(show, m);
    expect(m.defaultResult).toBe('');
    const after = run(
      show,
      [
        [50_000, { type: 'fireCue', cueId: third.cueIds[0]! }],
        [56_000, { type: 'tick' }],
      ],
      s,
    );
    expect([after.vars[room.id], after.vars[master.id]]).toEqual([1, 2]);
  });

  it('a choice point sends the story to each option’s scene and says what was chosen', () => {
    const show = createShow('Adventure');
    const opener = show.cues[0]!;
    const built = buildChoice(show, {
      question: 'Which door?',
      options: [
        { label: 'The red door', to: { newScene: true } },
        { label: 'The green door', to: { newScene: true } },
      ],
      seconds: 15,
      cueId: opener.id,
      sayChoice: true,
    });
    sound(show);
    // New scenes come right after the vote's own.
    expect(show.scenes.map((s) => s.name)).toEqual(['Scene 1', 'The red door', 'The green door']);
    let s = run(show, [
      [0, { type: 'fireCue', cueId: opener.id }],
      [1000, { type: 'countVote', option: 2 }],
      [16_000, { type: 'tick' }],
    ]);
    const green = show.cues.find((c) => c.sceneId === built.sceneIds[1])!;
    expect(s.standby).toBe(green.id);
    s = run(show, [[17_000, { type: 'go' }]], s);
    const said = show.layers.find((l) => l.name.endsWith('you chose'))!;
    expect(s.layers[said.id]!.opacity.to).toBe(1);
    // A second vote with the same question says its own result, on its own layer.
    buildChoice(show, {
      question: 'Which door?',
      options: [
        { label: 'Up', to: { newScene: true } },
        { label: 'Down', to: { newScene: true } },
      ],
      seconds: 15,
      cueId: opener.id,
      sayChoice: true,
    });
    expect(show.moments.map((x) => x.name)).toEqual(['Which door', 'Which door 2']);
    const told = show.layers.filter((l) => l.name.endsWith('you chose'));
    expect(told).toHaveLength(2);
    expect(told[1]).toMatchObject({ text: 'You chose: {{which_door_2_winner}}' });
    sound(show);
  });
});
