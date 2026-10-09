import type { Show } from '@scrim/format';
import type { RunRecord } from '../storage/db.js';
import { readLocal, writeLocal } from './local.js';

/**
 * The demo is disposable and teaches by doing (UX principle 8): a short Learn checklist whose
 * items tick themselves when the person actually does them.
 */
export interface DemoRecord {
  id: string;
  /** The demo's key map when it was made, to notice a mapped key. */
  inputs: string;
}

const DEMO_KEY = 'scrim.demo';

/** How the run log marks a moment that closed on its default (host/ShowHost.ts). */
export const DEFAULT_MARK = '(default — no input)';

export function demoRecord(): DemoRecord | null {
  return readLocal<DemoRecord | null>(DEMO_KEY, null);
}

export function rememberDemo(show: Show): void {
  setDemoRecord({ id: show.id, inputs: JSON.stringify(show.inputs) });
}

export function setDemoRecord(record: DemoRecord): void {
  writeLocal(DEMO_KEY, record);
}

export interface LearnStep {
  id: string;
  title: string;
  hint: string;
  done: boolean;
}

export function learnSteps(show: Show, runs: RunRecord[], demo: DemoRecord): LearnStep[] {
  const said = (test: (text: string, kind: string) => boolean) =>
    runs.some((r) => r.entries.some((e) => test(e.text, e.kind)));
  return [
    { id: 'open', title: 'Open the demo', hint: 'Done.', done: true },
    {
      id: 'go',
      title: 'Press GO in Rehearsal',
      hint: 'Run the show, then press Space.',
      done: runs.some((r) => r.cuesFired > 0),
    },
    {
      id: 'edit',
      title: 'Change a cue',
      hint: 'In the editor’s Cues tab, change a fade or a name.',
      done: show.cues.some((c) => c.updatedAt > show.createdAt + 1000),
    },
    {
      id: 'vote',
      title: 'Vote from your phone',
      hint: 'Open the audience room in Rehearsal and scan the QR code.',
      done: said(
        (t, kind) => kind === 'moment' && t.startsWith('Closed') && !t.includes(DEFAULT_MARK),
      ),
    },
    {
      id: 'map',
      title: 'Map a key',
      hint: 'In the operator view, use Map keys and press a key for Hold.',
      done: JSON.stringify(show.inputs) !== demo.inputs,
    },
    {
      id: 'show',
      title: 'Switch to Show mode',
      hint: 'The lock in the operator header: the calm state for performances.',
      done: said((t) => t.startsWith('Show mode')),
    },
  ];
}

/**
 * A show made from a template keeps a note of how it started, so its Learn checklist can tell
 * what the person has since made their own (UX principle 8: teach by doing).
 */
export interface Baseline {
  media: string[];
  texts: Record<string, string>;
  vars: Record<string, unknown>;
  inputs: string;
  moments: string;
  schedule: string;
  setlists: string;
  scenes: number;
}

export interface TemplateRecord {
  template: string;
  baseline: Baseline;
}

const TEMPLATES_KEY = 'scrim.templateShows';

export function baselineOf(show: Show): Baseline {
  return {
    media: show.media.map((m) => m.id),
    texts: Object.fromEntries(
      show.layers.flatMap((l) => (l.kind === 'text' ? [[l.id, l.text]] : [])),
    ),
    vars: Object.fromEntries(show.vars.map((v) => [v.id, v.initial])),
    inputs: JSON.stringify(show.inputs),
    moments: JSON.stringify(show.moments.map((m) => [m.prompt, m.options])),
    schedule: JSON.stringify(show.schedule ?? null),
    setlists: JSON.stringify(show.setlists ?? []),
    scenes: show.scenes.length,
  };
}

export function templateRecord(showId: string): TemplateRecord | null {
  return readLocal<Record<string, TemplateRecord>>(TEMPLATES_KEY, {})[showId] ?? null;
}

