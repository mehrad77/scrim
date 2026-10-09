import { cueOrder, type Cue, type JumpTarget, type Show } from '@scrim/format';

/**
 * Tonight's running order: every scene in the order it plays, and the ones left out. It is
 * performance state, like standby, so the show itself never changes when a setlist does.
 */
export interface RunOrder {
  scenes: string[];
  skipped: string[];
}

/**
 * The scenes in running order, skipped ones included. A scene the order doesn't list (added
 * since it was set) plays after the scene before it in the show.
 */
export function sceneSequence(show: Pick<Show, 'scenes'>, order: RunOrder | null): string[] {
  const known = new Set(show.scenes.map((s) => s.id));
  if (!order) return show.scenes.map((s) => s.id);
  const seq = [...new Set(order.scenes)].filter((id) => known.has(id));
  show.scenes.forEach((s, i) => {
    if (seq.includes(s.id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = seq.indexOf(show.scenes[j]!.id);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    seq.splice(at, 0, s.id);
  });
  return seq;
}

/** The cues that play tonight, in order: by running order, then cue position. */
export function runOrder(show: Pick<Show, 'scenes' | 'cues'>, order: RunOrder | null): Cue[] {
  if (!order) return cueOrder(show);
  const skipped = new Set(order.skipped);
  const byScene = new Map<string, Cue[]>();
  for (const c of cueOrder(show)) byScene.set(c.sceneId, [...(byScene.get(c.sceneId) ?? []), c]);
  return sceneSequence(show, order)
    .filter((id) => !skipped.has(id))
    .flatMap((id) => byScene.get(id) ?? []);
}

const sectionKey = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/**
 * The cue a jump goes to, or why it can't. Sections and neighbouring scenes are found from the
 * live cue: the next cue in its scene with that section (so a repeated chorus comes round), or
 * the latest one when none is left; the scene after, before or of it, in running order.
 */
export function resolveJump(
  show: Pick<Show, 'scenes' | 'cues'>,
  order: Cue[],
  live: { lastFired: string | null; standby: string | null },
  target: JumpTarget,
): { cueId: string } | { warning: string } {
  const all = cueOrder(show);
  const sceneName = (id: string) => show.scenes.find((s) => s.id === id)?.name ?? 'this scene';
  const firstOf = (sceneId: string) => all.find((c) => c.sceneId === sceneId);
  const lastCue = all.find((c) => c.id === live.lastFired);
  const liveScene = lastCue?.sceneId ?? all.find((c) => c.id === live.standby)?.sceneId ?? null;
  switch (target.to) {
    case 'scene': {
      const first = firstOf(target.sceneId);
      return first ? { cueId: first.id } : { warning: `Scene ${target.sceneId} has no cues` };
    }
    case 'cue':
      return all.some((c) => c.id === target.cueId)
        ? { cueId: target.cueId }
        : { warning: `Cue ${target.cueId} not found` };
    case 'section': {
      const want = sectionKey(target.section);
      if (!want) return { warning: 'Jump to a section: no section named' };
      if (!liveScene) return { warning: `No “${target.section}”: nothing is running` };
      const cues = all.filter((c) => c.sceneId === liveScene);
      const pivot = cues.findIndex((c) => c.id === live.lastFired);
      const hits = cues.flatMap((c, i) => (sectionKey(c.section) === want ? [i] : []));
      const i = hits.find((h) => h > pivot) ?? hits.filter((h) => h <= pivot).at(-1);
      return i === undefined
        ? { warning: `No “${target.section}” in “${sceneName(liveScene)}”` }
        : { cueId: cues[i]!.id };
    }
    case 'nextScene':
    case 'prevScene':
    case 'restartScene': {
      const scenes = [...new Set(order.map((c) => c.sceneId))];
      const at = lastCue ? scenes.indexOf(lastCue.sceneId) : -1;
      const index =
        target.to === 'restartScene'
          ? Math.max(at, 0)
          : target.to === 'nextScene'
            ? at + 1
            : at < 0
              ? -1
              : at - 1;
      const scene = scenes[index];
      if (!scene)
        return {
          warning:
            target.to === 'prevScene'
              ? `No scene before “${lastCue ? sceneName(lastCue.sceneId) : 'the top'}”`
              : `No scene after “${lastCue ? sceneName(lastCue.sceneId) : 'the top'}”`,
        };
      return { cueId: firstOf(scene)!.id };
    }
  }
}
