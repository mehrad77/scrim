import { optionLabels } from '@scrim/engine';
import {
  cueOrder,
  descendantsOf,
  layerTree,
  type Action,
  type Condition,
  type Cue,
  type RuleWhen,
  type Show,
} from '@scrim/format';

/**
 * The show's logic, made visible (UX principle 7): rule sentences, the scene map, cue exits,
 * "used by N" counts and the logic check. Everything here is derived from the show and pure.
 */

/** Every action in a list, including those nested inside branches. */
export function flatActions(actions: Action[]): Action[] {
  return actions.flatMap((a) =>
    a.type === 'branch' ? [a, ...flatActions(a.then), ...flatActions(a.else)] : [a],
  );
}

const nameOf = (list: { id: string; name: string }[], id: string) =>
  list.find((x) => x.id === id)?.name;

// ---- words ----

export const OP_TEXT: Record<Condition['op'], string> = {
  eq: 'is',
  neq: 'is not',
  gt: 'is more than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  contains: 'contains',
};

/** A condition value as people read it: a vote option's label, never its key. */
export function valueLabel(show: Show, varId: string, value: string | number): string {
  const labels = optionLabels(show, varId);
  const key = String(value);
  return Object.hasOwn(labels, key) ? labels[key]! : key;
}

export function conditionText(show: Show, c: Condition): string {
  return `${nameOf(show.vars, c.varId) ?? 'a missing value'} ${OP_TEXT[c.op]} ${valueLabel(show, c.varId, c.value)}`;
}

/** "Door vote closes", "Bell is pressed": the trigger half of a rule sentence. */
export function whenText(show: Show, when: RuleWhen): string {
  switch (when.type) {
    case 'trigger':
      return `${nameOf(show.triggers, when.triggerId) ?? 'a trigger'} is pressed`;
    case 'momentClosed':
      return `${nameOf(show.moments, when.momentId) ?? 'a moment'} closes`;
    case 'varChanged':
      return `${nameOf(show.vars, when.varId) ?? 'a value'} changes`;
    case 'cueFired': {
      const order = cueOrder(show);
      const i = order.findIndex((c) => c.id === when.cueId);
      return i < 0 ? 'a cue fires' : `cue ${i + 1} “${order[i]!.name}” fires`;
    }
    case 'mediaEnded':
      return `${nameOf(show.layers, when.layerId) ?? 'media'} finishes`;
  }
}

/** A stable key for grouping rules that share a trigger. */
export function whenKey(when: RuleWhen): string {
  const { type, ...rest } = when;
  return `${type}:${Object.values(rest)[0] ?? ''}`;
}

/** Where a jump goes, by scene. `null` when the target no longer exists. */
function jumpTarget(show: Show, a: Action): string | null | undefined {
  if (a.type === 'jumpScene') return show.scenes.some((s) => s.id === a.sceneId) ? a.sceneId : null;
  if (a.type === 'goToCue') return show.cues.find((c) => c.id === a.cueId)?.sceneId ?? null;
  return undefined;
}

// ---- scene graph ----

export interface SceneEdge {
  /** The scene the show leaves from; `null` when anything can fire it (a trigger, a value). */
  from: string | null;
  to: string;
  kind: 'next' | 'jump' | 'rule';
  label: string;
  cueId?: string;
  ruleId?: string;
}

export interface SceneGraph {
  /** Scenes that have cues, in running order. */
  scenes: Show['scenes'];
  edges: SceneEdge[];
  start: string | null;
  reachable: Set<string>;
}

/** The cues that open a moment. */
export function openersOf(show: Show, momentId: string): Cue[] {
  return cueOrder(show).filter((c) =>
    flatActions(c.actions).some((a) => a.type === 'openMoment' && a.momentId === momentId),
  );
}

function ruleSources(show: Show, when: RuleWhen): (string | null)[] {
  if (when.type === 'momentClosed') {
    const from = openersOf(show, when.momentId).map((c) => c.sceneId);
    return from.length ? [...new Set(from)] : [];
  }
  if (when.type === 'cueFired') {
    const cue = show.cues.find((c) => c.id === when.cueId);
    return cue ? [cue.sceneId] : [];
  }
  return [null];
}

