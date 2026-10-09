import {
  formatVar,
  initialState,
  step,
  type EngineEvent,
  type EngineInput,
  type EngineState,
} from '@scrim/engine';
import { cueOrder, uid, type Show, type VarValue } from '@scrim/format';
import { readLocal, writeLocal } from './local.js';
import { openersOf, valueLabel } from './logic.js';

/**
 * Testing a show without an audience (UX principle 7): replay it from the top the way an
 * operator would, with assumed results for audience moments. Pure apart from the per-machine
 * bookmark and hand-off storage at the bottom.
 */

/** What audience moments returned, by moment id. Missing moments use their default. */
export type Assume = Record<string, VarValue>;

/** Far apart, so every fade and timer has finished between two cues. */
const GAP = 1e7;

/** Finish fades and freeze clocks, so the state is a still picture. */
export function settle(state: EngineState): EngineState {
  for (const ls of Object.values(state.layers)) {
    ls.opacity = { ...ls.opacity, from: ls.opacity.to, dur: 0 };
    if (ls.counter) ls.counter = { ...ls.counter, running: false };
    if (ls.media) ls.media = { ...ls.media, playing: false };
  }
  return state;
}

/** Run delayed layer actions, without closing moments or following on. */
function finishDelays(show: Show, state: EngineState, at: number): EngineState {
  if (!state.timers.some((t) => t.kind === 'action')) return state;
  const quiet: EngineState = {
    ...state,
    follow: null,
    moments: Object.fromEntries(
      Object.entries(state.moments).map(([id, m]) => [id, { ...m, closesAt: null }]),
    ),
  };
  const next = step(show, quiet, { type: 'tick' }, at).state;
  next.follow = state.follow;
  for (const [id, m] of Object.entries(next.moments))
    m.closesAt = state.moments[id]?.closesAt ?? null;
  return next;
}

export interface Walk {
  state: EngineState;
  /** Cue ids in the order they fired. */
  fired: string[];
  /** Whether the walk got to the cue it was asked for. */
  reached: boolean;
  events: EngineEvent[];
  t: number;
}

/**
 * Press GO from the top until `cueId` fires (or, with `stopAt: 'standby'`, until it is on
 * standby). Every moment closes with its assumed result as soon as its cue has fired.
 */
export function walkTo(
  show: Show,
  cueId: string,
  assume: Assume = {},
  stopAt: 'fired' | 'standby' = 'fired',
): Walk {
  let state = initialState(show);
  let t = 1;
  const fired: string[] = [];
  const events: EngineEvent[] = [];
  const run = (input: EngineInput) => {
    t += 1;
    const r = step(show, state, input, t);
    state = r.state;
    events.push(...r.events);
    return r.events;
  };
  const limit = cueOrder(show).length * 3 + 10;
  while (fired.length < limit) {
    const next = state.standby;
    if (!next) break;
    if (stopAt === 'standby' && next === cueId) return { state, fired, reached: true, events, t };
    t += GAP;
    const out = run({ type: 'fireCue', cueId: next, source: 'system' });
    const now = out.flatMap((e) => (e.type === 'cueFired' ? [e.cueId] : []));
    fired.push(...now);
    if (stopAt === 'fired' && now.includes(cueId)) {
      state = finishDelays(show, state, t + GAP / 2);
      return { state, fired, reached: true, events, t };
    }
    for (const [id, m] of Object.entries(state.moments)) {
      if (m.status !== 'open') continue;
      const result = assume[id];
      run({ type: 'closeMoment', momentId: id, ...(result !== undefined ? { result } : {}) });
    }
    state = finishDelays(show, state, t + GAP / 2);
  }
  return { state, fired, reached: false, events, t };
}

/** Every cue in running order up to `cueId`, ignoring branches: the fallback picture. */
function linear(show: Show, cueId: string): EngineState {
  let state = initialState(show);
  let t = 1;
  for (const cue of cueOrder(show)) {
    t += GAP;
    state = step(show, state, { type: 'fireCue', cueId: cue.id, source: 'system' }, t).state;
    state = finishDelays(show, state, t + GAP / 2);
    if (cue.id === cueId) break;
  }
  return state;
}

export interface Preview {
  state: EngineState;
  /** False when these assumptions never reach the cue; the picture then follows running order. */
  onPath: boolean;
  fired: string[];
}

/**
 * What the stage looks like right after `cueId` (or at the top of the show), with every fade
 * finished. Follows the branches the assumed results lead to.
 */
export function previewAt(show: Show, cueId: string | null, assume: Assume = {}): Preview {
  if (!cueId) return { state: settle(initialState(show)), onPath: true, fired: [] };
  const walk = walkTo(show, cueId, assume);
  if (walk.reached) return { state: settle(walk.state), onPath: true, fired: walk.fired };
  return { state: settle(linear(show, cueId)), onPath: false, fired: walk.fired };
}

