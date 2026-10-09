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
  problems.push(...branches(show), ...walk(show, false), ...walk(show, true));
  problems.push(...mediaUse(show, media), ...visual(seed, show));
  return problems;
}

/** Every vote can be rehearsed both ways: each option is an outcome you can try. */
function branches(show: Show): string[] {
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
    if (outcomes.length > 1 && leads.size < 2)
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
    } else break;
  }
  const label = relaxed ? 'Relaxed, ' : '';
  if (state.fired === 0) problems.add(`${label}GO fires nothing`);
  return [...problems].map((p) => (relaxed && !p.startsWith('Relaxed') ? `${label}${p}` : p));
}

/** On stage: it and every frame around it are heading to visible. */
function shown(state: EngineState, tree: ReturnType<typeof layerTree>, id: string): boolean {
  for (let l = tree.byId.get(id); l; l = tree.parent(l.id))
    if ((state.layers[l.id]?.opacity.to ?? 0) <= 0) return false;
  return true;
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
    const min = labels.has(l.name) ? LABEL_MIN : seed.visual.minText;
    if (l.fontSize < min) problems.push(`“${l.name}” is ${l.fontSize} px; the least is ${min}`);
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
    if (l.kind === 'text')
      for (const text of textsOf(show, l)) {
        const over = overflow(l, box, text);
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
  // Placeholders fill in at about a short word's length.
  const lines = text
    .replace(/\{\{[^}]+\}\}/g, 'Xxxxxxxxx')
    .split('\n')
    .reduce((n, line) => n + Math.max(1, Math.ceil(wrap(line, perLine))), 0);
  if (layer.sizing === 'autoHeight') return null;
  const height = lines * layer.fontSize * (layer.lineHeight ?? 1.15);
  return height > box.h + 1
    ? `${lines} lines need ${Math.round(height)} px, the box is ${box.h}`
    : null;
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