export function sceneGraph(show: Show): SceneGraph {
  const order = cueOrder(show);
  const withCues = new Set(order.map((c) => c.sceneId));
  const scenes = show.scenes.filter((s) => withCues.has(s.id));
  const edges: SceneEdge[] = [];

  scenes.forEach((s, i) => {
    const cues = order.filter((c) => c.sceneId === s.id);
    for (const cue of cues) {
      for (const a of flatActions(cue.actions)) {
        const to = jumpTarget(show, a);
        if (to && to !== s.id)
          edges.push({ from: s.id, to, kind: 'jump', label: cue.name, cueId: cue.id });
      }
    }
    // The last cue hands over to the next scene unless it always jumps somewhere else.
    const last = cues.at(-1);
    const next = scenes[i + 1];
    const alwaysJumps = last?.actions.some((a) => a.type === 'jumpScene' || a.type === 'goToCue');
    if (next && !alwaysJumps) edges.push({ from: s.id, to: next.id, kind: 'next', label: 'then' });
  });

  for (const rule of show.rules) {
    if (!rule.enabled) continue;
    const label = rule.if.length
      ? rule.if.map((c) => conditionText(show, c)).join(' and ')
      : rule.name;
    for (const a of flatActions(rule.then)) {
      const to = jumpTarget(show, a);
      if (!to) continue;
      for (const from of ruleSources(show, rule.when)) {
        if (from !== to) edges.push({ from, to, kind: 'rule', label, ruleId: rule.id });
      }
    }
  }

  const start = order[0]?.sceneId ?? null;
  const reachable = new Set<string>(start ? [start] : []);
  for (let grew = true; grew;) {
    grew = false;
    for (const e of edges) {
      if ((e.from === null ? !!start : reachable.has(e.from)) && !reachable.has(e.to)) {
        reachable.add(e.to);
        grew = true;
      }
    }
  }
  return { scenes, edges, start, reachable };
}

/** Where the show can go after this cue, besides the next cue: "→ Cellar | Attic". */
export function cueExits(show: Show, cue: Cue): string[] {
  const to = new Set<string>();
  for (const a of flatActions(cue.actions)) {
    const t = jumpTarget(show, a);
    if (t) to.add(t);
  }
  const opens = new Set(
    flatActions(cue.actions).flatMap((a) => (a.type === 'openMoment' ? [a.momentId] : [])),
  );
  for (const rule of show.rules) {
    if (!rule.enabled) continue;
    const w = rule.when;
    const mine =
      (w.type === 'momentClosed' && opens.has(w.momentId)) ||
      (w.type === 'cueFired' && w.cueId === cue.id);
    if (!mine) continue;
    for (const a of flatActions(rule.then)) {
      const t = jumpTarget(show, a);
      if (t) to.add(t);
    }
  }
  return [...to].map((id) => nameOf(show.scenes, id) ?? '?');
}

// ---- reads, writes and usage ----

const placeholder = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
const namesIn = (text: string) => [...text.matchAll(placeholder)].map((m) => m[1]!);

/** Which vars something reads, writes, and how often each moment and trigger is used. */
export function usage(show: Show) {
  const reads = new Map<string, number>();
  const writes = new Map<string, number>();
  const uses = new Map<string, number>();
  const bump = (m: Map<string, number>, id: string) => m.set(id, (m.get(id) ?? 0) + 1);
  const byName = new Map(show.vars.map((v) => [v.name, v.id]));
  const readText = (text: string) => {
    for (const n of namesIn(text)) {
      const id = byName.get(n);
      if (id) bump(reads, id);
    }
  };
  const walk = (actions: Action[]) => {
    for (const a of actions) {
      if (a.type === 'setVar' || a.type === 'addVar') bump(writes, a.varId);
      if (a.type === 'setText') readText(a.text);
      if (a.type === 'branch') for (const c of a.if) bump(reads, c.varId);
      if (a.type === 'openMoment' || a.type === 'closeMoment') bump(uses, a.momentId);
    }
  };
  for (const c of show.cues) walk(flatActions(c.actions));
  for (const r of show.rules) {
    walk(flatActions(r.then));
    for (const c of r.if) bump(reads, c.varId);
    const w = r.when;
    if (w.type === 'varChanged') bump(reads, w.varId);
    if (w.type === 'momentClosed') bump(uses, w.momentId);
    if (w.type === 'trigger') bump(uses, w.triggerId);
  }
  for (const l of show.layers) {
    if (l.kind === 'text') readText(l.text);
    if (l.kind === 'state' && l.varId) bump(reads, l.varId);
  }
  for (const m of show.moments) {
    if (m.resultVarId) bump(writes, m.resultVarId);
    if (m.tallyVarId) bump(writes, m.tallyVarId);
  }
  for (const b of [...show.inputs.keys, ...show.inputs.midi, ...show.inputs.gamepad]) {
    if (b.command.type === 'trigger') bump(uses, b.command.triggerId);
  }
  const of = (m: Map<string, number>, id: string) => m.get(id) ?? 0;
  return {
    reads: (id: string) => of(reads, id),
    writes: (id: string) => of(writes, id),
    /** "Used by N": reads and writes for a value; cues, rules and bindings otherwise. */
    usedBy: (id: string) => of(reads, id) + of(writes, id) + of(uses, id),
  };
}