/** The settled stage right after `cueId`, following moment defaults. */
export function previewState(show: Show, cueId: string | null): EngineState {
  return previewAt(show, cueId).state;
}

/** The moments a walk to `cueId` passes through before it, for Assume chips. */
export function momentsBefore(show: Show, cueId: string, assume: Assume = {}): string[] {
  const walk = walkTo(show, cueId, assume, 'standby');
  const opened = walk.events.flatMap((e) => (e.type === 'momentOpened' ? [e.momentId] : []));
  return [...new Set(opened)];
}

// ---- try every outcome ----

export interface Outcome {
  value: VarValue;
  label: string;
  /** Names of the rules that ran. */
  ran: string[];
  /** Where standby lands: the path this outcome takes. */
  standby: { number: number; name: string; scene: string } | null;
  changes: { name: string; before: string; after: string }[];
}

function outcomeValues(show: Show, momentId: string): { value: VarValue; label: string }[] {
  const m = show.moments.find((x) => x.id === momentId);
  if (!m) return [];
  switch (m.type) {
    case 'vote':
      return m.options.map((o) => ({ value: o.id, label: o.label }));
    case 'slider': {
      const mid = Math.round(((m.min + m.max) / 2) * 10) / 10;
      return [m.min, mid, m.max].map((v) => ({ value: v, label: String(v) }));
    }
    case 'tap':
      return [0, 10, 100].map((v) => ({ value: v, label: `${v} taps` }));
    default:
      return [{ value: m.defaultResult, label: 'The default' }];
  }
}

/** One line per possible result of a moment, with the path the show then takes. */
export function tryOutcomes(show: Show, momentId: string, assume: Assume = {}): Outcome[] {
  const opener = openersOf(show, momentId)[0];
  if (!opener) return [];
  const walk = walkTo(show, opener.id, assume);
  const start = walk.reached ? walk.state : linear(show, opener.id);
  if (start.moments[momentId]?.status !== 'open') return [];
  const order = cueOrder(show);
  // A forced result leaves the tally empty; only the values rules can act on are interesting.
  const tally = show.moments.find((m) => m.id === momentId)?.tallyVarId;
  return outcomeValues(show, momentId).map(({ value, label }) => {
    const { state, events } = step(
      show,
      start,
      { type: 'closeMoment', momentId, result: value },
      walk.t + 1,
    );
    const i = order.findIndex((c) => c.id === state.standby);
    const cue = order[i];
    return {
      value,
      label,
      ran: events.flatMap((e) =>
        e.type === 'ruleEvaluated' && e.ran
          ? [show.rules.find((r) => r.id === e.ruleId)?.name ?? 'a rule']
          : [],
      ),
      standby: cue
        ? {
            number: i + 1,
            name: cue.name,
            scene: show.scenes.find((s) => s.id === cue.sceneId)?.name ?? '',
          }
        : null,
      changes: show.vars.flatMap((v) => {
        if (v.id === tally) return [];
        const shown = (x: VarValue | undefined) =>
          typeof x === 'string' || typeof x === 'number'
            ? valueLabel(show, v.id, x)
            : formatVar(show, v.id, x);
        const before = shown(start.vars[v.id]);
        const after = shown(state.vars[v.id]);
        return before === after ? [] : [{ name: v.name, before, after }];
      }),
    };
  });
}

// ---- path bookmarks (per machine) ----

export interface PathBookmark {
  id: string;
  name: string;
  /** The cue the path leads to. */
  cueId: string;
  assume: Assume;
  /** The cues it fired when saved, to notice when an edit reroutes it. */
  route: string[];
}

const pathsKey = (showId: string) => `scrim.paths.${showId}`;

export function readPaths(showId: string): PathBookmark[] {
  return readLocal<PathBookmark[]>(pathsKey(showId), []);
}

export function writePaths(showId: string, paths: PathBookmark[]): void {
  writeLocal(pathsKey(showId), paths);
}

export function bookmarkPath(
  show: Show,
  cueId: string,
  assume: Assume,
  name: string,
): PathBookmark {
  return { id: uid('path'), name, cueId, assume, route: walkTo(show, cueId, assume).fired };
}

export type PathStatus = 'ok' | 'rerouted' | 'broken';

/** Replay a saved path against the current show. */
export function checkPath(show: Show, p: PathBookmark): PathStatus {
  if (!show.cues.some((c) => c.id === p.cueId)) return 'broken';
  const walk = walkTo(show, p.cueId, p.assume);
  if (!walk.reached) return 'broken';
  return walk.fired.join() === p.route.join() ? 'ok' : 'rerouted';
}

