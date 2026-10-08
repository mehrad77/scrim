import type { Action, Cue, Moment, Show, VarValue } from '@scrim/format';
import { cueOrder } from '@scrim/format';
import { evaluateAll, explain } from './conditions.js';
import {
  counterValue,
  idleMoment,
  initialState,
  mediaPosition,
  reconcile,
  type EngineState,
} from './state.js';
import { retarget } from './tween.js';
import type { EngineEvent, EngineInput, InputSource } from './types.js';

const MAX_RULE_EVENTS = 200;

interface Ctx {
  show: Show;
  state: EngineState;
  now: number;
  events: EngineEvent[];
  order: Cue[];
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
  const ctx: Ctx = { show, state: structuredClone(prev), now, events: [], order: cueOrder(show) };
  applyInput(ctx, input);
  runRules(ctx);
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
      if (ctx.order.some((c) => c.id === input.cueId)) state.standby = input.cueId;
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
    case 'reset':
      ctx.state = initialState(ctx.show);
      ctx.events.push({ type: 'reset' });
      return;
    case 'back':
      back(ctx);
      return;
  }
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
  target.held = state.held;
  target.heldAt = state.heldAt;
  target.follow = null;
  target.timers = [];
  target.fired = state.fired;
  target.back = null;
  ctx.state = target;
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
  const { state, now } = ctx;
  const i = ctx.order.findIndex((c) => c.id === cueId);
  const cue = ctx.order[i];
  if (!cue) return warn(ctx, `Cue ${cueId} not found`);
  const next = ctx.order[i + 1] ?? null;
  state.lastFired = cue.id;
  state.standby = next?.id ?? null;
  state.follow =
    cue.follow.auto && next ? { cueId: next.id, at: now + cue.follow.delay * 1000 } : null;
  state.fired += 1;
  ctx.events.push({ type: 'cueFired', cueId: cue.id, name: cue.name, source });
  applyActions(ctx, cue.actions);
}

function applyActions(ctx: Ctx, actions: Action[]): void {
  for (const action of actions) {
    const delay = 'delay' in action ? (action.delay ?? 0) : 0;
    if (delay > 0) {
      ctx.state.timers.push({
        at: ctx.now + delay * 1000,
        kind: 'action',
        action: { ...action, delay: 0 } as Action,
      });
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
      if (!media) return;
      Object.assign(media, { playing: false, position: mediaPosition(media, now), anchor: now });
      return;
    }
    case 'seek': {
      const media = state.layers[action.layerId]?.media;
      if (media) Object.assign(media, { position: action.time, anchor: now });
      return;
    }
    case 'setText': {
      const ls = state.layers[action.layerId];
      if (ls) ls.text = action.text;
      return;
    }
    case 'counter': {
      const ls = state.layers[action.layerId];
      const layer = show.layers.find((l) => l.id === action.layerId);
      if (!ls?.counter || layer?.kind !== 'counter') return;
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
    case 'jumpScene': {
      const first = ctx.order.find((c) => c.sceneId === action.sceneId);
      if (!first) return warn(ctx, `Scene ${action.sceneId} has no cues`);
      jumpTo(ctx, first.id, action.fire);
      return;
    }
    case 'goToCue':
      jumpTo(ctx, action.cueId, action.fire);
      return;
    case 'openMoment':
      openMoment(ctx, action.momentId);
      return;
    case 'closeMoment':
      closeMoment(ctx, action.momentId);
      return;
    case 'stopAll': {
      for (const [id, ls] of Object.entries(state.layers)) {
        ls.opacity = retarget(ls.opacity, 0, now, action.duration, 'linear');
        if (ls.media?.playing) {
          state.timers = state.timers.filter((t) => t.kind !== 'pause' || t.layerId !== id);
          state.timers.push({ at: now + action.duration * 1000, kind: 'pause', layerId: id });
        }
      }
      state.follow = null;
      return;
    }
    case 'branch':
      applyActions(ctx, evaluateAll(action.if, state.vars) ? action.then : action.else);
      return;
  }
}

function jumpTo(ctx: Ctx, cueId: string, fire: boolean): void {
  if (!ctx.order.some((c) => c.id === cueId)) return warn(ctx, `Cue ${cueId} not found`);
  ctx.state.follow = null;
  if (fire) fireCue(ctx, cueId, 'rule');
  else ctx.state.standby = cueId;
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

function aggregate(ctx: Ctx, input: Extract<EngineInput, { type: 'momentAgg' }>): void {
  const def = momentDef(ctx, input.momentId);
  const m = ctx.state.moments[input.momentId];
  if (!def || !m || m.status !== 'open') return;
  m.tally = input.tally ?? m.tally;
  m.count = input.count ?? m.count;
  m.sum = input.sum ?? m.sum;
  m.sumSq = input.sumSq ?? m.sumSq;
  m.n = input.n ?? m.n;
  for (const e of input.entries ?? []) {
    if (m.entries.some((x) => x.id === e.id)) continue;
    m.entries.push({
      id: e.id,
      text: e.text.slice(0, 280),
      status: def.moderated ? 'pending' : 'approved',
    });
  }
  // Live values, so a tally bar or score on stage moves while the moment is open.
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

function runRules(ctx: Ctx): void {
  const rules = ctx.show.rules.filter((r) => r.enabled);
  if (!rules.length) return;
  let seen = 0;
  for (let i = 0; i < ctx.events.length; i++) {
    const event = ctx.events[i]!;
    // Traces describe rules; they never trigger them.
    if (event.type === 'ruleEvaluated') continue;
    if (++seen > MAX_RULE_EVENTS) {
      ctx.events.push({
        type: 'warning',
        message: 'Rules stopped: too many chained events (loop?)',
      });
      return;
    }
    for (const rule of rules) {
      if (!matches(rule.when, event)) continue;
      const checks = explain(rule.if, ctx.state.vars);
      const ran = checks.every((c) => c.ok);
      ctx.events.push({ type: 'ruleEvaluated', ruleId: rule.id, ran, checks });
      if (ran) applyActions(ctx, rule.then);
    }
  }
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
