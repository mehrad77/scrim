import { effectiveOpacity, initialState, nextWakeup, step, type EngineState } from '@scrim/engine';
import {
  ancestorsOf,
  cueOrder,
  layerTree,
  type Layer,
  type LayerTree,
  type Show,
} from '@scrim/format';

/**
 * The flash-safety check: a design aid, not a certified test. WCAG 2.3.1 allows no more than
 * three flashes in any one second. Scrim plays each cue, and the cues it sets off, the way the
 * engine would, sampling 60 times a second how much of each output is lit, and counts the large
 * swings. It checks the ordinary performance, not a relaxed one. It reads fades, follows and
 * delays only: it can't see flashing inside video or pictures, which count as fully bright.
 */

/** Flashes allowed in any one second (WCAG 2.3.1). */
export const MAX_FLASHES = 3;
/** A quarter of an output going from dark to lit, or back, is one half of a flash. */
const SWING = 0.25;
const FRAME_MS = 1000 / 60;
/** How long after a GO the check follows a cue and what it sets off. */
const WINDOW_MS = 5000;
const START = 1_000_000;

export interface FlashIssue {
  cueId: string;
  outputId: string;
  /** The most flashes in any one second. */
  flashes: number;
  /** Seconds after the cue's GO that second starts. */
  at: number;
}

const cache = new WeakMap<Show, FlashIssue[]>();
/** The last result, by what it depends on: most edits (moving a layer, typing) don't change it. */
let last: { key: string; issues: FlashIssue[] } | null = null;

/** Cues that flash an output more than three times a second, once per run of cues. */
export function checkFlashes(show: Show): FlashIssue[] {
  const known = cache.get(show);
  if (known) return known;
  const key = dependsOn(show);
  if (last?.key !== key) last = { key, issues: findFlashes(show) };
  cache.set(show, last.issues);
  return last.issues;
}

/** Everything the result depends on, and nothing else (names, text, positions, fonts). */
function dependsOn(show: Show): string {
  return JSON.stringify([
    show.outputs.map((o) => [o.id, o.width, o.height, o.background]),
    show.layers.map((l) => [
      l.id,
      l.kind,
      l.outputId,
      l.parentId,
      l.opacity,
      l.visible,
      l.w,
      l.h,
      l.crop,
      'fill' in l ? l.fill : null,
      'background' in l ? l.background : null,
    ]),
    show.scenes.map((sc) => sc.id),
    show.cues.map((c) => [c.id, c.sceneId, c.actions, c.follow, c.section]),
    show.rules,
    show.vars,
    show.moments.map((m) => [m.id, m.durationSec, m.options, m.defaultResult, m.resultVarId]),
  ]);
}

function findFlashes(source: Show): FlashIssue[] {
  // The ordinary performance: a show that starts relaxed is checked as it runs without it.
  const show: Show = { ...source, relaxed: { ...source.relaxed, default: false } };
  const tree = layerTree(show.layers);
  const lights = show.outputs.map((o) => ({
    id: o.id,
    layers: show.layers.flatMap((l) => {
      const share = l.outputId === o.id ? lit(l, show) : 0;
      // A layer moves when it or any frame around it is fading.
      const chain = [l.id, ...ancestorsOf(tree, l.id).map((f) => f.id)];
      return share > 0 ? [{ id: l.id, share, chain }] : [];
    }),
  }));
  const issues: FlashIssue[] = [];
  // A cue another flagged cue already set off is part of that one's flashing.
  const covered = new Set<string>();
  if (lights.some((o) => o.layers.length))
    for (const cue of cueOrder(show)) {
      if (covered.has(cue.id)) continue;
      const { samples, fired } = play(show, tree, lights, cue.id);
      let flagged = false;
      for (const o of lights) {
        const worst = mostFlashes(samples.get(o.id) ?? []);
        if (worst.flashes > MAX_FLASHES) {
          issues.push({ cueId: cue.id, outputId: o.id, ...worst });
          flagged = true;
        }
      }
      if (flagged) for (const id of fired) covered.add(id);
    }
  return issues;
}

/**
 * How much of an output a layer lights when fully shown, 0 to 1: its share of the output's area,
 * times how far its colour is from the output's background. Pictures and video count as fully
 * bright; text counts only its background, since thin letters light little.
 */
function lit(layer: Layer, show: Show): number {
  const out = show.outputs.find((o) => o.id === layer.outputId);
  if (!out) return 0;
  // A see-through colour lights only as much as it covers the background.
  const contrast = (colour: string) => {
    const a = paint(colour);
    const b = paint(out.background);
    return !a ? 1 : a.alpha * (b ? Math.abs(a.l - b.l) : 1);
  };
  const strength =
    layer.kind === 'image' || layer.kind === 'video'
      ? 1
      : layer.kind === 'frame'
        ? contrast(layer.fill)
        : layer.kind === 'text' || layer.kind === 'counter' || layer.kind === 'state'
          ? contrast(layer.background)
          : 0;
  const c = layer.crop;
  const w = Math.min(layer.w, out.width) * Math.max(0, 1 - c.left - c.right);
  const h = Math.min(layer.h, out.height) * Math.max(0, 1 - c.top - c.bottom);
  return strength * ((w * h) / (out.width * out.height));
}

