import { initialState, isIntense, nextWakeup, step, type EngineState } from '@scrim/engine';
import { layerTree, parseShow, type Layer, type Show, type TextLayer } from '@scrim/format';
import { parseColor, parseFill } from '../lib/fill.js';
import { checkLogic } from '../lib/logic.js';
import { tryOutcomes } from '../lib/simulate.js';
import { fontFamilyOf } from '../render/useShowFonts.js';
import { SAFE, type Box } from './layout.js';
import type { TemplateMedia, TemplateSeed } from './types.js';

/**
 * Everything a template must be before it ships (docs/templates.md), as plain-language
 * problems. templates.test.ts runs it on every seed; an empty list means it passes.
 */
export function checkTemplate(seed: TemplateSeed, media: TemplateMedia): string[] {
  const show = seed.make(media);
  const problems: string[] = [];
  try {
    parseShow(structuredClone(show));
  } catch (e) {
    problems.push(`It doesn’t parse: ${(e as Error).message}`);
  }
  problems.push(...checkLogic(show).map((i) => `Logic check: ${i.text}`));
  problems.push(...branches(show, new Set(seed.games)), ...walk(show, false), ...walk(show, true));
  problems.push(...eager(show), ...hours(show));
  problems.push(...mediaUse(show, media), ...visual(seed, show));
  for (const name of seed.heroes ?? [])
    if (!show.cues.some((c) => c.name === name)) problems.push(`No hero cue named “${name}”`);
  return problems;
}

/** Every vote can be rehearsed both ways: each option is an outcome you can try. */
function branches(show: Show, games: Set<string>): string[] {
  return show.moments.flatMap((m) => {
    const outcomes = tryOutcomes(show, m.id);
    if (!outcomes.length) return [`“${m.name}” can’t be reached by pressing GO from the top`];
    const problems: string[] = [];
    for (const o of outcomes)
      if (!o.ran.length) problems.push(`In “${m.name}”, “${o.label}” makes nothing happen`);
    // What each answer leads to, beyond the moment's own result and tally.
    const own = new Set(
      [m.resultVarId, m.tallyVarId].flatMap((id) => {
        const v = id && show.vars.find((x) => x.id === id);
        return v ? [v.name] : [];
      }),
    );
    const leads = new Set(
      outcomes.map((o) =>
        JSON.stringify([o.standby?.name ?? null, o.changes.filter((c) => !own.has(c.name))]),
      ),
    );
    if (outcomes.length > 1 && leads.size < 2 && !games.has(m.name))
      problems.push(`Every answer to “${m.name}” leads to the same place`);
    return problems;
  });
}

/**
 * Run the show the way an operator would, every moment left to its default: GO, wait for
 * follows and timers, close what opens. Nothing may warn; relaxed, nothing intense may show.
 */
function walk(show: Show, relaxed: boolean): string[] {
  const problems = new Set<string>();
  const tree = layerTree(show.layers);
  const intense = show.layers.filter((l) => l.kind !== 'audio' && isIntense(show, l.id, tree));
  let state: EngineState = initialState(show, relaxed);
  let t = 1_000_000;
  const apply = (input: Parameters<typeof step>[2]) => {
    const r = step(show, state, input, t);
    state = r.state;
    for (const e of r.events) if (e.type === 'warning') problems.add(`Warning: ${e.message}`);
    if (!relaxed) for (const p of covered(show, tree, state)) problems.add(p);
    if (relaxed)
      for (const l of intense)
        if (shown(state, tree, l.id))
          problems.add(`Relaxed, the intense layer “${l.name}” still shows`);
  };
  for (let i = 0; i < 600 && state.fired < 250; i++) {
    const open = Object.entries(state.moments).find(([, m]) => m.status === 'open');
    const wake = nextWakeup(state);
    if (open) {
      t += 1000;
      apply({ type: 'closeMoment', momentId: open[0] });
    } else if (wake !== null && wake <= t + 120_000) {
      t = Math.max(t, wake);
      apply({ type: 'tick' });
    } else if (state.standby) {
      t += 1000;
      apply({ type: 'go' });
      // A performer's or visitor's button can come at any point: try each from here.
      if (!relaxed) for (const p of pressEach(show, tree, state, t)) problems.add(p);
    } else break;
  }
  const label = relaxed ? 'Relaxed, ' : '';
  if (state.fired === 0) problems.add(`${label}GO fires nothing`);
  return [...problems].map((p) => (relaxed && !p.startsWith('Relaxed') ? `${label}${p}` : p));
}