// ---- rehearse from here ----

const REHEARSE_KEY = 'scrim.rehearseFrom';
const REHEARSE_TTL = 60_000;

interface Handoff {
  showId: string;
  cueName: string;
  state: EngineState;
  at: number;
}

/**
 * Leave the show ready to rehearse from `cueId`: everything before it has run (with the assumed
 * results) and it is on standby. The operator view picks this up when it opens.
 */
export function prepareRehearsal(show: Show, cueId: string, assume: Assume): void {
  const walk = walkTo(show, cueId, assume, 'standby');
  let state: EngineState;
  if (walk.reached) state = walk.state;
  else {
    const order = cueOrder(show);
    const before = order[order.findIndex((c) => c.id === cueId) - 1];
    state = before ? linear(show, before.id) : initialState(show);
    state.standby = cueId;
  }
  state = settle(state);
  state.follow = null;
  state.back = null;
  state.timers = [];
  const cueName = show.cues.find((c) => c.id === cueId)?.name ?? '';
  writeLocal(REHEARSE_KEY, { showId: show.id, cueName, state, at: Date.now() } satisfies Handoff);
}

/** The hand-off left by "Rehearse from here", once, if it is for this show and fresh. */
export function takeRehearsal(showId: string): { state: EngineState; cueName: string } | null {
  const h = readLocal<Handoff | null>(REHEARSE_KEY, null);
  if (!h || h.showId !== showId || Date.now() - h.at > REHEARSE_TTL) return null;
  writeLocal(REHEARSE_KEY, null);
  return { state: h.state, cueName: h.cueName };
}

/** The settled state just before `cueId` fires on this path: what Play starts from. */
export function stateBefore(show: Show, cueId: string, assume: Assume = {}): EngineState {
  const walk = walkTo(show, cueId, assume, 'standby');
  if (walk.reached) return settle(walk.state);
  const order = cueOrder(show);
  const prev = order[order.findIndex((c) => c.id === cueId) - 1];
  return previewAt(show, prev?.id ?? null, assume).state;
}

// ---- simulate phones ----

type MomentAgg = Extract<EngineInput, { type: 'momentAgg' }>;
type Aggregate = Pick<EngineState['moments'][string], 'tally' | 'count' | 'sum' | 'sumSq' | 'n'>;

/**
 * Pretend `n` phones answered an open moment, on top of what has already arrived. Rehearsal
 * only: real phones' totals from the room replace these.
 */
export function fakePhones(
  show: Show,
  momentId: string,
  n: number,
  current: Aggregate,
  rand: () => number = Math.random,
): MomentAgg | null {
  const m = show.moments.find((x) => x.id === momentId);
  if (!m || n <= 0) return null;
  const tally = { ...current.tally };
  const bump = (k: string, by = 1) => (tally[k] = (tally[k] ?? 0) + by);
  switch (m.type) {
    case 'vote': {
      // A lean towards one option, so results look like a room rather than a coin.
      const weights = m.options.map(() => 0.5 + rand());
      const total = weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < n; i++) {
        let r = rand() * total;
        const k = weights.findIndex((w) => (r -= w) < 0);
        bump(m.options[Math.max(0, k)]!.id);
      }
      return { type: 'momentAgg', momentId, tally, n: current.n + n };
    }
    case 'tap': {
      let taps = 0;
      for (let i = 0; i < n; i++) taps += 5 + Math.floor(rand() * 35);
      return { type: 'momentAgg', momentId, count: current.count + taps, n: current.n + n };
    }
    case 'slider': {
      let { sum, sumSq } = current;
      for (let i = 0; i < n; i++) {
        const v = Math.round(m.min + rand() * (m.max - m.min));
        sum += v;
        sumSq += v * v;
        bump(String(v));
      }
      return { type: 'momentAgg', momentId, sum, sumSq, n: current.n + n, tally };
    }
    case 'text':
      return {
        type: 'momentAgg',
        momentId,
        n: current.n + n,
        entries: Array.from({ length: n }, (_, i) => ({
          id: uid('sim'),
          text: `Pretend phone ${current.n + i + 1}`,
        })),
      };
    case 'prop': {
      const total = m.variants.reduce((a, v) => a + v.weight, 0);
      for (let i = 0; i < n; i++) {
        let r = rand() * total;
        const k = m.variants.findIndex((v) => (r -= v.weight) < 0);
        const v = m.variants[Math.max(0, k)];
        if (v) bump(v.id);
      }
      return { type: 'momentAgg', momentId, tally, n: current.n + n };
    }
  }
}
