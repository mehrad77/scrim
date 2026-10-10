import {
  uid,
  type Action,
  type Condition,
  type Rule,
  type AudioLayer,
  type Easing,
  type FrameLayer,
  type FrameLayout,
  type ImageLayer,
  type Media,
  type Output,
  type Show,
  type StateLayer,
  type TextLayer,
  type VideoLayer,
} from '@scrim/format';
import { colorCss, parseColor } from '../lib/fill.js';
import { putInFrame } from '../lib/frames.js';
import { layerForMedia, syntheticLayer } from '../lib/layers.js';
import { blankShow } from '../lib/starters.js';
import { fontFamilyOf } from '../render/useShowFonts.js';
import type { TemplateMedia } from './types.js';

/**
 * The grid every template is laid out on (docs/templates.md › The visual bar): a 1920 × 1080
 * stage, title-safe margins of 5%, twelve columns, and spacing in steps of 8 px.
 */
export const W = 1920;
export const H = 1080;
export const MX = 96;
export const MY = 56;
export const GUTTER = 24;
export const COLS = 12;
export const COL = (W - 2 * MX - (COLS - 1) * GUTTER) / COLS;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL: Box = { x: 0, y: 0, w: W, h: H };
export const SAFE: Box = { x: MX, y: MY, w: W - 2 * MX, h: H - 2 * MY };

/** Columns `from` (1-based) to `from + span - 1`, from `y` down `h`. */
export function cols(from: number, span: number, y: number, h: number): Box {
  return {
    x: Math.round(MX + (from - 1) * (COL + GUTTER)),
    y,
    w: Math.round(span * COL + (span - 1) * GUTTER),
    h,
  };
}

/**
 * A new show for a template: this machine's GO and Hold keys (lib/starters.ts), one 1920 × 1080
 * output, and no scenes yet; the template makes its own.
 */
export function startShow(title: string): Show {
  const show = blankShow(title);
  show.scenes = [];
  show.cues = [];
  return show;
}

/** What a template builds on: the show and its one output. */
export interface Kit {
  show: Show;
  out: Output;
}

export function kit(show: Show): Kit {
  const out = show.outputs[0];
  if (!out) throw new Error('A template needs an output');
  return { show, out };
}

/** Put every fetched file in the show, fonts included, so the show carries them. */
export function addMedia(show: Show, media: TemplateMedia): void {
  for (const m of Object.values(media))
    if (!show.media.some((x) => x.id === m.id)) show.media.push(m);
}

/** The CSS family for a font the template carries, as the inspector writes it. */
export const family = (font: Media) => `"${fontFamilyOf(font)}"`;

/** A face: a font with its weight and finish, set at a size and colour by `type`. */
export interface Face {
  font: Media;
  weight: number;
  italic?: boolean;
  uppercase?: boolean;
  /** In ems. */
  letterSpacing?: number;
  lineHeight?: number;
}

/** The style fields every kind of text layer shares. */
export type TypeStyle = Partial<
  Pick<
    TextLayer,
    | 'fontFamily'
    | 'fontWeight'
    | 'fontSize'
    | 'color'
    | 'italic'
    | 'uppercase'
    | 'letterSpacing'
    | 'lineHeight'
  >
>;

export function type(face: Face, size: number, color: string): TypeStyle {
  return {
    fontFamily: family(face.font),
    fontWeight: face.weight,
    fontSize: size,
    color,
    ...(face.italic ? { italic: true } : {}),
    ...(face.uppercase ? { uppercase: true } : {}),
    ...(face.letterSpacing ? { letterSpacing: face.letterSpacing } : {}),
    ...(face.lineHeight ? { lineHeight: face.lineHeight } : {}),
  };
}

/** A picture or video filling `box` (the whole stage by default), hidden until a cue shows it. */
export function picture(
  k: Kit,
  media: Media,
  name: string,
  box: Box = FULL,
  extra: Partial<Pick<VideoLayer, 'loop' | 'volume' | 'fit' | 'crop' | 'intense' | 'z'>> = {},
): ImageLayer | VideoLayer {
  const layer = layerForMedia(k.show, k.out, media) as ImageLayer | VideoLayer;
  Object.assign(layer, { name, ...box, fit: 'cover' }, extra);
  if (layer.kind === 'video') Object.assign(layer, { volume: 0, ...extra });
  k.show.layers.push(layer);
  return layer;
}