/** Each trigger pressed from this state: nothing may warn, and no words end up darkened. */
function pressEach(
  show: Show,
  tree: ReturnType<typeof layerTree>,
  state: EngineState,
  t: number,
): string[] {
  const out: string[] = [];
  for (const trg of show.triggers) {
    let s = step(show, state, { type: 'trigger', triggerId: trg.id }, t + 10).state;
    const events = [];
    for (let i = 0, at = t + 10; i < 40; i++) {
      const wake = nextWakeup(s);
      if (wake === null || wake > at + 30_000) break;
      at = Math.max(at, wake);
      const r = step(show, s, { type: 'tick' }, at);
      s = r.state;
      events.push(...r.events);
    }
    for (const e of events) if (e.type === 'warning') out.push(`After “${trg.name}”: ${e.message}`);
    out.push(...covered(show, tree, s).map((p) => `After “${trg.name}”: ${p}`));
  }
  return out;
}

/**
 * GO pressed straight through, without waiting for any audience moment to close. A moment still
 * open once the show is in another scene means its result will land somewhere it shouldn't.
 */
function eager(show: Show): string[] {
  const problems = new Set<string>();
  const openedIn = new Map<string, string>();
  for (const c of show.cues)
    for (const a of c.actions) if (a.type === 'openMoment') openedIn.set(a.momentId, c.sceneId);
  let state = initialState(show);
  let t = 1_000_000;
  for (let i = 0; i < 400 && state.standby && state.fired < 250; i++) {
    t += 1000;
    const r = step(show, state, { type: 'go' }, t);
    state = r.state;
    const fired = r.events.flatMap((e) => (e.type === 'cueFired' ? [e.cueId] : []));
    const scene = show.cues.find((c) => c.id === fired.at(-1))?.sceneId;
    for (const [id, m] of Object.entries(state.moments)) {
      const from = openedIn.get(id);
      if (m.status === 'open' && scene && from && scene !== from) {
        const name = show.moments.find((x) => x.id === id)?.name ?? id;
        const where = show.scenes.find((x) => x.id === scene)?.name ?? scene;
        problems.add(
          `“${name}” is still open when GO moves on to “${where}”: close it in its own scene`,
        );
      }
    }
  }
  return [...problems];
}

/** The day through each opening-hours boundary: each change of value must play cleanly. */
function hours(show: Show): string[] {
  const schedule = show.schedule;
  if (!schedule) return [];
  const problems = new Set<string>();
  const tree = layerTree(show.layers);
  const times = new Set<string>();
  for (const p of schedule.periods)
    for (const d of p.days)
      for (const m of [p.from, p.to, p.from + 10]) times.add(`${d}:${m % 1440}`);
  let state = initialState(show);
  let t = 1_000_000;
  let first = true;
  const sorted = [...times]
    .map((x) => x.split(':').map(Number) as [number, number])
    .sort((a, b) => a[0] * 1440 + a[1] - (b[0] * 1440 + b[1]));
  for (const [day, minute] of sorted) {
    t += 60_000;
    const run = (input: Parameters<typeof step>[2]) => {
      const r = step(show, state, input, t);
      state = r.state;
      for (const e of r.events)
        if (e.type === 'warning') problems.add(`At ${day}/${minute}: ${e.message}`);
    };
    run({ type: 'clock', day, minute, force: first });
    first = false;
    for (let i = 0; i < 40; i++) {
      const wake = nextWakeup(state);
      if (wake === null || wake > t + 30_000) break;
      t = Math.max(t, wake);
      run({ type: 'tick' });
    }
    for (const p of covered(show, tree, state)) problems.add(`At ${day}/${minute}: ${p}`);
    for (const p of pressEach(show, tree, state, t)) problems.add(`At ${day}/${minute}: ${p}`);
  }
  return [...problems];
}

