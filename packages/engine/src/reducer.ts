import type { Action, Cue, Layer, Moment, Show, VarValue } from '@scrim/format';
import { ancestorsOf, descendantsOf, isFrame, layerTree } from '@scrim/format';
import { evaluateAll, explain } from './conditions.js';
import {
  counterValue,
  emptyAggregate,
  idleMoment,
  initialState,
  mediaPosition,
  reconcile,
  type ClearPoint,
  type EngineState,
  type LayerState,
  type MomentAggregate,
  type MomentState,
  type TallySource,
  type Timer,
} from './state.js';
import { accessAfter } from './access.js';
import { resolveJump, runOrder, sceneSequence, type RunOrder } from './order.js';
import { retarget, still } from './tween.js';
import type { ClearKind, EngineEvent, EngineInput, InputSource } from './types.js';

const MAX_RULE_EVENTS = 200;
/** Cues one input may fire through jumps and zero-second follows before the engine calls it a loop. */
const MAX_CUE_FIRES = 64;

interface Ctx {
  show: Show;
  state: EngineState;
  now: number;
  events: EngineEvent[];
  /** The cues that play tonight, in running order. */
  order: Cue[];
  /** Cues fired in this step. */
  fires: number;
  /** Events rules have looked at in this step. */
  ruleEvents: number;
  /** Delayed actions scheduled in this step, which a Fade all in the same step keeps. */
  scheduled: Set<Timer>;
}

export interface StepResult {
  state: EngineState;
  events: EngineEvent[];
}

/**
 * Apply one input to the show state. Pure: the same show, state, input and
 * time always give the same result. Rules run on the events the input causes.
 */
export function step(show: Show, prev: EngineState, input: EngineInput, now: number): StepResult {
  const ctx: Ctx = {
    show,
    state: structuredClone(prev),
    now,
    events: [],
    order: runOrder(show, prev.order ?? null),
    fires: 0,
    ruleEvents: 0,
    scheduled: new Set(),
  };
  applyInput(ctx, input);
  let ruled = runRules(ctx, 0);
  // A zero-second follow fires in this step, after the rules of the cue before it, so a loop of
  // them meets the cue cap instead of spinning one tick after another. Only a cue fired in this
  // step can have set it: every fire replaces the follow, and older ones wait for their tick.
  while (ctx.fires > 0 && ctx.state.follow && ctx.state.follow.at <= ctx.now && !ctx.state.held) {
    const { cueId } = ctx.state.follow;
    ctx.state.follow = null;
    fireCue(ctx, cueId, 'follow');
    ruled = runRules(ctx, ruled);
  }
  // Remember where an operator GO started from, so Back can return there.
  const fired = ctx.events.find((e) => e.type === 'cueFired');
  if ((input.type === 'go' || input.type === 'fireCue') && fired?.type === 'cueFired') {
    ctx.state.back = { cueId: fired.cueId, state: { ...structuredClone(prev), back: null } };
  }
  return { state: ctx.state, events: ctx.events };
}

/** Earliest epoch ms at which a `tick` would change something, or null. */
export function nextWakeup(state: EngineState): number | null {
  const times: number[] = state.timers
    .filter((t) => !state.held || t.kind !== 'action')
    .map((t) => t.at);
  if (!state.held) {
    if (state.follow) times.push(state.follow.at);
    for (const m of Object.values(state.moments)) {
      if (m.status === 'open' && m.closesAt !== null) times.push(m.closesAt);
    }
  }
  return times.length ? Math.min(...times) : null;
}

