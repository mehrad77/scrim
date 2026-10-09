import type { Action, Show, VarValue } from '@scrim/format';
import { cueOrder } from '@scrim/format';
import type { RunOrder } from './order.js';
import { still, type Tween } from './tween.js';
import type { ClearKind } from './types.js';

/** Playback position of a media layer: `position` seconds at epoch ms `anchor`. */
export interface MediaClock {
  playing: boolean;
  position: number;
  anchor: number;
}

export interface CounterClock {
  running: boolean;
  base: number;
  anchor: number;
}

export interface LayerState {
  opacity: Tween;
  media?: MediaClock;
  counter?: CounterClock;
  /** Text set by a cue, replacing the layer's designed text. */
  text?: string;
}

export interface TextEntry {
  id: string;
  text: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface MomentAggregate {
  tally: Record<string, number>;
  count: number;
  sum: number;
  sumSq: number;
  n: number;
}

/**
 * Where a moment's input came from: `relay` (phones and shared tablets, as running totals),
 * `sim` (pretend phones in rehearsal), `buttons` (keys, pads and pedals in the room), `counted`
 * (a count the operator typed, such as raised hands).
 */
export type TallySource = 'relay' | 'sim' | 'buttons' | 'counted';

export interface MomentState extends MomentAggregate {
  /**
   * Totals per source; the moment's own totals are their sum. Optional so journals written
   * before sources existed still load.
   */
  sources?: Partial<Record<TallySource, MomentAggregate>>;
  status: 'idle' | 'open' | 'closed';
  openedAt: number | null;
  closesAt: number | null;
  entries: TextEntry[];
  result: VarValue | null;
  usedDefault: boolean;
}

export type Timer =
  /** Stop a media layer at a position (seek and pause). */
  | { at: number; kind: 'pause'; layerId: string }
  /** A delayed cue action; Hold postpones it, PANIC and Back cancel it. */
  | { at: number; kind: 'action'; action: Action };

/**
 * What a secondary clear took off stage: each layer's target opacity and whether it played.
 * `inner` marks video that was only paused because the frame around it was cleared.
 */
export type ClearPoint = Record<string, { opacity: number; playing: boolean; inner?: boolean }>;

/** The state just before the operator's last GO, so Back can return to it (one step). */
export interface BackPoint {
  cueId: string;
  state: EngineState;
}

export interface EngineState {
  standby: string | null;
  lastFired: string | null;
  held: boolean;
  heldAt: number | null;
  blackout: Tween;
  layers: Record<string, LayerState>;
  vars: Record<string, VarValue>;
  moments: Record<string, MomentState>;
  follow: { cueId: string; at: number } | null;
  timers: Timer[];
  fired: number;
  /** Optional so journals written before Back existed still load. */
  back?: BackPoint | null;
  /** Sound muted (1) or not (0), on top of the blackout. Optional for older journals. */
  mute?: Tween;
  /** What the secondary clears took off, for undo until the next cue fires. */
  cleared?: Partial<Record<ClearKind, ClearPoint>>;
  /** Tonight's running order; absent or null: the show's own order. */
  order?: RunOrder | null;
}

export function emptyAggregate(): MomentAggregate {
  return { tally: {}, count: 0, sum: 0, sumSq: 0, n: 0 };
}

export function idleMoment(): MomentState {
  return {
    ...emptyAggregate(),
    status: 'idle',
    openedAt: null,
    closesAt: null,
    entries: [],
    result: null,
    usedDefault: false,
  };
}

export function initialLayerState(show: Show, layerId: string): LayerState {
  const layer = show.layers.find((l) => l.id === layerId);
  if (!layer) return { opacity: still(0) };
  const state: LayerState = { opacity: still(layer.visible ? layer.opacity : 0) };
  if (layer.kind === 'video' || layer.kind === 'audio') {
    state.media = { playing: false, position: 0, anchor: 0 };
  }
  if (layer.kind === 'counter') state.counter = { running: false, base: layer.start, anchor: 0 };
  return state;
}

export function initialState(show: Show): EngineState {
  return {
    standby: cueOrder(show)[0]?.id ?? null,
    lastFired: null,
    held: false,
    heldAt: null,
    blackout: still(0),
    layers: Object.fromEntries(show.layers.map((l) => [l.id, initialLayerState(show, l.id)])),
    vars: Object.fromEntries(show.vars.map((v) => [v.id, structuredClone(v.initial)])),
    moments: Object.fromEntries(show.moments.map((m) => [m.id, idleMoment()])),
    follow: null,
    timers: [],
    fired: 0,
    back: null,
    mute: still(0),
    cleared: {},
    order: null,
  };
}

/** Bring a state in line with an edited show, keeping everything still valid. */
export function reconcile(show: Show, prev: EngineState): EngineState {
  const state = structuredClone(prev);
  const layerIds = new Set(show.layers.map((l) => l.id));
  for (const id of Object.keys(state.layers)) if (!layerIds.has(id)) delete state.layers[id];
  for (const l of show.layers) state.layers[l.id] ??= initialLayerState(show, l.id);
  const varIds = new Set(show.vars.map((v) => v.id));
  for (const id of Object.keys(state.vars)) if (!varIds.has(id)) delete state.vars[id];
  for (const v of show.vars)
    if (!(v.id in state.vars)) state.vars[v.id] = structuredClone(v.initial);
  const momentIds = new Set(show.moments.map((m) => m.id));
  for (const id of Object.keys(state.moments)) if (!momentIds.has(id)) delete state.moments[id];
  for (const m of show.moments) state.moments[m.id] ??= idleMoment();
  state.timers = state.timers.filter((t) =>
    t.kind === 'pause'
      ? layerIds.has(t.layerId)
      : !('layerId' in t.action) || layerIds.has(t.action.layerId),
  );
  const cueIds = new Set(cueOrder(show).map((c) => c.id));
  if (state.standby && !cueIds.has(state.standby)) state.standby = cueOrder(show)[0]?.id ?? null;
  if (state.lastFired && !cueIds.has(state.lastFired)) state.lastFired = null;
  if (state.follow && !cueIds.has(state.follow.cueId)) state.follow = null;
  state.mute ??= still(0);
  state.cleared ??= {};
  for (const point of Object.values(state.cleared))
    for (const id of Object.keys(point ?? {})) if (!layerIds.has(id)) delete point![id];
  return state;
}

export function mediaPosition(m: MediaClock, now: number): number {
  return m.playing ? m.position + Math.max(0, now - m.anchor) / 1000 : m.position;
}

export function counterValue(
  c: CounterClock,
  mode: 'countdown' | 'countup' | 'count',
  now: number,
): number {
  if (mode === 'count') return c.base;
  const elapsed = c.running ? Math.max(0, now - c.anchor) / 1000 : 0;
  return mode === 'countdown' ? Math.max(0, c.base - elapsed) : c.base + elapsed;
}
