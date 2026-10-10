import { uid, type CounterLayer, type Show, type StateLayer } from '@scrim/format';
import { syntheticLayer } from '../layers.js';
import { createResultVars, newMoment } from '../moments.js';
import {
  addCue,
  addLayer,
  addScene,
  fadeIn,
  fadeOut,
  numberVar,
  outputOf,
  say,
  textLayer,
} from './common.js';

export interface QuizOptions {
  question: string;
  /** 2 to 6 answers; phones show them, and the stage numbers them for buttons and hands. */
  options: string[];
  /** Which answer is right, from 0. */
  correct: number;
  seconds: number;
  points: number;
  outputId?: string;
}

export const ROOM_SCORE = 'room_score';
export const QUIZMASTER_SCORE = 'quizmaster_score';
/**
 * The room's score less the quizmaster's. Rules can't compare two values, so a show that wants
 * to name the winner keeps this one (the quiz night template does); questions keep it up to
 * date when the show has it.
 */
export const QUIZ_LEAD = 'quiz_lead';

/**
 * One quiz question for a quiz night: the room plays against the quizmaster. The question and
 * numbered answers go up with a countdown while phones vote; when it closes, the room's answer
 * scores for the room if it is right and for the quizmaster if not. Reveal shows how the room
 * voted and the right answer; the score stays on stage.
 */
export function buildQuiz(show: Show, opts: QuizOptions) {
  const output = outputOf(show, opts.outputId);
  const room = numberVar(show, ROOM_SCORE);
  const master = numberVar(show, QUIZMASTER_SCORE);
  const lead = show.vars.find((v) => v.name === QUIZ_LEAD);
  const n = show.scenes.filter((s) => /^Question \d+$/.test(s.name)).length + 1;

  const m = newMoment('vote', show);
  m.name = `Question ${n}`;
  m.prompt = opts.question;
  m.durationSec = opts.seconds;
  m.options = opts.options.map((label, i) => ({ id: String.fromCharCode(97 + i), label }));
  // Nobody answered: nobody scores.
  m.defaultResult = '';
  createResultVars(show, m);
  show.moments.push(m);
  m.options.forEach((o, i) => {
    const right = i === opts.correct;
    show.rules.push({
      id: uid('rul'),
      name: right ? `${m.name}: the room is right` : `${m.name}: “${o.label}” is wrong`,
      enabled: true,
      when: { type: 'momentClosed', momentId: m.id },
      if: [{ varId: m.resultVarId!, op: 'eq', value: o.id }],
      then: [
        { type: 'addVar', varId: right ? room.id : master.id, amount: opts.points },
        ...(lead
          ? [
              {
                type: 'addVar' as const,
                varId: lead.id,
                amount: right ? opts.points : -opts.points,
              },
            ]
          : []),
      ],
    });
  });

  const question = textLayer(show, output, 'Quiz question', [0.06, 0.06, 0.88, 0.22], {
    fontSize: Math.round(output.height / 14),
    fontWeight: 700,
  });
  const answers = textLayer(show, output, 'Quiz answers', [0.12, 0.32, 0.76, 0.42], {
    fontSize: Math.round(output.height / 20),
    align: 'left',
  });
  const reveal = textLayer(show, output, 'Quiz answer', [0.1, 0.76, 0.8, 0.1], {
    fontSize: Math.round(output.height / 18),
  });
  const score = textLayer(show, output, 'Quiz score', [0.05, 0.9, 0.9, 0.07], {
    fontSize: Math.round(output.height / 28),
    fontWeight: 500,
    text: `Room {{${room.name}}} · Quizmaster {{${master.name}}}`,
  });
  const clock =
    show.layers.find(
      (l): l is CounterLayer => l.kind === 'counter' && l.name === 'Quiz countdown',
    ) ??
    addLayer(show, {
      ...(syntheticLayer(show, output, 'countdown') as CounterLayer),
      name: 'Quiz countdown',
      x: Math.round(output.width * 0.8),
      y: Math.round(output.height * 0.04),
      w: Math.round(output.width * 0.16),
      h: Math.round(output.height * 0.12),
      fontSize: Math.round(output.height / 12),
    });
  // The bars go where the answers are, in the same frame, looking like the last question's.
  const before = show.layers.findLast(
    (l): l is StateLayer => l.kind === 'state' && l.display === 'bars' && / votes$/.test(l.name),
  );
  const bars = addLayer<StateLayer>(show, {
    ...(syntheticLayer(show, output, 'state') as StateLayer),
    ...(before
      ? {
          fontFamily: before.fontFamily,
          fontSize: before.fontSize,
          fontWeight: before.fontWeight,
          color: before.color,
          z: before.z,
        }
      : {}),
    name: `${m.name} votes`,
    varId: m.tallyVarId!,
    display: 'bars',
    ...(answers.parentId ? { parentId: answers.parentId } : {}),
    x: answers.x,
    y: answers.y,
    w: answers.w,
    h: answers.h,
  });

  const scene = addScene(show, m.name);
  const right = m.options[opts.correct]!;
  const asked = addCue(
    show,
    scene.id,
    m.name,
    [
      say(question.id, opts.question),
      say(answers.id, m.options.map((o, i) => `${i + 1}   ${o.label}`).join('\n')),
      fadeIn(show, question.id),
      fadeIn(show, answers.id),
      fadeIn(show, score.id),
      { type: 'counter', layerId: clock.id, op: 'reset', value: opts.seconds },
      { type: 'counter', layerId: clock.id, op: 'start' },
      fadeIn(show, clock.id),
      { type: 'openMoment', momentId: m.id },
    ],
    { access: { caption: opts.question } },
  );
  const shown = addCue(
    show,
    scene.id,
    'Reveal',
    [
      // GO before the countdown ends closes the vote here, so nobody scores after the answer.
      { type: 'closeMoment', momentId: m.id },
      fadeOut(show, clock.id),
      fadeOut(show, answers.id),
      fadeIn(show, bars.id),
      say(reveal.id, `The answer: ${right.label}`),
      fadeIn(show, reveal.id),
    ],
    { access: { caption: `The answer: ${right.label}` } },
  );
  const cleared = addCue(show, scene.id, 'Clear', [
    fadeOut(show, question.id),
    fadeOut(show, bars.id),
    fadeOut(show, reveal.id),
  ]);
  return { sceneId: scene.id, momentId: m.id, cueIds: [asked.id, shown.id, cleared.id] };
}