function applyInput(ctx: Ctx, input: EngineInput): void {
  const { state, now } = ctx;
  switch (input.type) {
    case 'go': {
      if (!state.standby) return warn(ctx, 'GO with nothing on standby');
      fireCue(ctx, state.standby, input.source ?? 'operator');
      return;
    }
    case 'fireCue':
      fireCue(ctx, input.cueId, input.source ?? 'operator');
      return;
    case 'standby':
      if (reach(ctx, input.cueId)) state.standby = input.cueId;
      return;
    case 'jump': {
      const to = resolveJump(ctx.show, ctx.order, state, input.target);
      if ('warning' in to) return warn(ctx, to.warning);
      jumpTo(ctx, to.cueId, input.fire ?? false, input.source ?? 'operator');
      return;
    }
    case 'setOrder':
      setRunOrder(ctx, input.order);
      return;
    case 'standbyNext':
    case 'standbyPrev': {
      const i = ctx.order.findIndex((c) => c.id === state.standby);
      const delta = input.type === 'standbyNext' ? 1 : -1;
      const base = i === -1 ? (delta > 0 ? -1 : ctx.order.length) : i;
      const next = ctx.order[Math.min(Math.max(base + delta, 0), ctx.order.length - 1)];
      state.standby = next?.id ?? null;
      return;
    }
    case 'hold': {
      const on = input.on ?? !state.held;
      if (on === state.held) return;
      if (on) {
        state.held = true;
        state.heldAt = now;
      } else {
        const paused = now - (state.heldAt ?? now);
        if (state.follow) state.follow.at += paused;
        for (const t of state.timers) if (t.kind === 'action') t.at += paused;
        for (const m of Object.values(state.moments)) {
          if (m.status === 'open' && m.closesAt !== null) m.closesAt += paused;
        }
        state.held = false;
        state.heldAt = null;
      }
      ctx.events.push({ type: 'hold', on });
      return;
    }
    case 'panic':
      state.blackout = retarget(state.blackout, 1, now, input.fade ?? 0, 'linear');
      state.follow = null;
      state.timers = state.timers.filter((t) => t.kind !== 'action');
      ctx.events.push({ type: 'panic' });
      return;
    case 'release':
      state.blackout = retarget(state.blackout, 0, now, input.fade ?? 0, 'linear');
      ctx.events.push({ type: 'release' });
      return;
    case 'trigger':
      if (!ctx.show.triggers.some((t) => t.id === input.triggerId)) {
        return warn(ctx, `Unknown trigger ${input.triggerId}`);
      }
      ctx.events.push({
        type: 'trigger',
        triggerId: input.triggerId,
        source: input.source ?? 'operator',
      });
      return;
    case 'tick':
      tick(ctx);
      return;
    case 'openMoment':
      openMoment(ctx, input.momentId);
      return;
    case 'closeMoment':
      closeMoment(ctx, input.momentId, input.result);
      return;
    case 'extendMoment': {
      const m = state.moments[input.momentId];
      if (m?.status === 'open')
        m.closesAt = Math.max(m.closesAt ?? now, now) + input.seconds * 1000;
      return;
    }
    case 'momentAgg':
      aggregate(ctx, input);
      return;
    case 'countVote':
      countVote(ctx, input);
      return;
    case 'moderate': {
      const m = state.moments[input.momentId];
      const entry = m?.entries.find((e) => e.id === input.entryId);
      if (!m || !entry) return;
      entry.status = input.approve ? 'approved' : 'rejected';
      const def = momentDef(ctx, input.momentId);
      if (def?.type === 'text' && def.resultVarId) {
        setVar(ctx, def.resultVarId, approvedTexts(m.entries));
      }
      return;
    }
    case 'mediaEnded': {
      const media = state.layers[input.layerId]?.media;
      if (!media?.playing) return;
      const layer = ctx.show.layers.find((l) => l.id === input.layerId);
      if (layer && (layer.kind === 'video' || layer.kind === 'audio') && layer.loop) return;
      media.position = mediaPosition(media, now);
      media.playing = false;
      media.anchor = now;
      ctx.events.push({ type: 'mediaEnded', layerId: input.layerId });
      return;
    }
    case 'setVar':
      setVar(ctx, input.varId, input.value);
      return;
    case 'seek': {
      const media = state.layers[input.layerId]?.media;
      if (media) Object.assign(media, { position: Math.max(0, input.time), anchor: now });
      return;
    }
    case 'action':
      applyAction(ctx, input.action);
      return;
    case 'reset': {
      // Tonight's running order is the plan for the night, so it outlives a reset.
      const order = ctx.state.order ?? null;
      ctx.state = { ...initialState(ctx.show), order };
      ctx.order = runOrder(ctx.show, order);
      ctx.state.standby = ctx.order[0]?.id ?? null;
      ctx.events.push({ type: 'reset' });
      return;
    }
    case 'back':
      back(ctx);
      return;
    case 'clear':
      clear(ctx, input.what, input.fade ?? CLEAR_FADE);
      return;
    case 'unclear':
      unclear(ctx, input.what, input.fade ?? CLEAR_FADE);
      return;
    case 'mute': {
      const muted = (state.mute ?? still(0)).to === 1;
      const on = input.on ?? !muted;
      if (on === muted) return;
      state.mute = retarget(state.mute ?? still(0), on ? 1 : 0, now, input.fade ?? 0.15, 'linear');
      ctx.events.push({ type: 'mute', on });
      return;
    }
  }
}

