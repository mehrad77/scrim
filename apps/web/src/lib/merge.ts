import {
  ancestorsOf,
  descendantsOf,
  layerTree,
  uid,
  type Action,
  type Command,
  type Cue,
  type Layer,
  type Moment,
  type Rule,
  type Show,
  type Var,
} from '@scrim/format';
import { pinShift } from './frames.js';
import { uniqueName } from './moments.js';

/**
 * Moving work between shows (users-and-journey › teacher: merging groups' work): importing
 * scenes from another show, and giving a show made from a template ids of its own. Every object
 * that comes across gets a new id, so nothing collides; media keeps its ids, since a media id
 * names one stored file.
 */

/** Every action in a list, inside branches too. */
const flatActions = (actions: Action[]): Action[] =>
  actions.flatMap((a) =>
    a.type === 'branch' ? [a, ...flatActions(a.then), ...flatActions(a.else)] : [a],
  );

type Kind = 'scene' | 'cue' | 'layer' | 'moment' | 'var' | 'trigger' | 'rule' | 'output';
const PREFIX: Record<Kind, string> = {
  scene: 'scn',
  cue: 'cue',
  layer: 'lyr',
  moment: 'mom',
  var: 'var',
  trigger: 'trg',
  rule: 'rul',
  output: 'out',
};

/** Old id to new id, per kind; a reference to something not carried across becomes empty. */
class Ids {
  readonly maps = new Map<Kind, Map<string, string>>();
  /** References left empty because what they pointed at stayed behind. */
  dropped = 0;
  /** Value names that had to change, so {{placeholders}} follow. */
  readonly names = new Map<string, string>();

  add(kind: Kind, id: string): string {
    const map = this.maps.get(kind) ?? new Map<string, string>();
    this.maps.set(kind, map);
    const next = map.get(id) ?? uid(PREFIX[kind]);
    map.set(id, next);
    return next;
  }

  get(kind: Kind, id: string): string {
    if (!id) return id;
    const next = this.maps.get(kind)?.get(id);
    if (next === undefined) this.dropped += 1;
    return next ?? '';
  }

  /** `{{old_name}}` as `{{new_name}}` wherever a value was renamed. */
  text(s: string): string {
    if (!this.names.size) return s;
    return s.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (all, name: string) => {
      const to = this.names.get(name);
      return to ? `{{${to}}}` : all;
    });
  }
}

function action(a: Action, ids: Ids): Action {
  const b = structuredClone(a);
  if ('layerId' in b) b.layerId = ids.get('layer', b.layerId);
  if ('varId' in b) b.varId = ids.get('var', b.varId);
  if ('momentId' in b) b.momentId = ids.get('moment', b.momentId);
  if (b.type === 'jumpScene') b.sceneId = ids.get('scene', b.sceneId);
  if (b.type === 'goToCue') b.cueId = ids.get('cue', b.cueId);
  if (b.type === 'setText') b.text = ids.text(b.text);
  if (b.type === 'branch') {
    b.if = b.if.map((c) => ({ ...c, varId: ids.get('var', c.varId) }));
    b.then = b.then.map((x) => action(x, ids));
    b.else = b.else.map((x) => action(x, ids));
  }
  return b;
}

function cue(c: Cue, ids: Ids): Cue {
  const next: Cue = {
    ...structuredClone(c),
    id: ids.get('cue', c.id),
    sceneId: ids.get('scene', c.sceneId),
    actions: c.actions.map((a) => action(a, ids)),
  };
  if (c.gentle) next.gentle = c.gentle.map((a) => action(a, ids));
  if (c.waitFor) next.waitFor = ids.get('trigger', c.waitFor);
  return next;
}

function layer(l: Layer, ids: Ids, output: (id: string | null) => string | null): Layer {
  const next = { ...structuredClone(l), id: ids.get('layer', l.id), outputId: output(l.outputId) };
  if (l.parentId) next.parentId = ids.get('layer', l.parentId);
  if (next.kind === 'state') next.varId = ids.get('var', next.varId);
  if (next.kind === 'text') next.text = ids.text(next.text);
  return next;
}

function moment(m: Moment, ids: Ids): Moment {
  return {
    ...structuredClone(m),
    id: ids.get('moment', m.id),
    resultVarId: m.resultVarId && ids.get('var', m.resultVarId),
    tallyVarId: m.tallyVarId && ids.get('var', m.tallyVarId),
  };
}

function rule(r: Rule, ids: Ids): Rule {
  const w = r.when;
  const when: Rule['when'] =
    w.type === 'trigger'
      ? { ...w, triggerId: ids.get('trigger', w.triggerId) }
      : w.type === 'momentClosed'
        ? { ...w, momentId: ids.get('moment', w.momentId) }
        : w.type === 'varChanged'
          ? { ...w, varId: ids.get('var', w.varId) }
          : w.type === 'cueFired'
            ? { ...w, cueId: ids.get('cue', w.cueId) }
            : { ...w, layerId: ids.get('layer', w.layerId) };
  return {
    ...structuredClone(r),
    id: ids.get('rule', r.id),
    when,
    if: r.if.map((c) => ({ ...c, varId: ids.get('var', c.varId) })),
    then: r.then.map((a) => action(a, ids)),
  };
}

