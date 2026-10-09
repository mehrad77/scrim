import { sceneSequence, type RunOrder } from '@scrim/engine';
import type { JumpTarget, Show } from '@scrim/format';

const quoted = (name: string | undefined, missing: string) => (name ? `“${name}”` : missing);

/** "Scene “River”", "Section “Chorus”", "Next scene": where a jump goes, as people say it. */
export function jumpTargetText(show: Show, t: JumpTarget): string {
  switch (t.to) {
    case 'scene':
      return `Scene ${quoted(show.scenes.find((s) => s.id === t.sceneId)?.name, 'that was deleted')}`;
    case 'cue':
      return `Cue ${quoted(show.cues.find((c) => c.id === t.cueId)?.name, 'that was deleted')}`;
    case 'section':
      return `Section ${quoted(t.section.trim(), '(none named)')}`;
    case 'nextScene':
      return 'Next scene';
    case 'prevScene':
      return 'Previous scene';
    case 'restartScene':
      return 'This scene again';
  }
}

/** Every section a cue names, in the order they first appear. */
export function sectionsOf(show: Show): string[] {
  const seen = new Map<string, string>();
  for (const c of show.cues) {
    const s = c.section?.trim();
    if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
  }
  return [...seen.values()];
}

/** The run log line for a change of running order: what moved, was skipped or came back. */
export function orderChangeText(show: Show, prev: RunOrder | null, next: RunOrder | null): string {
  const name = (id: string) => `“${show.scenes.find((s) => s.id === id)?.name ?? 'a scene'}”`;
  if (!next) return 'Running order: back to the show’s order';
  const before = new Set(prev?.skipped ?? []);
  const after = new Set(next.skipped);
  const skipped = [...after].filter((id) => !before.has(id));
  const back = [...before].filter((id) => !after.has(id));
  const parts = [
    ...skipped.map((id) => `Skipped ${name(id)}`),
    ...back.map((id) => `Brought back ${name(id)}`),
  ];
  const a = sceneSequence(show, prev);
  const b = sceneSequence(show, next);
  if (a.join() !== b.join()) {
    // One scene moved if taking it out of both orders leaves them the same.
    const without = (seq: string[], id: string) => seq.filter((x) => x !== id).join();
    const moved = b.find((id) => without(a, id) === without(b, id));
    const at = moved ? b.indexOf(moved) : -1;
    parts.push(
      moved
        ? at === 0
          ? `Moved ${name(moved)} to the top`
          : `Moved ${name(moved)} after ${name(b[at - 1]!)}`
        : 'Changed the running order',
    );
  }
  return parts.join(' · ') || 'Running order set';
}
