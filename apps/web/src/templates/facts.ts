import type { Media, MediaKind, Show } from '@scrim/format';
import type { AssetIndex } from './assets.js';
import type { TemplateMedia, TemplateSeed } from './types.js';

/**
 * Stand-ins for a template's media, from the asset index alone: enough to build the show and
 * read what it does, without downloading anything (the gallery's chips, the tests).
 */
export function placeholderMedia(seed: TemplateSeed, index: AssetIndex): TemplateMedia {
  return Object.fromEntries(
    seed.assets.map((a) => {
      const e = index.files[a.path];
      if (!e) throw new Error(`${seed.id}: ${a.path} isn't in index.json`);
      const kind: MediaKind = e.mime.startsWith('font/')
        ? 'font'
        : (e.mime.split('/')[0] as MediaKind);
      const media: Media = {
        id: `med_${a.path.replace(/\W/g, '')}`,
        kind,
        name: e.name,
        mime: e.mime,
        size: e.bytes,
        ...(kind === 'image' || kind === 'video' ? { width: 1920, height: 1080 } : {}),
        ...(kind === 'audio' || kind === 'video' ? { duration: 60 } : {}),
      };
      return [a.key, media];
    }),
  );
}

/** A fact about a template, read from the show it makes, never written by hand. */
export interface Fact {
  id: string;
  label: string;
  /** What it means, for the detail view. */
  detail: string;
}

export function factsOf(show: Show): Fact[] {
  const facts: Fact[] = [];
  const buttons = [...show.inputs.keys, ...show.inputs.midi, ...show.inputs.gamepad].some(
    (m) => m.command.type === 'countVote',
  );
  const choices = show.moments.length > 0;
  const joinable = show.layers.some((l) => l.kind === 'text' && l.text.includes('{{join_url}}'));
  if (!choices && joinable)
    facts.push({
      id: 'phones',
      label: 'Phones optional',
      detail:
        'Nothing needs a phone, but people can follow along on theirs, which needs the internet.',
    });
  else if (!choices)
    facts.push({
      id: 'phones',
      label: 'No phones needed',
      detail: 'Nothing asks the audience for their phones.',
    });
  else if (buttons)
    facts.push({
      id: 'phones',
      label: 'Phones or buttons',
      detail:
        'People vote on their phones, which needs the internet, or with buttons in the room, which doesn’t.',
    });
  else
    facts.push({
      id: 'phones',
      label: 'Phones vote',
      detail:
        'People vote on their phones, which needs the internet. You can count raised hands too.',
    });
  if (show.safety?.noFreeText)
    facts.push({
      id: 'text',
      label: 'No free text',
      detail: 'Phones can only vote and tap: nobody can type anything onto the stage.',
    });
  if (show.relaxed?.default)
    facts.push({
      id: 'relaxed',
      label: 'Relaxed by default',
      detail: 'Softer light and sound, slower fades, and nothing startling, from the first cue.',
    });
  if (show.operator?.layout === 'simple')
    facts.push({
      id: 'simple',
      label: 'Simple to run',
      detail: 'Opens in the simple operator view: one big GO, now and next, and PANIC.',
    });
  if (show.schedule)
    facts.push({
      id: 'hours',
      label: 'Opening hours',
      detail: 'Wakes, sleeps and goes quiet on its own, by the clock.',
    });
  if (show.languages?.others.length)
    facts.push({
      id: 'languages',
      label: `${show.languages.others.length + 1} languages`,
      detail: 'Captions on visitors’ phones in each of its languages.',
    });
  if (show.setlists?.length)
    facts.push({
      id: 'setlists',
      label: 'Setlists',
      detail: 'Change tonight’s order live, or switch to a prepared setlist.',
    });
  if (show.inputs.midi.length)
    facts.push({
      id: 'midi',
      label: 'MIDI',
      detail: 'Pedals and program changes run it hands-free.',
    });
  return facts;
}