function command(c: Command, ids: Ids): Command {
  if (c.type === 'trigger') return { ...c, triggerId: ids.get('trigger', c.triggerId) };
  if (c.type === 'countVote' && c.momentId)
    return { ...c, momentId: ids.get('moment', c.momentId) };
  if (c.type !== 'jump') return c;
  const t = c.target;
  return {
    ...c,
    target:
      t.to === 'scene'
        ? { ...t, sceneId: ids.get('scene', t.sceneId) }
        : t.to === 'cue'
          ? { ...t, cueId: ids.get('cue', t.cueId) }
          : t,
  };
}

/** A show with new ids for everything in it, for a show made from a template. */
export function freshIds(source: Show): Show {
  const ids = new Ids();
  for (const o of source.outputs) ids.add('output', o.id);
  for (const s of source.scenes) ids.add('scene', s.id);
  for (const c of source.cues) ids.add('cue', c.id);
  for (const l of source.layers) ids.add('layer', l.id);
  for (const m of source.moments) ids.add('moment', m.id);
  for (const v of source.vars) ids.add('var', v.id);
  for (const t of source.triggers) ids.add('trigger', t.id);
  for (const r of source.rules) ids.add('rule', r.id);
  const out = (id: string | null) => (id === null ? null : ids.get('output', id));
  const show: Show = {
    ...structuredClone(source),
    outputs: source.outputs.map((o) => ({ ...structuredClone(o), id: ids.get('output', o.id) })),
    scenes: source.scenes.map((s) => ({ ...s, id: ids.get('scene', s.id) })),
    cues: source.cues.map((c) => cue(c, ids)),
    layers: source.layers.map((l) => layer(l, ids, out)),
    moments: source.moments.map((m) => moment(m, ids)),
    vars: source.vars.map((v) => ({ ...structuredClone(v), id: ids.get('var', v.id) })),
    triggers: source.triggers.map((t) => ({ ...t, id: ids.get('trigger', t.id) })),
    rules: source.rules.map((r) => rule(r, ids)),
    inputs: {
      keys: source.inputs.keys.map((k) => ({ ...k, command: command(k.command, ids) })),
      midi: source.inputs.midi.map((m) => ({ ...m, command: command(m.command, ids) })),
      gamepad: source.inputs.gamepad.map((g) => ({ ...g, command: command(g.command, ids) })),
    },
  };
  if (source.setlists)
    show.setlists = source.setlists.map((l) => ({
      ...l,
      id: uid('set'),
      scenes: l.scenes.map((s) => ids.get('scene', s)),
    }));
  return show;
}

export interface ImportPlan {
  /** The source's scenes to bring across, with every cue in them. */
  sceneIds: string[];
  /** Which output each of the source's outputs lands on; unmapped ones go to the first. */
  outputMap?: Record<string, string>;
}

export interface ImportResult {
  scenes: number;
  cues: number;
  layers: number;
  /** Media the imported layers use that the target doesn't have yet: copy these files. */
  media: string[];
  /** Jumps to scenes and cues that stayed behind, left for the designer to point again. */
  dropped: number;
}

/**
 * Bring scenes from another show into this one: their cues, and everything those cues use (the
 * layers and the frames around and inside them, moments, values, performer triggers, and the
 * rules that react to them), each with a new id. Value names that are taken get a number, and
 * text that shows them follows. New scenes go after the others; layers go on top.
 */