// ---- logic check ----

export interface LogicIssue {
  /** Stable across runs, for keys and dismissals. */
  id: string;
  /** The tab whose count it adds to. */
  area: 'stage' | 'cues' | 'interaction';
  text: string;
  layerId?: string;
  ruleId?: string;
  momentId?: string;
  sceneId?: string;
  cueId?: string;
  varId?: string;
  triggerId?: string;
}

/** Vote options some rule or branch tests for, by result value. */
function handledOptions(show: Show, varId: string): Set<string> | null {
  const conds = [
    ...show.rules.filter((r) => r.enabled).flatMap((r) => r.if),
    ...[...show.cues.flatMap((c) => c.actions), ...show.rules.flatMap((r) => r.then)]
      .flatMap((a) => flatActions([a]))
      .flatMap((a) => (a.type === 'branch' ? a.if : [])),
  ].filter((c) => c.varId === varId && c.op === 'eq');
  return conds.length ? new Set(conds.map((c) => String(c.value))) : null;
}

/** Options of a vote that its branching never handles. */
export function unhandledOptions(show: Show, momentId: string) {
  const m = show.moments.find((x) => x.id === momentId);
  if (!m || m.type !== 'vote' || !m.resultVarId) return [];
  const handled = handledOptions(show, m.resultVarId);
  return handled ? m.options.filter((o) => !handled.has(o.id)) : [];
}

function brokenRefs(show: Show, actions: Action[]): string[] {
  const has = (list: { id: string }[], id: string) => list.some((x) => x.id === id);
  const out: string[] = [];
  for (const a of flatActions(actions)) {
    if ('layerId' in a && !has(show.layers, a.layerId)) out.push('a layer that was deleted');
    if ('varId' in a && !has(show.vars, a.varId)) out.push('a value that was deleted');
    if ('momentId' in a && !has(show.moments, a.momentId)) out.push('a moment that was deleted');
    if (a.type === 'jumpScene' && !has(show.scenes, a.sceneId))
      out.push('a scene that was deleted');
    if (
      a.type === 'jumpScene' &&
      has(show.scenes, a.sceneId) &&
      !show.cues.some((c) => c.sceneId === a.sceneId)
    )
      out.push(`the scene “${nameOf(show.scenes, a.sceneId)}”, which has no cues`);
    if (a.type === 'goToCue' && !has(show.cues, a.cueId)) out.push('a cue that was deleted');
    if (a.type === 'jumpSection') {
      const want = a.section.trim().toLowerCase();
      if (!want) out.push('a section, but none is named');
      else if (!show.cues.some((c) => c.section?.trim().toLowerCase() === want))
        out.push(`the section “${a.section.trim()}”, which no cue has`);
    }
    if (a.type === 'branch')
      for (const c of a.if) if (!has(show.vars, c.varId)) out.push('a value that was deleted');
  }
  return [...new Set(out)];
}

function whenMissing(show: Show, when: RuleWhen): string | null {
  const ok = (list: { id: string }[], id: string) => list.some((x) => x.id === id);
  switch (when.type) {
    case 'trigger':
      return ok(show.triggers, when.triggerId) ? null : 'choose a trigger';
    case 'momentClosed':
      return ok(show.moments, when.momentId) ? null : 'choose a moment';
    case 'varChanged':
      return ok(show.vars, when.varId) ? null : 'choose a value';
    case 'cueFired':
      return ok(show.cues, when.cueId) ? null : 'choose a cue';
    case 'mediaEnded':
      return ok(show.layers, when.layerId) ? null : 'choose a media layer';
  }
}

