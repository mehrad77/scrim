import {
  descendantsOf,
  layerTree,
  type Action,
  type Command,
  type JumpTarget,
  type Show,
} from '@scrim/format';

/** Remove actions (recursively, inside branches) that match `drop`. */
export function pruneActions(actions: Action[], drop: (a: Action) => boolean): Action[] {
  const out: Action[] = [];
  for (const a of actions) {
    if (drop(a)) continue;
    if (a.type === 'branch') {
      out.push({
        ...a,
        if: a.if,
        then: pruneActions(a.then, drop),
        else: pruneActions(a.else, drop),
      });
    } else out.push(a);
  }
  return out;
}

function pruneEverywhere(show: Show, drop: (a: Action) => boolean): void {
  for (const c of show.cues) {
    c.actions = pruneActions(c.actions, drop);
    if (c.gentle) c.gentle = pruneActions(c.gentle, drop);
  }
  for (const r of show.rules) r.then = pruneActions(r.then, drop);
}

/** Remove a layer, everything inside it if it is a frame, and every action that uses them. */
export function removeLayer(show: Show, layerId: string): void {
  const tree = layerTree(show.layers);
  const ids = new Set([layerId, ...descendantsOf(tree, layerId).map((l) => l.id)]);
  show.layers = show.layers.filter((l) => !ids.has(l.id));
  pruneEverywhere(show, (a) => 'layerId' in a && ids.has(a.layerId));
  show.rules = show.rules.filter((r) => !(r.when.type === 'mediaEnded' && ids.has(r.when.layerId)));
}

export function removeVar(show: Show, varId: string): void {
  show.vars = show.vars.filter((v) => v.id !== varId);
  pruneEverywhere(show, (a) => 'varId' in a && a.varId === varId);
  const dropCond = (c: { varId: string }) => c.varId !== varId;
  for (const r of show.rules) r.if = r.if.filter(dropCond);
  show.rules = show.rules.filter((r) => !(r.when.type === 'varChanged' && r.when.varId === varId));
  for (const m of show.moments) {
    if (m.resultVarId === varId) m.resultVarId = null;
    if (m.tallyVarId === varId) m.tallyVarId = null;
  }
  for (const l of show.layers) if (l.kind === 'state' && l.varId === varId) l.varId = '';
  if (show.schedule?.varId === varId) delete show.schedule;
}

export function removeMoment(show: Show, momentId: string): void {
  show.moments = show.moments.filter((m) => m.id !== momentId);
  pruneEverywhere(show, (a) => 'momentId' in a && a.momentId === momentId);
  show.rules = show.rules.filter(
    (r) => !(r.when.type === 'momentClosed' && r.when.momentId === momentId),
  );
}

export function removeTrigger(show: Show, triggerId: string): void {
  show.triggers = show.triggers.filter((t) => t.id !== triggerId);
  for (const c of show.cues) if (c.waitFor === triggerId) delete c.waitFor;
  show.rules = show.rules.filter(
    (r) => !(r.when.type === 'trigger' && r.when.triggerId === triggerId),
  );
  const keep = (c: { command: { type: string; triggerId?: string } }) =>
    !(c.command.type === 'trigger' && c.command.triggerId === triggerId);
  show.inputs.keys = show.inputs.keys.filter(keep);
  show.inputs.midi = show.inputs.midi.filter(keep);
  show.inputs.gamepad = show.inputs.gamepad.filter(keep);
}

/** Drop key, MIDI and gamepad mappings whose jump goes to a target that is being deleted. */
function dropJumps(show: Show, gone: (t: JumpTarget) => boolean): void {
  const keep = (m: { command: Command }) => !(m.command.type === 'jump' && gone(m.command.target));
  show.inputs.keys = show.inputs.keys.filter(keep);
  show.inputs.midi = show.inputs.midi.filter(keep);
  show.inputs.gamepad = show.inputs.gamepad.filter(keep);
}

export function removeScene(show: Show, sceneId: string): void {
  const cueIds = new Set(show.cues.filter((c) => c.sceneId === sceneId).map((c) => c.id));
  show.scenes = show.scenes.filter((s) => s.id !== sceneId);
  show.cues = show.cues.filter((c) => c.sceneId !== sceneId);
  pruneEverywhere(
    show,
    (a) =>
      (a.type === 'jumpScene' && a.sceneId === sceneId) ||
      (a.type === 'goToCue' && cueIds.has(a.cueId)),
  );
  show.rules = show.rules.filter((r) => !(r.when.type === 'cueFired' && cueIds.has(r.when.cueId)));
  dropJumps(
    show,
    (t) => (t.to === 'scene' && t.sceneId === sceneId) || (t.to === 'cue' && cueIds.has(t.cueId)),
  );
  if (show.setlists)
    for (const list of show.setlists) list.scenes = list.scenes.filter((id) => id !== sceneId);
}

export function removeCue(show: Show, cueId: string): void {
  show.cues = show.cues.filter((c) => c.id !== cueId);
  pruneEverywhere(show, (a) => a.type === 'goToCue' && a.cueId === cueId);
  show.rules = show.rules.filter((r) => !(r.when.type === 'cueFired' && r.when.cueId === cueId));
  dropJumps(show, (t) => t.to === 'cue' && t.cueId === cueId);
}

export function removeOutput(show: Show, outputId: string): void {
  for (const l of show.layers.filter((x) => x.outputId === outputId)) removeLayer(show, l.id);
  show.outputs = show.outputs.filter((o) => o.id !== outputId);
}

/** Where a layer is used, for "used in N cues" hints. */
export function layerUsage(show: Show, layerId: string): number {
  const uses = (actions: Action[]): number =>
    actions.reduce(
      (n, a) =>
        n +
        ('layerId' in a && a.layerId === layerId ? 1 : 0) +
        (a.type === 'branch' ? uses(a.then) + uses(a.else) : 0),
      0,
    );
  return (
    show.cues.reduce((n, c) => n + uses(c.actions) + uses(c.gentle ?? []), 0) +
    show.rules.reduce((n, r) => n + uses(r.then), 0)
  );
}