/** Secondary clears are quick but not a cut, so nobody sees a jump. */
const CLEAR_FADE = 0.5;

const CLEARS: Record<ClearKind, ReadonlySet<Layer['kind']>> = {
  text: new Set(['text', 'counter', 'state']),
  media: new Set(['image', 'video']),
};

/**
 * Fade out every layer of one kind that is on stage or on its way, pause its video, and cancel
 * delayed actions that would bring any of them back. A frame holding nothing but that kind goes
 * as one, so its fill leaves with its content. What it took is kept so `unclear` can restore it
 * until the next cue fires.
 */
function clear(ctx: Ctx, what: ClearKind, fade: number): void {
  const { state, now, show } = ctx;
  const tree = layerTree(show.layers);
  const matches = new Set(show.layers.filter((l) => CLEARS[what].has(l.kind)).map((l) => l.id));
  const whole = (f: Layer) => {
    const leaves = descendantsOf(tree, f.id).filter((l) => !isFrame(l));
    return leaves.length > 0 && leaves.every((l) => matches.has(l.id));
  };
  const targets: Layer[] = [];
  const walk = (l: Layer): void => {
    if (!isFrame(l)) {
      if (matches.has(l.id)) targets.push(l);
    } else if (whole(l)) targets.push(l);
    else tree.children(l.id).forEach(walk);
  };
  tree.roots.forEach(walk);

  // On stage or on its way: it and every frame around it are heading above zero.
  const onStage = (id: string) =>
    [id, ...ancestorsOf(tree, id).map((f) => f.id)].every(
      (i) => (state.layers[i]?.opacity.to ?? 0) > 0,
    );
  const freeze = (ls: LayerState) =>
    ls.media?.playing &&
    Object.assign(ls.media, {
      playing: false,
      position: mediaPosition(ls.media, now),
      anchor: now,
    });

  const point: ClearPoint = {};
  const gone = new Set(matches);
  for (const t of targets) {
    const inside = descendantsOf(tree, t.id);
    for (const d of inside) gone.add(d.id);
    gone.add(t.id);
    const ls = state.layers[t.id];
    if (!ls || !onStage(t.id)) continue;
    point[t.id] = { opacity: ls.opacity.to, playing: !!ls.media?.playing };
    ls.opacity = retarget(ls.opacity, 0, now, fade, 'easeOut');
    freeze(ls);
    for (const d of inside) {
      const ds = state.layers[d.id];
      if (!ds?.media?.playing) continue;
      point[d.id] = { opacity: ds.opacity.to, playing: true, inner: true };
      freeze(ds);
    }
  }
  state.timers = state.timers.filter((t) =>
    t.kind === 'pause'
      ? !gone.has(t.layerId)
      : !('layerId' in t.action) || !gone.has(t.action.layerId),
  );
  const count = counted(point);
  if (Object.keys(point).length) state.cleared = { ...state.cleared, [what]: point };
  ctx.events.push({ type: 'cleared', what, layers: count });
}

/** Layers a clear took, leaving out video it only paused inside a cleared frame. */
function counted(point: ClearPoint): number {
  return Object.values(point).filter((p) => !p.inner).length;
}

function unclear(ctx: Ctx, what: ClearKind, fade: number): void {
  const { state, now } = ctx;
  const point = state.cleared?.[what];
  if (!point) return warn(ctx, `Nothing to bring back: no ${what} was cleared since the last cue`);
  for (const [id, was] of Object.entries(point)) {
    const ls = state.layers[id];
    if (!ls) continue;
    ls.opacity = retarget(ls.opacity, was.opacity, now, fade, 'easeIn');
    if (was.playing && ls.media) Object.assign(ls.media, { playing: true, anchor: now });
  }
  const rest = { ...state.cleared };
  delete rest[what];
  state.cleared = rest;
  ctx.events.push({ type: 'uncleared', what, layers: counted(point) });
}

/**
 * Undo the operator's last GO: every layer fades from where it is now back to where it was
 * going before that GO, over the cue's own fade; standby, values and moments return too.
 * Blackout and Hold are left as they are, and nothing re-fires on its own.
 */