/** Rules that can keep re-triggering each other through value changes. */
function loopingRules(show: Show): Set<string> {
  const rules = show.rules.filter((r) => r.enabled && r.when.type === 'varChanged');
  const writesOf = (r: (typeof rules)[number]) =>
    flatActions(r.then).flatMap((a) =>
      a.type === 'setVar' || a.type === 'addVar' ? [a.varId] : [],
    );
  const next = new Map<string, string[]>();
  for (const r of rules) {
    const v = (r.when as { varId: string }).varId;
    next.set(v, [...(next.get(v) ?? []), ...writesOf(r)]);
  }
  const inCycle = new Set<string>();
  for (const startVar of next.keys()) {
    const seen = new Set<string>();
    const stack = [...(next.get(startVar) ?? [])];
    while (stack.length) {
      const v = stack.pop()!;
      if (v === startVar) {
        inCycle.add(startVar);
        break;
      }
      if (seen.has(v)) continue;
      seen.add(v);
      stack.push(...(next.get(v) ?? []));
    }
  }
  return new Set(
    rules.filter((r) => inCycle.has((r.when as { varId: string }).varId)).map((r) => r.id),
  );
}

/**
 * Groups of cues that can fire each other with no time between: jumps that fire, zero-second
 * follows, and rules on a cue firing that jump. The engine stops such a loop, but it is a mistake.
 */
export function zeroTimeLoops(show: Show): Cue[][] {
  const order = cueOrder(show);
  const index = new Map(order.map((c, i) => [c.id, i]));
  const fires = (actions: Action[]) =>
    flatActions(actions).flatMap((a) => {
      if (a.type === 'goToCue' && a.fire && index.has(a.cueId)) return [a.cueId];
      if (a.type === 'jumpScene' && a.fire) {
        const first = order.find((c) => c.sceneId === a.sceneId);
        return first ? [first.id] : [];
      }
      return [];
    });
  const next = new Map<string, string[]>();
  order.forEach((cue, i) => {
    const out = fires(cue.actions);
    // A jump or Fade all at the top of the cue cancels its follow.
    const cancels = cue.actions.some(
      (a) => a.type === 'jumpScene' || a.type === 'goToCue' || a.type === 'stopAll',
    );
    const after = order[i + 1];
    if (cue.follow.auto && cue.follow.delay === 0 && after && !cancels) out.push(after.id);
    for (const r of show.rules)
      if (r.enabled && r.when.type === 'cueFired' && r.when.cueId === cue.id)
        out.push(...fires(r.then));
    next.set(cue.id, out);
  });

  // Tarjan's strongly connected components; a component is a loop if it has a cycle.
  const loops: Cue[][] = [];
  const low = new Map<string, number>();
  const seen = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  let counter = 0;
  const visit = (id: string): void => {
    seen.set(id, counter);
    low.set(id, counter++);
    stack.push(id);
    onStack.add(id);
    for (const to of next.get(id) ?? []) {
      if (!seen.has(to)) {
        visit(to);
        low.set(id, Math.min(low.get(id)!, low.get(to)!));
      } else if (onStack.has(to)) low.set(id, Math.min(low.get(id)!, seen.get(to)!));
    }
    if (low.get(id) !== seen.get(id)) return;
    const group: string[] = [];
    for (let top = stack.pop()!; ; top = stack.pop()!) {
      onStack.delete(top);
      group.push(top);
      if (top === id) break;
    }
    if (group.length > 1 || next.get(id)!.includes(id))
      loops.push(
        group.map((g) => order[index.get(g)!]!).sort((a, b) => index.get(a.id)! - index.get(b.id)!),
      );
  };
  for (const cue of order) if (!seen.has(cue.id)) visit(cue.id);
  return loops;
}

/**
 * Problems a creative author should know about before an audience finds them: unhandled options,
 * unreachable scenes, broken references, values written but never read, and possible loops.
 */
/** Frame links the renderer had to repair, and frames whose content can never be seen. */
function frameIssues(show: Show): LogicIssue[] {
  const issues: LogicIssue[] = [];
  const tree = layerTree(show.layers);
  for (const l of show.layers) {
    if (!l.parentId) continue;
    const p = show.layers.find((x) => x.id === l.parentId);
    const problem = !p
      ? 'its frame was deleted'
      : p.kind !== 'frame'
        ? `“${p.name}” is not a frame`
        : l.kind === 'audio'
          ? 'sound can’t sit in a frame'
          : p.outputId !== l.outputId
            ? `its frame “${p.name}” is on another output`
            : tree.parent(l.id)?.id !== p.id
              ? `it and “${p.name}” sit inside each other`
              : null;
    if (problem)
      issues.push({
        id: `frame:${l.id}`,
        area: 'stage',
        layerId: l.id,
        text: `“${l.name}” is drawn straight on the output: ${problem}`,
      });
  }
  const actions = [...show.cues.flatMap((c) => c.actions), ...show.rules.flatMap((r) => r.then)];
  const shown = new Set(
    flatActions(actions).flatMap((a) =>
      a.type === 'show' || (a.type === 'fade' && a.opacity > 0) ? [a.layerId] : [],
    ),
  );
  for (const f of show.layers)
    if (
      f.kind === 'frame' &&
      !f.visible &&
      !shown.has(f.id) &&
      descendantsOf(tree, f.id).length > 0
    )
      issues.push({
        id: `hidden-frame:${f.id}`,
        area: 'cues',
        layerId: f.id,
        text: `Frame “${f.name}” never appears, so nothing inside it can be seen: show it in a cue`,
      });
  return issues;
}

