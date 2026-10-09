import { uid, type Action, type Show, type TextLayer } from '@scrim/format';
import { createResultVars, newMoment } from '../moments.js';
import { syntheticLayer } from '../layers.js';
import { addCue, addLayer, fadeIn, fadeOut, outputOf } from './common.js';

/** Where an option leads: a scene, a new scene named after it, or on to the next cue. */
export type ChoiceTarget = { sceneId: string } | { newScene: true } | null;

export interface ChoiceOptions {
  question: string;
  options: { label: string; to: ChoiceTarget }[];
  seconds: number;
  /** The cue that opens the vote; none: the moment waits for one. */
  cueId?: string;
  /** Say on stage what the room chose, as each scene it leads to begins. */
  sayChoice?: boolean;
  outputId?: string;
}

/**
 * A choice point for a choose-your-own-adventure: a vote on every phone, a rule per option that
 * sends the story to its scene (new scenes go right after the vote's own), and, if asked,
 * "You chose …" on stage as that scene begins.
 */
export function buildChoice(show: Show, opts: ChoiceOptions) {
  const m = newMoment('vote', show);
  const base = opts.question.length > 28 ? 'Audience vote' : opts.question.replace(/\?$/, '');
  m.name = base;
  for (let n = 2; show.moments.some((x) => x.name === m.name); n++) m.name = `${base} ${n}`;
  m.prompt = opts.question;
  m.durationSec = opts.seconds;
  m.options = opts.options.map((o, i) => ({ id: String.fromCharCode(97 + i), label: o.label }));
  m.defaultResult = m.options[0]!.id;
  createResultVars(show, m);
  show.moments.push(m);

  const opener = show.cues.find((c) => c.id === opts.cueId);
  opener?.actions.push({ type: 'openMoment', momentId: m.id });
  // New scenes go right after the vote's own scene, in option order.
  let at = opener ? show.scenes.findIndex((s) => s.id === opener.sceneId) + 1 : show.scenes.length;
  const targets = opts.options.map((o) => {
    if (!o.to) return null;
    if ('sceneId' in o.to) return o.to.sceneId;
    const scene = { id: uid('scn'), name: o.label };
    show.scenes.splice(at++, 0, scene);
    addCue(show, scene.id, o.label, []);
    return scene.id;
  });

  opts.options.forEach((o, i) => {
    const sceneId = targets[i];
    if (!sceneId) return;
    show.rules.push({
      id: uid('rul'),
      name: `${o.label} wins`,
      enabled: true,
      when: { type: 'momentClosed', momentId: m.id },
      if: [{ varId: m.resultVarId!, op: 'eq', value: m.options[i]!.id }],
      then: [{ type: 'jumpScene', sceneId, fire: false }],
    });
  });

  if (opts.sayChoice) {
    const output = outputOf(show, opts.outputId);
    const winner = show.vars.find((v) => v.id === m.resultVarId)!;
    // Its own layer: another vote's would show that vote's result.
    const said = addLayer(show, {
      ...(syntheticLayer(show, output, 'text') as TextLayer),
      name: `${m.name}: you chose`,
      text: `You chose: {{${winner.name}}}`,
      fontSize: Math.round(output.height / 16),
      x: Math.round(output.width * 0.1),
      y: Math.round(output.height * 0.78),
      w: Math.round(output.width * 0.8),
      h: Math.round(output.height * 0.12),
    });
    const tell: Action[] = [fadeIn(show, said.id), fadeOut(show, said.id, { delay: 5 })];
    for (const sceneId of new Set(targets.filter((t): t is string => !!t))) {
      const first = show.cues.find((c) => c.sceneId === sceneId);
      if (first) first.actions.unshift(...structuredClone(tell));
    }
  }
  return { momentId: m.id, sceneIds: targets };
}