/** On stage: it and every frame around it are heading to visible. */
function shown(state: EngineState, tree: ReturnType<typeof layerTree>, id: string): boolean {
  for (let l = tree.byId.get(id); l; l = tree.parent(l.id))
    if ((state.layers[l.id]?.opacity.to ?? 0) <= 0) return false;
  return true;
}

/** Words on stage that a scrim on stage is drawn over, darkening them. */
function covered(show: Show, tree: ReturnType<typeof layerTree>, state: EngineState): string[] {
  const scrims = show.layers.filter(
    (s) =>
      s.kind === 'frame' &&
      s.name.startsWith('Scrim') &&
      !tree.parent(s.id) &&
      shown(state, tree, s.id),
  );
  if (!scrims.length) return [];
  const out: string[] = [];
  for (const l of show.layers) {
    if (!(l.kind === 'text' || l.kind === 'counter' || l.kind === 'state')) continue;
    if (!shown(state, tree, l.id)) continue;
    let top: Layer = l;
    for (let p = tree.parent(l.id); p; p = tree.parent(p.id)) top = p;
    const box = absolute(show, l);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const over = scrims.find(
      (s) =>
        s.outputId === l.outputId &&
        s.z > top.z &&
        cx >= s.x &&
        cx <= s.x + s.w &&
        cy >= s.y &&
        cy <= s.y + s.h,
    );
    if (over) out.push(`“${l.name}” is under “${over.name}”, which darkens it`);
  }
  return out;
}

/** What the template fetched it uses, and what it uses it fetched. */
function mediaUse(show: Show, media: TemplateMedia): string[] {
  const problems: string[] = [];
  const texty = show.layers.filter((l) => 'fontFamily' in l) as Texty[];
  const families = new Set(texty.map((l) => firstFamily(l.fontFamily)));
  const italics = new Set(texty.filter((l) => l.italic).map((l) => firstFamily(l.fontFamily)));
  for (const [key, m] of Object.entries(media)) {
    if (!show.media.some((x) => x.id === m.id)) problems.push(`Asset “${key}” isn’t in the show`);
    const used =
      m.kind === 'font'
        ? families.has(fontFamilyOf(m)) || italics.has(fontFamilyOf(m).replace(/[-_ ]Italic$/i, ''))
        : show.layers.some((l) => 'mediaId' in l && l.mediaId === m.id);
    if (!used) problems.push(`Asset “${key}” is fetched but never used`);
  }
  for (const l of show.layers)
    if ('mediaId' in l && !show.media.some((m) => m.id === l.mediaId))
      problems.push(`“${l.name}” uses media that isn’t in the show`);
  return problems;
}