function back(ctx: Ctx): void {
  const { state, now } = ctx;
  const point = state.back;
  if (!point) return warn(ctx, 'Nothing to go back to');
  const target = reconcile(ctx.show, point.state);
  const cue = ctx.order.find((c) => c.id === point.cueId);
  const fade = cueFade(cue);
  for (const [id, layer] of Object.entries(target.layers)) {
    const current = state.layers[id];
    if (current)
      layer.opacity = retarget(current.opacity, layer.opacity.to, now, fade, 'easeInOut');
  }
  target.blackout = state.blackout;
  target.mute = state.mute ?? still(0);
  target.cleared = {};
  target.held = state.held;
  target.heldAt = state.heldAt;
  target.follow = null;
  target.timers = [];
  target.fired = state.fired;
  target.back = null;
  // Back undoes the cue, not tonight's running order.
  target.order = state.order ?? null;
  ctx.state = target;
  ctx.order = runOrder(ctx.show, target.order);
  if (!ctx.order.some((c) => c.id === target.standby))
    target.standby = nextAfter(ctx.order, target.lastFired);
  ctx.events.push({ type: 'back', cueId: point.cueId, name: cue?.name ?? '' });
}

/** The longest fade among a cue's show, hide and fade actions; 1 s when it has none. */
function cueFade(cue: Cue | undefined): number {
  const fades = (cue?.actions ?? []).flatMap((a) =>
    a.type === 'show' || a.type === 'hide' || a.type === 'fade' ? [a.duration] : [],
  );
  return fades.length ? Math.max(...fades) : 1;
}

function tick(ctx: Ctx): void {
  const { state, now } = ctx;
  const isDue = (t: (typeof state.timers)[number]) =>
    t.at <= now && !(state.held && t.kind === 'action');
  const due = state.timers.filter(isDue);
  state.timers = state.timers.filter((t) => !isDue(t));
  for (const t of due.sort((a, b) => a.at - b.at)) {
    if (t.kind === 'action') {
      // Start the delayed action at its scheduled time, so its fade is exact.
      ctx.now = t.at;
      applyAction(ctx, t.action);
      ctx.now = now;
      continue;
    }
    const media = state.layers[t.layerId]?.media;
    if (media?.playing) {
      media.position = mediaPosition(media, t.at);
      media.playing = false;
      media.anchor = now;
    }
  }
  if (state.held) return;
  for (const [id, m] of Object.entries(state.moments)) {
    if (m.status === 'open' && m.closesAt !== null && m.closesAt <= now) closeMoment(ctx, id);
  }
  if (state.follow && state.follow.at <= now) {
    const { cueId } = state.follow;
    state.follow = null;
    fireCue(ctx, cueId, 'follow');
  }
}

function fireCue(ctx: Ctx, cueId: string, source: InputSource): void {
  if (++ctx.fires > MAX_CUE_FIRES) {
    if (ctx.fires === MAX_CUE_FIRES + 1) warn(ctx, cueLoopWarning(ctx));
    ctx.state.follow = null;
    return;
  }
  if (!reach(ctx, cueId)) return warn(ctx, `Cue ${cueId} not found`);
  const { state, now } = ctx;
  const i = ctx.order.findIndex((c) => c.id === cueId);
  const cue = ctx.order[i]!;
  const next = ctx.order[i + 1] ?? null;
  state.lastFired = cue.id;
  state.standby = next?.id ?? null;
  // A new cue is a new picture: what the clears took is no longer worth bringing back.
  state.cleared = {};
  state.follow =
    cue.follow.auto && next ? { cueId: next.id, at: now + cue.follow.delay * 1000 } : null;
  state.fired += 1;
  state.access = accessAfter(state.access, cue);
  ctx.events.push({ type: 'cueFired', cueId: cue.id, name: cue.name, source });
  applyActions(ctx, cue.actions);
}