/** Relative luminance of a colour; null when it can't be read. */
export function luminance(colour: string): number | null {
  return paint(colour)?.l ?? null;
}

/**
 * A colour's relative luminance and opacity: #rgb, #rrggbb, rgb(), rgba() or transparent; null
 * when it can't be read (a named colour), which then counts as fully bright.
 */
function paint(colour: string): { l: number; alpha: number } | null {
  const c = colour.trim().toLowerCase();
  if (c === 'transparent' || c === 'none') return { l: 0, alpha: 0 };
  let rgb: number[];
  let alpha = 1;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(c)?.[1];
  const fn = /^rgba?\(([^)]*)\)$/.exec(c)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((x) => x + x).join('') : hex;
    rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  } else if (fn) {
    const parts = fn
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
    rgb = parts.slice(0, 3);
    alpha = Math.min(1, Math.max(0, parts[3] ?? 1));
  } else return null;
  const [r, g, b] = rgb.map((n) => {
    const v = Math.min(255, Math.max(0, n)) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return { l: 0.2126 * r! + 0.7152 * g! + 0.0722 * b!, alpha };
}

type Lights = { id: string; layers: { id: string; share: number; chain: string[] }[] }[];

/** Put a cue on standby and press GO, then follow the engine for a few seconds. */
function play(
  show: Show,
  tree: LayerTree,
  lights: Lights,
  cueId: string,
): { samples: Map<string, { t: number; v: number }[]>; fired: Set<string> } {
  const samples = new Map(lights.map((o) => [o.id, [] as { t: number; v: number }[]]));
  const fired = new Set<string>();
  const lightAt = (state: EngineState, t: number, layers: Lights[number]['layers']) =>
    layers.reduce((v, l) => v + l.share * effectiveOpacity(tree, state, l.id, t), 0);
  const run = (state: EngineState, input: Parameters<typeof step>[2], t: number) => {
    const r = step(show, state, input, t);
    for (const e of r.events) if (e.type === 'cueFired') fired.add(e.cueId);
    return r.state;
  };

  let t = START;
  let state = run(initialState(show, false), { type: 'standby', cueId }, t);
  state = run(state, { type: 'go' }, t);
  const end = START + WINDOW_MS;
  for (let guard = 0; guard < 2000; guard++) {
    const wake = nextWakeup(state) ?? Infinity;
    const until = Math.min(wake, end);
    // Between wakeups only fades move: sample while one runs, then once is enough. Layers that
    // aren't fading add the same light every frame, so they are summed once.
    const ends = (id: string) => {
      const o = state.layers[id]?.opacity;
      return o ? o.t0 + o.dur : 0;
    };
    const stop = Math.min(until, Math.max(t, ...Object.keys(state.layers).map(ends)));
    for (const o of lights) {
      const moving = o.layers.filter((l) => l.chain.some((id) => ends(id) > t));
      const still = lightAt(
        state,
        t,
        o.layers.filter((l) => !moving.includes(l)),
      );
      const out = samples.get(o.id)!;
      for (let s = t; s < stop; s += FRAME_MS)
        out.push({ t: s, v: Math.min(1, still + lightAt(state, s, moving)) });
      out.push({ t: stop, v: Math.min(1, still + lightAt(state, stop, moving)) });
    }
    if (wake > end) break;
    t = Math.max(t, wake);
    state = run(state, { type: 'tick' }, t);
  }
  return { samples, fired };
}

/** The most flashes in any one second: each pair of opposite swings is one flash. */
function mostFlashes(samples: { t: number; v: number }[]): { flashes: number; at: number } {
  const swings: number[] = [];
  let dir = 0;
  let lo = samples[0]?.v ?? 0;
  let hi = lo;
  for (const { t, v } of samples) {
    if (dir >= 0 && v > hi) hi = v;
    if (dir <= 0 && v < lo) lo = v;
    if (dir >= 0 && hi - v >= SWING) {
      swings.push(t);
      dir = -1;
      lo = v;
    } else if (dir <= 0 && v - lo >= SWING) {
      swings.push(t);
      dir = 1;
      hi = v;
    }
  }
  let best = { flashes: 0, at: 0 };
  for (let i = 0, j = 0; i < swings.length; i++) {
    while (j < swings.length && swings[j]! - swings[i]! < 1000) j++;
    const flashes = Math.floor((j - i) / 2);
    if (flashes > best.flashes) best = { flashes, at: (swings[i]! - START) / 1000 };
  }
  return best;
}