export function sound(
  k: Kit,
  media: Media,
  name: string,
  extra: Partial<AudioLayer> = {},
): AudioLayer {
  const layer = layerForMedia(k.show, undefined, media) as AudioLayer;
  Object.assign(layer, { name, volume: 0.8 }, extra);
  k.show.layers.push(layer);
  return layer;
}

/** A text layer in `box`. */
export function words(
  k: Kit,
  name: string,
  box: Box,
  text: string,
  style: Partial<TextLayer>,
): TextLayer {
  const layer = syntheticLayer(k.show, k.out, 'text') as TextLayer;
  Object.assign(layer, { name, text, ...box, background: 'transparent' }, style);
  k.show.layers.push(layer);
  return layer;
}

/**
 * A frame: a coloured or gradient panel that holds other layers and fades with them. Hidden
 * until a cue shows it; what goes in it (`place`) is visible, so showing the frame shows all.
 */
export function panel(
  k: Kit,
  name: string,
  box: Box,
  fill: string,
  extra: { radius?: number; layout?: Partial<FrameLayout>; clip?: boolean } = {},
): FrameLayer {
  const layer = syntheticLayer(k.show, k.out, 'frame') as FrameLayer;
  Object.assign(layer, {
    name,
    ...box,
    fill,
    visible: false,
    radius: extra.radius ?? 0,
    clip: extra.clip ?? false,
    layout: {
      mode: 'free',
      gap: 0,
      padX: 0,
      padY: 0,
      align: 'center',
      justify: 'start',
      hugW: false,
      hugH: false,
      ...extra.layout,
    },
  });
  k.show.layers.push(layer);
  return layer;
}

/** Put a layer in a frame. In a free frame, `at` places it relative to the frame's corner. */
export function place<L extends { id: string; x: number; y: number }>(
  k: Kit,
  frame: FrameLayer,
  layer: L,
  at?: { x: number; y: number },
): L {
  putInFrame(k.show, layer as never, frame.id);
  if (at) Object.assign(layer, at);
  return layer;
}

/**
 * A gradient that darkens one side of the stage so words read over a picture: the template's
 * "scrim". `reach` is how far in it goes, as a fraction of the stage.
 */
export function scrim(
  k: Kit,
  name: string,
  side: 'top' | 'bottom' | 'left' | 'right' | 'all',
  color: string,
  opts: { reach?: number; strength?: number } = {},
): FrameLayer {
  const reach = opts.reach ?? 0.6;
  const strength = opts.strength ?? 0.8;
  const hex = parseColor(color)?.hex ?? '#000000';
  const solid = colorCss({ hex, alpha: strength });
  const clear = colorCss({ hex, alpha: 0 });
  const angle = { top: 0, bottom: 180, left: 270, right: 90, all: 180 }[side];
  const box: Box =
    side === 'all'
      ? FULL
      : side === 'top'
        ? { x: 0, y: 0, w: W, h: Math.round(H * reach) }
        : side === 'bottom'
          ? { x: 0, y: Math.round(H * (1 - reach)), w: W, h: Math.round(H * reach) }
          : side === 'left'
            ? { x: 0, y: 0, w: Math.round(W * reach), h: H }
            : { x: Math.round(W * (1 - reach)), y: 0, w: Math.round(W * reach), h: H };
  // Toward the side it darkens: the gradient runs from clear to solid.
  const fill =
    side === 'all' ? solid : `linear-gradient(${(angle + 180) % 360}deg, ${solid}, ${clear})`;
  return panel(k, `Scrim · ${name}`, box, fill);
}

/** Fade a layer in or out over `seconds`, after `delay`. */
export function fade(
  layerId: string,
  on: boolean,
  seconds: number,
  delay?: number,
  easing: Easing = 'easeInOut',
): Action {
  return {
    type: on ? 'show' : 'hide',
    layerId,
    duration: seconds,
    easing,
    ...(delay ? { delay } : {}),
  } as Action;
}