export function checkLogic(show: Show): LogicIssue[] {
  const issues: LogicIssue[] = [];
  const use = usage(show);

  for (const m of show.moments) {
    for (const o of unhandledOptions(show, m.id))
      issues.push({
        id: `unhandled:${m.id}:${o.id}`,
        area: 'interaction',
        momentId: m.id,
        text: `${m.name}: nothing happens when “${o.label}” wins`,
      });
    if (
      !show.cues.some((c) =>
        flatActions(c.actions).some((a) => a.type === 'openMoment' && a.momentId === m.id),
      ) &&
      !show.rules.some((r) =>
        flatActions(r.then).some((a) => a.type === 'openMoment' && a.momentId === m.id),
      )
    )
      issues.push({
        id: `unopened:${m.id}`,
        area: 'interaction',
        momentId: m.id,
        text: `${m.name}: no cue opens it`,
      });
  }

  const graph = sceneGraph(show);
  for (const s of graph.scenes)
    if (!graph.reachable.has(s.id))
      issues.push({
        id: `unreachable:${s.id}`,
        area: 'cues',
        sceneId: s.id,
        text: `Scene “${s.name}” can't be reached: nothing goes there`,
      });

  for (const cue of show.cues)
    for (const what of brokenRefs(show, cue.actions))
      issues.push({
        id: `broken:${cue.id}:${what}`,
        area: 'cues',
        cueId: cue.id,
        text: `Cue “${cue.name}” uses ${what}`,
      });

  const loops = loopingRules(show);
  for (const r of show.rules) {
    if (!r.enabled) continue;
    const missing = whenMissing(show, r.when);
    if (missing)
      issues.push({
        id: `when:${r.id}`,
        area: 'interaction',
        ruleId: r.id,
        text: `Rule “${r.name}”: ${missing}`,
      });
    for (const what of brokenRefs(show, r.then))
      issues.push({
        id: `broken:${r.id}:${what}`,
        area: 'interaction',
        ruleId: r.id,
        text: `Rule “${r.name}” uses ${what}`,
      });
    if (r.if.some((c) => !show.vars.some((v) => v.id === c.varId)))
      issues.push({
        id: `cond:${r.id}`,
        area: 'interaction',
        ruleId: r.id,
        text: `Rule “${r.name}” checks a value that was deleted`,
      });
    if (!r.then.length)
      issues.push({
        id: `empty:${r.id}`,
        area: 'interaction',
        ruleId: r.id,
        text: `Rule “${r.name}” does nothing yet`,
      });
    if (loops.has(r.id))
      issues.push({
        id: `loop:${r.id}`,
        area: 'interaction',
        ruleId: r.id,
        text: `Rule “${r.name}” may loop: it changes a value that sets it off again`,
      });
  }

  for (const loop of zeroTimeLoops(show)) {
    const names = loop.map((c) => `“${c.name}”`);
    issues.push({
      id: `cueloop:${loop.map((c) => c.id).join(':')}`,
      area: 'cues',
      cueId: loop[0]!.id,
      text:
        names.length === 1
          ? `Cue ${names[0]} fires itself with no time between, so the show stops it`
          : `Cues ${names.slice(0, -1).join(', ')} and ${names.at(-1)} fire each other with no time between, so the show stops them`,
    });
  }

  issues.push(...frameIssues(show));

  const tallies = new Set(show.moments.flatMap((m) => (m.tallyVarId ? [m.tallyVarId] : [])));
  for (const v of show.vars)
    if (!tallies.has(v.id) && use.writes(v.id) > 0 && use.reads(v.id) === 0)
      issues.push({
        id: `unread:${v.id}`,
        area: 'interaction',
        varId: v.id,
        text: `“${v.name}” is set but nothing reads it`,
      });

  for (const t of show.triggers)
    if (!show.rules.some((r) => r.when.type === 'trigger' && r.when.triggerId === t.id))
      issues.push({
        id: `trigger:${t.id}`,
        area: 'interaction',
        triggerId: t.id,
        text: `Trigger “${t.name}” does nothing yet: no rule uses it`,
      });

  return issues;
}