/** "Cues stopped: “A” and “B” fire each other with no time between (loop?)" */
function cueLoopWarning(ctx: Ctx): string {
  const fired = ctx.events.flatMap((e) => (e.type === 'cueFired' ? [`“${e.name}”`] : []));
  const names = [...new Set(fired.slice(-8))];
  if (names.length === 1)
    return `Cues stopped: ${names[0]} fires itself with no time between (loop?)`;
  if (names.length > 3) return `Cues stopped: more than ${MAX_CUE_FIRES} fired at once (loop?)`;
  const list = `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `Cues stopped: ${list} fire each other with no time between (loop?)`;
}

function applyActions(ctx: Ctx, actions: Action[]): void {
  for (const action of actions) {
    // Past the cue cap, the loop's remaining actions stop too, as its jumps unwind.
    if (ctx.fires > MAX_CUE_FIRES) return;
    const delay = 'delay' in action ? (action.delay ?? 0) : 0;
    if (delay > 0) {
      const timer: Timer = {
        at: ctx.now + delay * 1000,
        kind: 'action',
        action: { ...action, delay: 0 } as Action,
      };
      ctx.state.timers.push(timer);
      ctx.scheduled.add(timer);
    } else applyAction(ctx, action);
  }
}

function applyAction(ctx: Ctx, action: Action): void {
  const { state, now, show } = ctx;
  switch (action.type) {
    case 'show':
    case 'hide':
    case 'fade': {
      const ls = state.layers[action.layerId];
      const layer = show.layers.find((l) => l.id === action.layerId);
      if (!ls || !layer) return warn(ctx, `Layer ${action.layerId} not found`);
      const to =
        action.type === 'show' ? layer.opacity : action.type === 'hide' ? 0 : action.opacity;
      ls.opacity = retarget(ls.opacity, to, now, action.duration, action.easing);
      return;
    }
    case 'play': {
      const media = state.layers[action.layerId]?.media;
      if (!media) return warn(ctx, `Layer ${action.layerId} has no media to play`);
      const position = action.restart ? 0 : mediaPosition(media, now);
      Object.assign(media, { playing: true, position, anchor: now });
      state.timers = state.timers.filter((t) => t.kind !== 'pause' || t.layerId !== action.layerId);
      return;
    }
    case 'pause': {
      const media = state.layers[action.layerId]?.media;
      if (!media) return warn(ctx, `Layer ${action.layerId} has no media to pause`);
      Object.assign(media, { playing: false, position: mediaPosition(media, now), anchor: now });
      return;
    }
    case 'seek': {
      const media = state.layers[action.layerId]?.media;
      if (!media) return warn(ctx, `Layer ${action.layerId} has no media to seek`);
      Object.assign(media, { position: action.time, anchor: now });
      return;
    }
    case 'setText': {
      const ls = state.layers[action.layerId];
      const layer = show.layers.find((l) => l.id === action.layerId);
      if (!ls || layer?.kind !== 'text') return warn(ctx, `Layer ${action.layerId} has no text`);
      ls.text = action.text;
      return;
    }
    case 'counter': {
      const ls = state.layers[action.layerId];
      const layer = show.layers.find((l) => l.id === action.layerId);
      if (!ls?.counter || layer?.kind !== 'counter')
        return warn(ctx, `Layer ${action.layerId} is not a counter`);
      const c = ls.counter;
      const current = counterValue(c, layer.mode, now);
      if (action.op === 'start') Object.assign(c, { running: true, base: current, anchor: now });
      if (action.op === 'pause') Object.assign(c, { running: false, base: current, anchor: now });
      if (action.op === 'reset')
        Object.assign(c, { base: action.value ?? layer.start, anchor: now });
      if (action.op === 'add')
        Object.assign(c, { base: current + (action.value ?? 1), anchor: now });
      return;
    }
    case 'setVar':
      setVar(ctx, action.varId, action.value);
      return;
    case 'addVar': {
      const value = state.vars[action.varId];
      setVar(
        ctx,
        action.varId,
        (typeof value === 'number' ? value : Number(value) || 0) + action.amount,
      );
      return;
    }
    case 'jumpScene':
    case 'jumpSection': {
      const to = resolveJump(
        show,
        ctx.order,
        state,
        action.type === 'jumpScene'
          ? { to: 'scene', sceneId: action.sceneId }
          : { to: 'section', section: action.section },
      );
      if ('warning' in to) return warn(ctx, to.warning);
      jumpTo(ctx, to.cueId, action.fire);
      return;
    }
    case 'goToCue':
      jumpTo(ctx, action.cueId, action.fire);
      return;
    case 'openMoment':
      openMoment(ctx, action.momentId);
      return;
    case 'closeMoment':
      if (!momentDef(ctx, action.momentId))
        return warn(ctx, `Audience moment ${action.momentId} not found`);
      closeMoment(ctx, action.momentId);
      return;
    case 'stopAll': {
      // Frames fade their content with them and keep it for the next time they are shown, so
      // only what sits on the output fades. Every video still stops when the fade ends.
      const tree = layerTree(show.layers);
      for (const [id, ls] of Object.entries(state.layers)) {
        if (!tree.parent(id)) ls.opacity = retarget(ls.opacity, 0, now, action.duration, 'linear');
        if (ls.media?.playing) {
          state.timers = state.timers.filter((t) => t.kind !== 'pause' || t.layerId !== id);
          state.timers.push({ at: now + action.duration * 1000, kind: 'pause', layerId: id });
        }
      }
      // Delayed actions from earlier cues would bring layers back after the fade; the ones this
      // step scheduled (this cue's own) still run.
      state.timers = state.timers.filter((t) => t.kind !== 'action' || ctx.scheduled.has(t));
      state.follow = null;
      return;
    }
    case 'branch':
      applyActions(ctx, evaluateAll(action.if, state.vars) ? action.then : action.else);
      return;
  }
}

function jumpTo(ctx: Ctx, cueId: string, fire: boolean, source: InputSource = 'rule'): void {
  if (!reach(ctx, cueId)) return warn(ctx, `Cue ${cueId} not found`);
  ctx.state.follow = null;
  if (fire) fireCue(ctx, cueId, source);
  else ctx.state.standby = cueId;
}

/** The cue after `cueId` in this order; the first cue when nothing has fired. */
function nextAfter(order: Cue[], cueId: string | null): string | null {
  if (!cueId) return order[0]?.id ?? null;
  const i = order.findIndex((c) => c.id === cueId);
  return i < 0 ? null : (order[i + 1]?.id ?? null);
}

/**
 * Make sure a cue plays tonight. A jump or standby into a skipped scene brings it back, right
 * after the scene that is live. False when the cue doesn't exist.
 */
function reach(ctx: Ctx, cueId: string): boolean {
  if (ctx.order.some((c) => c.id === cueId)) return true;
  const order = ctx.state.order ?? null;
  const cue = ctx.show.cues.find((c) => c.id === cueId);
  if (!order || !cue || !ctx.show.scenes.some((s) => s.id === cue.sceneId)) return false;
  const scenes = sceneSequence(ctx.show, order).filter((id) => id !== cue.sceneId);
  const live = ctx.show.cues.find((c) => c.id === ctx.state.lastFired)?.sceneId;
  scenes.splice(live ? scenes.indexOf(live) + 1 : 0, 0, cue.sceneId);
  setRunOrder(ctx, { scenes, skipped: order.skipped.filter((id) => id !== cue.sceneId) });
  return ctx.order.some((c) => c.id === cueId);
}

/**
 * Change tonight's running order. What is live can't be skipped. "Next" moves with the order,
 * unless the operator had put something else on standby that still plays; an auto-follow does too.
 */
function setRunOrder(ctx: Ctx, next: RunOrder | null): void {
  const { state } = ctx;
  const prev = state.order ?? null;
  const live = ctx.show.cues.find((c) => c.id === state.lastFired)?.sceneId;
  const order = next && {
    scenes: [...next.scenes],
    skipped: next.skipped.filter((id) => id !== live),
  };
  const wasNext = nextAfter(ctx.order, state.lastFired);
  state.order = order;
  ctx.order = runOrder(ctx.show, order);
  const plays = (id: string | null) => !!id && ctx.order.some((c) => c.id === id);
  const isNext = nextAfter(ctx.order, state.lastFired);
  if (state.standby === wasNext || !plays(state.standby)) state.standby = isNext;
  if (state.follow && (state.follow.cueId === wasNext || !plays(state.follow.cueId)))
    state.follow = isNext ? { ...state.follow, cueId: isNext } : null;
  ctx.events.push({ type: 'orderChanged', prev, order });
}

function momentDef(ctx: Ctx, id: string): Moment | undefined {
  return ctx.show.moments.find((m) => m.id === id);
}

function openMoment(ctx: Ctx, momentId: string): void {
  const def = momentDef(ctx, momentId);
  if (!def) return warn(ctx, `Audience moment ${momentId} not found`);
  ctx.state.moments[momentId] = {
    ...idleMoment(),
    status: 'open',
    openedAt: ctx.now,
    closesAt: def.durationSec > 0 ? ctx.now + def.durationSec * 1000 : null,
  };
  ctx.events.push({ type: 'momentOpened', momentId });
}

function closeMoment(ctx: Ctx, momentId: string, override?: VarValue): void {
  const def = momentDef(ctx, momentId);
  const m = ctx.state.moments[momentId];
  if (!def || !m || m.status !== 'open') return;
  const { result, usedDefault } =
    override !== undefined ? { result: override, usedDefault: false } : resultOf(def, m);
  m.status = 'closed';
  m.closesAt = null;
  m.result = result;
  m.usedDefault = usedDefault;
  if (def.resultVarId) setVar(ctx, def.resultVarId, result);
  const tally = tallyOf(def, m);
  if (def.tallyVarId && tally) setVar(ctx, def.tallyVarId, tally);
  ctx.events.push({ type: 'momentClosed', momentId, result, usedDefault });
}

function resultOf(def: Moment, m: MomentStateLike): { result: VarValue; usedDefault: boolean } {
  const fallback = { result: def.defaultResult as VarValue, usedDefault: true };
  switch (def.type) {
    case 'vote': {
      let best: string | null = null;
      for (const opt of def.options) {
        const votes = m.tally[opt.id] ?? 0;
        if (votes > 0 && (best === null || votes > (m.tally[best] ?? 0))) best = opt.id;
      }
      return best === null ? fallback : { result: best, usedDefault: false };
    }
    case 'tap':
      return m.count > 0 ? { result: m.count, usedDefault: false } : fallback;
    case 'slider':
      return m.n > 0 ? { result: round(m.sum / m.n), usedDefault: false } : fallback;
    case 'text': {
      const texts = approvedTexts(m.entries);
      return texts.length ? { result: texts, usedDefault: false } : fallback;
    }
    case 'prop':
      return m.n > 0 ? { result: m.n, usedDefault: false } : fallback;
  }
}

type MomentStateLike = EngineState['moments'][string];

function tallyOf(def: Moment, m: MomentStateLike): Record<string, number> | null {
  switch (def.type) {
    case 'vote':
      return Object.fromEntries(def.options.map((o) => [o.id, m.tally[o.id] ?? 0]));
    case 'prop':
      return Object.fromEntries(def.variants.map((v) => [v.id, m.tally[v.id] ?? 0]));
    case 'slider': {
      if (!m.n) return { average: 0, spread: 0, n: 0 };
      const mean = m.sum / m.n;
      const spread = Math.sqrt(Math.max(0, m.sumSq / m.n - mean * mean));
      return { average: round(mean), spread: round(spread), n: m.n };
    }
    default:
      return null;
  }
}

/** One source's totals, created empty. A moment from an older journal kept everything as relay. */
function sourceOf(m: MomentState, source: TallySource): MomentAggregate {
  if (!m.sources) {
    const { tally, count, sum, sumSq, n } = m;
    m.sources = { relay: { tally: { ...tally }, count, sum, sumSq, n } };
  }
  return (m.sources[source] ??= emptyAggregate());
}

/** The moment's totals are the sum of its sources; then its live values follow. */
function settleSources(ctx: Ctx, def: Moment, m: MomentState): void {
  const total = emptyAggregate();
  for (const a of Object.values(m.sources ?? {})) {
    for (const [k, n] of Object.entries(a.tally)) total.tally[k] = (total.tally[k] ?? 0) + n;
    total.count += a.count;
    total.sum += a.sum;
    total.sumSq += a.sumSq;
    total.n += a.n;
  }
  Object.assign(m, total);
  liveValues(ctx, def, m);
}

function countVote(ctx: Ctx, input: Extract<EngineInput, { type: 'countVote' }>): void {
  const countable = (id: string) => ['vote', 'tap'].includes(momentDef(ctx, id)?.type ?? '');
  const newest = Object.entries(ctx.state.moments)
    .filter(([id, m]) => m.status === 'open' && countable(id))
    .sort(([, a], [, b]) => (b.openedAt ?? 0) - (a.openedAt ?? 0))[0]?.[0];
  const id = input.momentId || newest;
  const def = id ? momentDef(ctx, id) : undefined;
  const m = id ? ctx.state.moments[id] : undefined;
  if (!def || !m || m.status !== 'open' || !countable(def.id))
    return warn(ctx, 'A vote was counted, but no vote or tap moment is open');
  const amount = input.amount ?? 1;
  const src = sourceOf(m, input.source ?? 'buttons');
  if (def.type === 'tap') src.count = Math.max(0, src.count + amount);
  else {
    const opt = input.optionId
      ? def.options.find((o) => o.id === input.optionId)
      : def.options[(input.option ?? 1) - 1];
    if (!opt) return warn(ctx, `${def.name} has no option ${input.optionId ?? input.option}`);
    const before = src.tally[opt.id] ?? 0;
    const after = Math.max(0, before + amount);
    src.tally[opt.id] = after;
    src.n = Math.max(0, src.n + after - before);
  }
  settleSources(ctx, def, m);
}

function aggregate(ctx: Ctx, input: Extract<EngineInput, { type: 'momentAgg' }>): void {
  const def = momentDef(ctx, input.momentId);
  const m = ctx.state.moments[input.momentId];
  if (!def || !m || m.status !== 'open') return;
  // Running totals replace only their own source, so buttons and pretend phones add to phones.
  const src = sourceOf(m, input.source ?? 'relay');
  src.tally = input.tally ?? src.tally;
  src.count = input.count ?? src.count;
  src.sum = input.sum ?? src.sum;
  src.sumSq = input.sumSq ?? src.sumSq;
  src.n = input.n ?? src.n;
  for (const e of input.entries ?? []) {
    if (m.entries.some((x) => x.id === e.id)) continue;
    m.entries.push({
      id: e.id,
      text: e.text.slice(0, 280),
      status: def.moderated ? 'pending' : 'approved',
    });
  }
  settleSources(ctx, def, m);
}

/** Live values, so a tally bar or score on stage moves while the moment is open. */
function liveValues(ctx: Ctx, def: Moment, m: MomentState): void {
  const tally = tallyOf(def, m);
  if (def.tallyVarId && tally) setVar(ctx, def.tallyVarId, tally);
  if (def.resultVarId) {
    if (def.type === 'tap') setVar(ctx, def.resultVarId, m.count);
    if (def.type === 'slider' && m.n) setVar(ctx, def.resultVarId, round(m.sum / m.n));
    if (def.type === 'text' && !def.moderated)
      setVar(ctx, def.resultVarId, approvedTexts(m.entries));
  }
}

function approvedTexts(entries: { text: string; status: string }[]): string[] {
  return entries.filter((e) => e.status === 'approved').map((e) => e.text);
}

function setVar(ctx: Ctx, varId: string, value: VarValue): void {
  if (!ctx.show.vars.some((v) => v.id === varId))
    return warn(ctx, `State value ${varId} not found`);
  const prev = ctx.state.vars[varId];
  if (JSON.stringify(prev) === JSON.stringify(value)) return;
  ctx.state.vars[varId] = structuredClone(value);
  ctx.events.push({ type: 'varChanged', varId, value });
}

function warn(ctx: Ctx, message: string): void {
  ctx.events.push({ type: 'warning', message });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Run rules on the events from index `from` on; returns how far they got. */
function runRules(ctx: Ctx, from: number): number {
  const rules = ctx.show.rules.filter((r) => r.enabled);
  if (!rules.length || ctx.ruleEvents > MAX_RULE_EVENTS) return ctx.events.length;
  for (let i = from; i < ctx.events.length; i++) {
    const event = ctx.events[i]!;
    // Traces describe rules; they never trigger them.
    if (event.type === 'ruleEvaluated') continue;
    if (++ctx.ruleEvents > MAX_RULE_EVENTS) {
      ctx.events.push({
        type: 'warning',
        message: 'Rules stopped: too many chained events (loop?)',
      });
      return ctx.events.length;
    }
    for (const rule of rules) {
      if (!matches(rule.when, event)) continue;
      const checks = explain(rule.if, ctx.state.vars);
      const ran = checks.every((c) => c.ok);
      ctx.events.push({ type: 'ruleEvaluated', ruleId: rule.id, ran, checks });
      if (ran) applyActions(ctx, rule.then);
    }
  }
  return ctx.events.length;
}

function matches(when: Show['rules'][number]['when'], e: EngineEvent): boolean {
  switch (when.type) {
    case 'trigger':
      return e.type === 'trigger' && e.triggerId === when.triggerId;
    case 'momentClosed':
      return e.type === 'momentClosed' && e.momentId === when.momentId;
    case 'varChanged':
      return e.type === 'varChanged' && e.varId === when.varId;
    case 'cueFired':
      return e.type === 'cueFired' && e.cueId === when.cueId;
    case 'mediaEnded':
      return e.type === 'mediaEnded' && e.layerId === when.layerId;
  }
}
