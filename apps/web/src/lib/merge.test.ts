import { createShow, cueOrder, parseShow, type Show } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import { buildChoice } from './build/choice.js';
import { buildQuiz } from './build/quiz.js';
import { buildSong } from './build/song.js';
import { checkLogic } from './logic.js';
import { freshIds, importScenes } from './merge.js';
import { newSong } from './songs.js';

/** Every id in the show, in one list, so duplicates show. */
const allIds = (show: Show) =>
  [
    ...show.scenes,
    ...show.cues,
    ...show.layers,
    ...show.moments,
    ...show.vars,
    ...show.triggers,
    ...show.rules,
  ].map((x) => x.id);

function quizShow(): Show {
  const show = createShow('Quiz');
  buildQuiz(show, {
    question: 'Capital of Wales?',
    options: ['Swansea', 'Cardiff'],
    correct: 1,
    seconds: 20,
    points: 1,
  });
  return show;
}

describe('importing scenes', () => {
  it('brings a scene and everything its cues use, with new ids and no clashes', () => {
    const source = quizShow();
    const target = quizShow();
    const scene = source.scenes.find((s) => s.name === 'Question 1')!;
    const result = importScenes(target, source, { sceneIds: [scene.id] });
    expect(result).toMatchObject({ scenes: 1, cues: 3, dropped: 0 });
    expect(() => parseShow(structuredClone(target))).not.toThrow();
    const ids = allIds(target);
    expect(new Set(ids).size).toBe(ids.length);
    expect(target.scenes.map((s) => s.name)).toEqual(['Scene 1', 'Question 1', 'Question 1']);
    // Its moment, the two scores and their rules came too; the taken names got a number…
    expect(target.moments).toHaveLength(2);
    expect(target.vars.map((v) => v.name)).toContain('room_score_2');
    // …and the score on stage shows the imported ones.
    const score = target.layers.filter((l) => l.name === 'Quiz score');
    expect(score[1]).toMatchObject({
      text: 'Room {{room_score_2}} · Quizmaster {{quizmaster_score_2}}',
    });
    expect(checkLogic(target).map((i) => i.text)).toEqual([]);
  });

  it('puts imported layers on top, on the chosen output, and leaves jumps elsewhere to repoint', () => {
    const source = createShow('Adventure');
    buildChoice(source, {
      question: 'Which door?',
      options: [
        { label: 'Red', to: { newScene: true } },
        { label: 'Green', to: { newScene: true } },
      ],
      seconds: 15,
      cueId: source.cues[0]!.id,
      sayChoice: true,
    });
    // The vote's scene also shows a layer, which must come along.
    const said = source.layers.find((l) => l.name.endsWith('you chose'))!;
    source.cues[0]!.actions.push({ type: 'show', layerId: said.id, duration: 1, easing: 'linear' });
    const target = createShow('Mine');
    buildSong(target, newSong('Hymn', 'One line'));
    const before = Math.max(...target.layers.map((l) => l.z));
    const result = importScenes(target, source, {
      sceneIds: [source.scenes[0]!.id],
      outputMap: { [source.outputs[0]!.id]: target.outputs[0]!.id },
    });
    // The two rules point at scenes that stayed behind.
    expect(result.dropped).toBe(2);
    expect(
      checkLogic(target).filter((i) => i.text.includes('a scene that was deleted')),
    ).toHaveLength(2);
    const added = target.layers.slice(-1)[0]!;
    expect(added.outputId).toBe(target.outputs[0]!.id);
    expect(added.z).toBeGreaterThan(before);
  });
});

describe('importing onto another size', () => {
  it('keeps a pinned layer by its edges on a smaller output', () => {
    const source = quizShow();
    const score = source.layers.find((l) => l.name === 'Quiz score')!;
    score.pin = { x: 'right', y: 'bottom' };
    const target = createShow('Small');
    target.outputs[0] = { ...target.outputs[0]!, width: 1280, height: 720 };
    importScenes(target, source, { sceneIds: [source.scenes[1]!.id] });
    const moved = target.layers.find((l) => l.name === 'Quiz score')!;
    expect(moved.x).toBe(score.x - 640);
    expect(moved.y).toBe(score.y - 360);
  });
});

describe('fresh ids', () => {
  it('gives a show made from a template ids of its own, keeping every link', () => {
    const template = quizShow();
    template.inputs.keys.push({
      key: 'KeyQ',
      command: {
        type: 'jump',
        target: { to: 'scene', sceneId: template.scenes[1]!.id },
        fire: false,
      },
    });
    template.setlists = [{ id: 'set_a', name: 'All', scenes: template.scenes.map((s) => s.id) }];
    const copy = freshIds(template);
    const old = new Set([...allIds(template), ...template.outputs.map((o) => o.id)]);
    expect([...allIds(copy), ...copy.outputs.map((o) => o.id)].some((id) => old.has(id))).toBe(
      false,
    );
    expect(checkLogic(copy)).toEqual(
      checkLogic(template).map((i) => expect.objectContaining({ text: i.text })),
    );
    const jump = copy.inputs.keys.at(-1)!.command;
    expect(jump).toMatchObject({ target: { sceneId: copy.scenes[1]!.id } });
    expect(copy.setlists![0]!.scenes).toEqual(copy.scenes.map((s) => s.id));
    expect(cueOrder(copy).map((c) => c.name)).toEqual(cueOrder(template).map((c) => c.name));
    expect(
      copy.layers.every(
        (l) => l.outputId === null || copy.outputs.some((o) => o.id === l.outputId),
      ),
    ).toBe(true);
  });
});