/** The family a CSS font stack asks for first, unquoted. */
const firstFamily = (stack: string) => stack.split(',')[0]!.replace(/["']/g, '').trim();

/** The smallest a wall label or credit line may be, in output pixels. */
export const LABEL_MIN = 32;

/** Average letter width, in ems, of mixed-case text in each family: for fitting text. */
const WIDTH: Record<string, number> = {
  Fraunces: 0.52,
  'Fraunces Italic': 0.5,
  'Atkinson Hyperlegible Next': 0.56,
  Anton: 0.42,
  Fredoka: 0.54,
  'Cormorant Garamond': 0.44,
  'Cormorant Garamond Italic': 0.42,
  'IBM Plex Sans': 0.53,
};

type Texty = Extract<Layer, { kind: 'text' | 'counter' | 'state' }>;

function visual(seed: TemplateSeed, show: Show): string[] {
  const problems: string[] = [];
  const tree = layerTree(show.layers);
  const labels = new Set(seed.visual.labels ?? []);
  const texty = show.layers.filter(
    (l): l is Texty => l.kind === 'text' || l.kind === 'counter' || l.kind === 'state',
  );
  for (const l of texty) {
    const qr = l.kind === 'text' && !!l.qr;
    const min = labels.has(l.name) ? LABEL_MIN : seed.visual.minText;
    if (!qr && l.fontSize < min)
      problems.push(`“${l.name}” is ${l.fontSize} px; the least is ${min}`);
    const box = absolute(show, l);
    if (!inside(box, SAFE)) problems.push(`“${l.name}” runs outside the title-safe area`);
    const frame = tree.parent(l.id);
    if (frame?.layout.mode === 'free' && !inside({ ...l }, { x: 0, y: 0, w: frame.w, h: frame.h }))
      problems.push(`“${l.name}” runs outside its frame “${frame.name}”`);
    const backing = backingOf(show, tree, l);
    if (backing.length) {
      const ratio = Math.min(...backing.map((b) => contrast(l.color, b) ?? Infinity));
      if (ratio < seed.visual.minContrast)
        problems.push(
          `“${l.name}” contrasts ${ratio.toFixed(1)}:1 with its backing; it needs ${seed.visual.minContrast}:1`,
        );
    } else if ((l.shadow ?? 'none') === 'none') {
      const why = scrimProblem(show, tree, l, seed.visual.minContrast);
      if (why) problems.push(`“${l.name}” ${why}`);
    }
    if (qr && l.w < 240) problems.push(`The QR code “${l.name}” is too small to scan from a seat`);
    if (l.kind === 'text' && !qr)
      for (const text of textsOf(show, l)) {
        const over = overflow(l, box, placeheld(show, text));
        if (over) {
          problems.push(`“${l.name}” doesn’t fit “${text.slice(0, 40)}…”: ${over}`);
          break;
        }
      }
  }
  return problems;
}

/** Where a layer is drawn, as near as the format says: frames add their corner. */
function absolute(show: Show, layer: Layer): Box {
  const tree = layerTree(show.layers);
  let box: Box = { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
  for (let parent = tree.parent(layer.id); parent; parent = tree.parent(parent.id)) {
    // In a row or column the frame places its children; judge by the frame's own box.
    box =
      parent.layout.mode === 'free'
        ? { ...box, x: box.x + parent.x, y: box.y + parent.y }
        : { x: parent.x, y: parent.y, w: parent.w, h: parent.h };
  }
  return box;
}

const inside = (a: Box, b: Box) =>
  a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.w <= b.x + b.w + 1 && a.y + a.h <= b.y + b.h + 1;

/**
 * The colours right behind a text layer: its own background, else the nearest filled frame
 * around it; a gradient gives both its ends. Empty when nothing solid is behind it (the stage,
 * a picture, or a see-through fill), so it needs a shadow or a scrim.
 */
function backingOf(show: Show, tree: ReturnType<typeof layerTree>, layer: Texty): string[] {
  const fills = [layer.background];
  for (let p = tree.parent(layer.id); p; p = tree.parent(p.id)) fills.push(p.fill);
  for (const css of fills) {
    const fill = parseFill(css);
    if (fill.kind === 'none') continue;
    if (fill.kind === 'solid' && fill.color.alpha >= 1) return [fill.color.hex];
    if (fill.kind === 'gradient' && fill.from.alpha >= 1 && fill.to.alpha >= 1)
      return [fill.from.hex, fill.to.hex];
    return [];
  }
  return [];
}

/** Cues that bring a layer on. */
function cuesShowing(show: Show, layerId: string): Set<string> {
  return new Set(
    show.cues
      .filter((c) =>
        [...c.actions, ...(c.gentle ?? [])].some(
          (a) => (a.type === 'show' || a.type === 'fade') && a.layerId === layerId,
        ),
      )
      .map((c) => c.id),
  );
}

/**
 * Text over the stage with no shadow must sit over a scrim: a gradient frame named "Scrim · …"
 * beneath it, dark enough at its strong end, on stage whenever the text is. Null when it does.
 */
function scrimProblem(
  show: Show,
  tree: ReturnType<typeof layerTree>,
  layer: Texty,
  minContrast: number,
): string | null {
  const box = absolute(show, layer);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // Beneath it: below the text, or below the frame the text is in.
  let top: Layer = layer;
  for (let p = tree.parent(layer.id); p; p = tree.parent(p.id)) top = p;
  const scrims = show.layers.filter(
    (s): s is Extract<Layer, { kind: 'frame' }> =>
      s.kind === 'frame' &&
      s.name.startsWith('Scrim') &&
      s.outputId === layer.outputId &&
      !tree.parent(s.id) &&
      s.z < top.z &&
      cx >= s.x &&
      cx <= s.x + s.w &&
      cy >= s.y &&
      cy <= s.y + s.h,
  );
  if (!scrims.length) return 'sits over the stage with no backing, scrim or shadow';
  const showsText = cuesShowing(show, top.id);
  for (const s of scrims) {
    const fill = parseFill(s.fill);
    const strong =
      fill.kind === 'solid'
        ? fill.color
        : fill.kind === 'gradient'
          ? fill.from.alpha >= fill.to.alpha
            ? fill.from
            : fill.to
          : null;
    if (!strong || strong.alpha < 0.5) continue;
    if ((contrast(layer.color, strong.hex) ?? 0) < minContrast) continue;
    const together = s.visible || [...cuesShowing(show, s.id)].some((id) => showsText.has(id));
    if (together) return null;
  }
  return 'sits over a scrim too faint, too light, or not on stage with it';
}

function luminance(hex: string): number {
  const c = parseColor(hex);
  if (!c) return 0;
  const n = parseInt(c.hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio, or null when the text colour isn't solid. */
export function contrast(fg: string, bg: string): number | null {
  const c = parseColor(fg);
  if (!c || c.alpha < 1) return null;
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a! + 0.05) / (b! + 0.05);
}

/** The texts a layer will show: its own and every text a cue or rule sets. */
function textsOf(show: Show, layer: TextLayer): string[] {
  const actions = [
    ...show.cues.flatMap((c) => [...c.actions, ...(c.gentle ?? [])]),
    ...show.rules.flatMap((r) => r.then),
  ];
  const set = actions.flatMap((a) =>
    a.type === 'setText' && a.layerId === layer.id ? [a.text] : [],
  );
  return [layer.text, ...set].filter((t) => t.trim());
}

/** Why the text won't fit its box, estimated from the family's letter width; null if it fits. */
function overflow(layer: TextLayer, box: Box, text: string): string | null {
  if (layer.sizing === 'autoWidth') return null;
  const familyName = firstFamily(layer.fontFamily);
  const em =
    (WIDTH[familyName] ?? 0.55) *
      (layer.uppercase ? 1.18 : 1) *
      (layer.fontWeight >= 700 ? 1.05 : 1) +
    (layer.letterSpacing ?? 0);
  const perLine = Math.max(1, Math.floor(box.w / (layer.fontSize * em)));
  const lines = text
    .split('\n')
    .reduce((n, line) => n + Math.max(1, Math.ceil(wrap(line, perLine))), 0);
  if (layer.sizing === 'autoHeight') return null;
  const height = lines * layer.fontSize * (layer.lineHeight ?? 1.15);
  return height > box.h + 1
    ? `${lines} lines need ${Math.round(height)} px, the box is ${box.h}`
    : null;
}

/** Text with each placeholder filled in at about the length it shows on stage. */
function placeheld(show: Show, text: string): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    if (name === 'join_code') return 'ABCDE';
    if (name === 'caption') return 'x'.repeat(40);
    const v = show.vars.find((x) => x.name === name);
    if (v?.type === 'number') return '00';
    // A name or a word the show starts with, with room for a longer one.
    if (v?.type === 'text') {
      const start = String(v.initial ?? '');
      return start.padEnd(Math.max(6, start.length + 4), 'x');
    }
    if (v?.type === 'choice')
      return [...(v.options ?? [])].sort((a, b) => b.length - a.length)[0] ?? 'Xxxxxxxxx';
    return 'Xxxxxxxxx';
  });
}

/** Lines a line of text wraps to at `perLine` letters, breaking between words. */
function wrap(line: string, perLine: number): number {
  let lines = 1;
  let used = 0;
  for (const word of line.split(/\s+/).filter(Boolean)) {
    const len = word.length;
    if (used && used + 1 + len > perLine) {
      lines++;
      used = len;
    } else used += (used ? 1 : 0) + len;
    while (used > perLine) {
      lines++;
      used -= perLine;
    }
  }
  return lines;
}
