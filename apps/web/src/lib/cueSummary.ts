import type { Action, Cue, Show } from '@scrim/format';

const name = (list: { id: string; name: string }[], id: string) =>
  list.find((x) => x.id === id)?.name ?? '?';

/** A short sentence of what a cue does, for cue rows ("Shows Attic · opens Door vote"). */
export function summarizeCue(show: Show, cue: Cue): string {
  return summarizeActions(show, cue.actions);
}

/** The same sentence for any list of actions, such as a rule's "then". */
export function summarizeActions(show: Show, actions: Action[]): string {
  const parts = actions.map((a) => describe(show, a));
  if (!parts.length) return 'Does nothing yet';
  return parts.length > 2
    ? `${parts.slice(0, 2).join(' · ')} · +${parts.length - 2}`
    : parts.join(' · ');
}

function describe(show: Show, a: Action): string {
  switch (a.type) {
    case 'show':
      return `Shows ${name(show.layers, a.layerId)}`;
    case 'hide':
      return `Hides ${name(show.layers, a.layerId)}`;
    case 'fade':
      return `Fades ${name(show.layers, a.layerId)}`;
    case 'play':
      return `Plays ${name(show.layers, a.layerId)}`;
    case 'pause':
      return `Pauses ${name(show.layers, a.layerId)}`;
    case 'seek':
      return `Jumps ${name(show.layers, a.layerId)}`;
    case 'setText':
      return `Changes ${name(show.layers, a.layerId)}`;
    case 'counter':
      return `Timer ${name(show.layers, a.layerId)}`;
    case 'setVar':
    case 'addVar':
      return `Sets ${name(show.vars, a.varId)}`;
    case 'jumpScene':
      return `Goes to ${name(show.scenes, a.sceneId)}`;
    case 'goToCue':
      return `Goes to ${name(show.cues, a.cueId)}`;
    case 'jumpSection':
      return `Goes to the ${a.section || '?'}`;
    case 'openMoment':
      return `Opens ${name(show.moments, a.momentId)}`;
    case 'closeMoment':
      return `Closes ${name(show.moments, a.momentId)}`;
    case 'stopAll':
      return 'Stops everything';
    case 'branch':
      return 'Branches';
  }
}
