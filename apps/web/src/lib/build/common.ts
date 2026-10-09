import {
  createCue,
  uid,
  type Action,
  type Cue,
  type Layer,
  type Output,
  type Scene,
  type Show,
  type TextLayer,
  type Var,
} from '@scrim/format';
import { syntheticLayer } from '../layers.js';

/**
 * Pieces the wizards build shows from (lib/build/*). Builders are pure: they change the show
 * they are given, the way an editor update does, and make only ordinary scenes, cues, layers,
 * values and rules, which stay editable afterwards.
 */

/** A box as fractions of the output: x, y, width, height. */
export type Area = [x: number, y: number, w: number, h: number];

/** The show's own fade, else a soft second. */
export const softFade = (show: Show) =>
  show.defaultFade ?? { duration: 1, easing: 'easeInOut' as const };

export function outputOf(show: Show, outputId?: string): Output {
  const out = show.outputs.find((o) => o.id === outputId) ?? show.outputs[0];
  if (!out) throw new Error('The show has no output to put this on');
  return out;
}

/** A new scene after the others, its name made unique ("Amazing Grace 2"). */
export function addScene(show: Show, name: string): Scene {
  let unique = name;
  for (let n = 2; show.scenes.some((s) => s.name === unique); n++) unique = `${name} ${n}`;
  const scene: Scene = { id: uid('scn'), name: unique };
  show.scenes.push(scene);
  return scene;
}

export function addCue(
  show: Show,
  sceneId: string,
  name: string,
  actions: Action[],
  extra: Partial<Cue> = {},
): Cue {
  const cue: Cue = { ...createCue(sceneId, name), actions, ...extra };
  show.cues.push(cue);
  return cue;
}

/** Fire the next cue `seconds` after this one. */
export const follows = (seconds: number): Pick<Cue, 'follow'> => ({
  follow: { auto: true, delay: seconds },
});

/**
 * A text layer of this name on the output, made if it isn't there, so a second song or notice
 * reuses the first one's lyrics or notice layer.
 */
export function textLayer(
  show: Show,
  output: Output,
  name: string,
  area: Area,
  style: Partial<TextLayer> = {},
): TextLayer {
  const found = show.layers.find(
    (l): l is TextLayer => l.kind === 'text' && l.name === name && l.outputId === output.id,
  );
  if (found) return found;
  const layer = syntheticLayer(show, output, 'text') as TextLayer;
  Object.assign(layer, {
    name,
    text: '',
    x: Math.round(area[0] * output.width),
    y: Math.round(area[1] * output.height),
    w: Math.round(area[2] * output.width),
    h: Math.round(area[3] * output.height),
    ...style,
  });
  show.layers.push(layer);
  return layer;
}

export function addLayer<L extends Layer>(show: Show, layer: L): L {
  show.layers.push(layer);
  return layer;
}

/** A number value of this name, made if it isn't there. */
export function numberVar(show: Show, name: string): Var {
  const found = show.vars.find((v) => v.name === name);
  if (found) return found;
  const v: Var = { id: uid('var'), name, type: 'number', initial: 0 };
  show.vars.push(v);
  return v;
}

export const fadeIn = (s: Show, layerId: string, extra: { delay?: number } = {}): Action => ({
  type: 'show',
  layerId,
  ...softFade(s),
  ...extra,
});

export const fadeOut = (s: Show, layerId: string, extra: { delay?: number } = {}): Action => ({
  type: 'hide',
  layerId,
  ...softFade(s),
  ...extra,
});

export const say = (layerId: string, text: string, delay?: number): Action => ({
  type: 'setText',
  layerId,
  text,
  ...(delay ? { delay } : {}),
});