export function importScenes(target: Show, source: Show, plan: ImportPlan): ImportResult {
  const ids = new Ids();
  const wanted = new Set(plan.sceneIds);
  const scenes = source.scenes.filter((s) => wanted.has(s.id));
  const cues = source.cues.filter((c) => wanted.has(c.sceneId));
  const tree = layerTree(source.layers);

  // Everything the cues use, and what that uses in turn, until nothing new turns up.
  const layers = new Set<string>();
  const moments = new Set<string>();
  const vars = new Set<string>();
  const triggers = new Set(cues.flatMap((c) => (c.waitFor ? [c.waitFor] : [])));
  const rules = new Set<string>();
  const cueIds = new Set(cues.map((c) => c.id));
  const byName = new Map(source.vars.map((v) => [v.name, v.id]));
  const readText = (s: string) => {
    for (const m of s.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) {
      const id = byName.get(m[1]!);
      if (id) vars.add(id);
    }
  };
  const collect = (actions: Action[]) => {
    for (const a of flatActions(actions)) {
      if ('layerId' in a && a.layerId) layers.add(a.layerId);
      if ('varId' in a && a.varId) vars.add(a.varId);
      if ('momentId' in a && a.momentId) moments.add(a.momentId);
      if (a.type === 'setText') readText(a.text);
      if (a.type === 'branch') for (const c of a.if) vars.add(c.varId);
    }
  };
  for (const c of cues) collect([...c.actions, ...(c.gentle ?? [])]);
  for (let size = -1; size !== layers.size + moments.size + vars.size + rules.size;) {
    size = layers.size + moments.size + vars.size + rules.size;
    for (const id of [...layers]) {
      for (const f of ancestorsOf(tree, id)) layers.add(f.id);
      for (const d of descendantsOf(tree, id)) layers.add(d.id);
    }
    for (const l of source.layers.filter((x) => layers.has(x.id))) {
      if (l.kind === 'state' && l.varId) vars.add(l.varId);
      if (l.kind === 'text') readText(l.text);
    }
    for (const m of source.moments.filter((x) => moments.has(x.id))) {
      if (m.resultVarId) vars.add(m.resultVarId);
      if (m.tallyVarId) vars.add(m.tallyVarId);
    }
    for (const r of source.rules) {
      if (rules.has(r.id)) continue;
      const w = r.when;
      const writes = flatActions(r.then).some(
        (a) => ('varId' in a && vars.has(a.varId)) || ('layerId' in a && layers.has(a.layerId)),
      );
      const reacts =
        (w.type === 'cueFired' && cueIds.has(w.cueId)) ||
        (w.type === 'momentClosed' && moments.has(w.momentId)) ||
        (w.type === 'mediaEnded' && layers.has(w.layerId)) ||
        (w.type === 'varChanged' && vars.has(w.varId)) ||
        // A performer's button that counts into a value these scenes show.
        (w.type === 'trigger' && (triggers.has(w.triggerId) || writes));
      if (!reacts) continue;
      rules.add(r.id);
      if (w.type === 'trigger') triggers.add(w.triggerId);
      collect(r.then);
      for (const c of r.if) vars.add(c.varId);
    }
  }

  for (const s of scenes) ids.add('scene', s.id);
  for (const c of cues) ids.add('cue', c.id);
  const pick = <T extends { id: string }>(list: T[], set: Set<string>, kind: Kind) => {
    const kept = list.filter((x) => set.has(x.id));
    for (const x of kept) ids.add(kind, x.id);
    return kept;
  };
  const newLayers = pick(source.layers, layers, 'layer');
  const newMoments = pick(source.moments, moments, 'moment');
  const newVars = pick(source.vars, vars, 'var');
  const newTriggers = pick(source.triggers, triggers, 'trigger');
  const newRules = pick(source.rules, rules, 'rule');

  // A value whose name is taken gets a number, and every {{name}} that shows it follows.
  const taken = { ...target, vars: [...target.vars] };
  const vs: Var[] = newVars.map((v) => {
    const name = uniqueName(taken, v.name);
    if (name !== v.name) ids.names.set(v.name, name);
    const next = { ...structuredClone(v), id: ids.get('var', v.id), name };
    taken.vars.push(next);
    return next;
  });

  const fallback = target.outputs[0]?.id ?? null;
  const output = (id: string | null) =>
    id === null
      ? null
      : (plan.outputMap?.[id] ?? (target.outputs.some((o) => o.id === id) ? id : fallback));
  const buses = new Set(target.audioBuses.map((b) => b.id));
  const topZ = new Map<string | null, number>();
  for (const l of target.layers)
    if (!l.parentId) topZ.set(l.outputId, Math.max(topZ.get(l.outputId) ?? -1, l.z));
  const lowest = Math.min(0, ...newLayers.filter((l) => !l.parentId).map((l) => l.z));
  const ls = newLayers.map((l) => {
    const next = layer(l, ids, output);
    // On top of what is there, keeping their own order.
    if (!next.parentId) {
      next.z = (topZ.get(next.outputId) ?? -1) + 1 + (l.z - lowest);
      // A pinned layer keeps its distance to its edges on an output of another size.
      const from = source.outputs.find((o) => o.id === l.outputId);
      const to = target.outputs.find((o) => o.id === next.outputId);
      if (from && to) {
        const { dx, dy } = pinShift(l.pin, from, to);
        next.x += dx;
        next.y += dy;
      }
    }
    if ('bus' in next && !buses.has(next.bus)) next.bus = target.audioBuses[0]?.id ?? 'main';
    return next;
  });

  target.scenes.push(...scenes.map((s) => ({ ...s, id: ids.get('scene', s.id) })));
  target.cues.push(...cues.map((c) => cue(c, ids)));
  target.layers.push(...ls);
  target.moments.push(...newMoments.map((m) => moment(m, ids)));
  target.vars.push(...vs);
  target.triggers.push(...newTriggers.map((t) => ({ ...t, id: ids.get('trigger', t.id) })));
  target.rules.push(...newRules.map((r) => rule(r, ids)));

  const used = new Set(ls.flatMap((l) => ('mediaId' in l ? [l.mediaId] : [])));
  // Fonts travel too: the imported text may be set in them.
  for (const m of source.media) if (m.kind === 'font') used.add(m.id);
  const media = source.media.filter(
    (m) => used.has(m.id) && !target.media.some((x) => x.id === m.id),
  );
  target.media.push(...structuredClone(media));
  return {
    scenes: scenes.length,
    cues: cues.length,
    layers: ls.length,
    media: media.map((m) => m.id),
    dropped: ids.dropped,
  };
}