export function rememberTemplate(show: Show, template: string): void {
  const all = readLocal<Record<string, TemplateRecord>>(TEMPLATES_KEY, {});
  all[show.id] = { template, baseline: baselineOf(show) };
  writeLocal(TEMPLATES_KEY, all);
}

export function forgetTemplate(showId: string): void {
  const all = readLocal<Record<string, TemplateRecord>>(TEMPLATES_KEY, {});
  delete all[showId];
  writeLocal(TEMPLATES_KEY, all);
}

export interface LearnContext {
  show: Show;
  runs: RunRecord[];
  baseline: Baseline;
}

/** A step of a template's checklist; `done` reads what the person has actually done. */
export interface LearnSpec {
  id: string;
  title: string;
  hint: string;
  done: (ctx: LearnContext) => boolean;
}

const logged = (ctx: LearnContext, test: (text: string, kind: string) => boolean) =>
  ctx.runs.some((r) => r.entries.some((e) => test(e.text, e.kind)));

const layerNamed = (show: Show, name: string) => show.layers.find((l) => l.name === name);

/** Small pure checks templates build their steps from. */
export const did = {
  go: (ctx: LearnContext) => ctx.runs.some((r) => r.cuesFired > 0),
  showMode: (ctx: LearnContext) => logged(ctx, (t) => t.startsWith('Show mode')),
  /** An audience moment closed on real answers, not its default. */
  decided: (ctx: LearnContext) =>
    logged(
      ctx,
      (t, kind) => kind === 'moment' && t.startsWith('Closed') && !t.includes(DEFAULT_MARK),
    ),
  /** A picture, video or sound of their own is on stage. */
  ownMedia: (ctx: LearnContext) => {
    const used = new Set(ctx.show.layers.flatMap((l) => ('mediaId' in l ? [l.mediaId] : [])));
    return ctx.show.media.some(
      (m) => m.kind !== 'font' && used.has(m.id) && !ctx.baseline.media.includes(m.id),
    );
  },
  /** The text of the layer of this name differs from the template's. */
  text: (name: string) => (ctx: LearnContext) => {
    const l = layerNamed(ctx.show, name);
    return l?.kind === 'text' && l.id in ctx.baseline.texts && ctx.baseline.texts[l.id] !== l.text;
  },
  /** The starting value of the value of this name differs from the template's. */
  value: (name: string) => (ctx: LearnContext) => {
    const v = ctx.show.vars.find((x) => x.name === name);
    return (
      !!v &&
      v.id in ctx.baseline.vars &&
      JSON.stringify(ctx.baseline.vars[v.id]) !== JSON.stringify(v.initial)
    );
  },
  /** A question or its answers changed. */
  moments: (ctx: LearnContext) =>
    JSON.stringify(ctx.show.moments.map((m) => [m.prompt, m.options])) !== ctx.baseline.moments,
  mapped: (ctx: LearnContext) => JSON.stringify(ctx.show.inputs) !== ctx.baseline.inputs,
  setlist: (ctx: LearnContext) => JSON.stringify(ctx.show.setlists ?? []) !== ctx.baseline.setlists,
  schedule: (ctx: LearnContext) =>
    JSON.stringify(ctx.show.schedule ?? null) !== ctx.baseline.schedule,
  /** Scenes were added, by a wizard or Import scenes. */
  scenes: (ctx: LearnContext) => ctx.show.scenes.length > ctx.baseline.scenes,
  room: (ctx: LearnContext) => logged(ctx, (t) => /^Audience room \w+ connected/.test(t)),
  relaxed: (ctx: LearnContext) => logged(ctx, (t) => t.startsWith('Relaxed performance:')),
  installation: (ctx: LearnContext) => logged(ctx, (t) => t.startsWith('Installation started')),
};

export function templateSteps(specs: LearnSpec[], ctx: LearnContext): LearnStep[] {
  return specs.map(({ id, title, hint, done }) => ({ id, title, hint, done: done(ctx) }));
}