export const play = (layerId: string, extra: { delay?: number; restart?: boolean } = {}): Action =>
  ({ type: 'play', layerId, restart: false, ...extra }) as Action;

/** A when / if / then rule. */
export function rule(
  show: Show,
  name: string,
  when: Rule['when'],
  conditions: Condition[],
  then: Action[],
): Rule {
  const r: Rule = { id: uid('rul'), name, enabled: true, when, if: conditions, then };
  show.rules.push(r);
  return r;
}

/** A sound effect, from the top, at full level. */
export const sfx = (layerId: string): Action[] => [
  fade(layerId, true, 0),
  play(layerId, { restart: true }),
];

/** Music fading up from the start over `seconds`. */
export const musicIn = (layerId: string, seconds = 2): Action[] => [
  play(layerId, { restart: true }),
  fade(layerId, true, seconds),
];

/** Music fading away over `seconds`, then stopped. */
export const musicOut = (layerId: string, seconds = 3): Action[] => [
  fade(layerId, false, seconds),
  { type: 'pause', layerId, delay: seconds } as Action,
];

/**
 * How to join from the stage: a QR code of the audience page on a light tile, with the room
 * code under it. Both are empty until the operator opens the audience room.
 */
export function joinCard(
  k: Kit,
  name: string,
  box: Box,
  opts: { ink: string; paper: string; codeFace: Face; codeSize?: number; radius?: number },
): FrameLayer {
  const tile = panel(k, name, box, opts.paper, { radius: opts.radius ?? 24 });
  const pad = Math.round(box.w * 0.08);
  const qrSize = box.w - pad * 2;
  const codeSize = opts.codeSize ?? Math.round(box.w * 0.16);
  place(
    k,
    tile,
    words(k, `${name} · QR`, { x: 0, y: 0, w: qrSize, h: qrSize }, '{{join_url}}', {
      qr: true,
      color: opts.ink,
      background: opts.paper,
    }),
    { x: pad, y: pad },
  );
  place(
    k,
    tile,
    words(
      k,
      `${name} · code`,
      { x: 0, y: 0, w: box.w - pad * 2, h: Math.round(codeSize * 1.3) },
      '{{join_code}}',
      { ...type(opts.codeFace, codeSize, opts.ink), letterSpacing: 0.12 },
    ),
    { x: pad, y: pad + qrSize + Math.round(pad * 0.4) },
  );
  return tile;
}

/** A layer that shows a value live: a score, a count, a list. */
export function valueLayer(
  k: Kit,
  name: string,
  box: Box,
  varId: string,
  style: Partial<StateLayer>,
): StateLayer {
  const layer = syntheticLayer(k.show, k.out, 'state') as StateLayer;
  Object.assign(layer, { name, ...box, varId, display: 'value', background: 'transparent' }, style);
  k.show.layers.push(layer);
  return layer;
}

/** The title-safe width, for text centred across the stage. */
export const across = (y: number, h: number): Box => ({ x: MX, y, w: W - 2 * MX, h });

/**
 * A plate: a panel with a hard offset shadow under it, the way a printed poster sits on a wall.
 * Fade `outer`; put words in `paper`. `box` is the paper's place; the shadow falls beyond it.
 */
export function plate(
  k: Kit,
  name: string,
  box: Box,
  fill: string,
  opts: { radius?: number; shadow?: string; offset?: number } = {},
): { outer: FrameLayer; paper: FrameLayer } {
  const offset = opts.offset ?? 14;
  const outer = panel(k, name, { ...box, w: box.w + offset, h: box.h + offset }, 'transparent');
  const shadow = panel(
    k,
    `${name} · shadow`,
    { x: 0, y: 0, w: box.w, h: box.h },
    opts.shadow ?? 'rgba(20, 12, 4, 0.45)',
    {
      radius: opts.radius ?? 18,
    },
  );
  place(k, outer, shadow, { x: offset, y: offset });
  const paper = panel(k, `${name} · paper`, { x: 0, y: 0, w: box.w, h: box.h }, fill, {
    radius: opts.radius ?? 18,
  });
  place(k, outer, paper, { x: 0, y: 0 });
  return { outer, paper };
}
