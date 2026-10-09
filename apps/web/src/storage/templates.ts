import { uid, type Show } from '@scrim/format';
import { freshIds } from '../lib/merge.js';
import { getSetting, setSetting } from './db.js';

/**
 * Shows saved as templates for the start gallery, on this machine. A template shares its media
 * files with the show it came from; deleting that show keeps the files the template uses.
 */
const KEY = 'templates';

export async function listTemplates(): Promise<Show[]> {
  return (await getSetting<Show[]>(KEY)) ?? [];
}

export async function saveTemplate(show: Show, name: string): Promise<void> {
  const template: Show = { ...structuredClone(show), id: uid('tpl'), name, updatedAt: Date.now() };
  await setSetting(KEY, [template, ...(await listTemplates())]);
}

export async function deleteTemplate(id: string): Promise<void> {
  await setSetting(
    KEY,
    (await listTemplates()).filter((t) => t.id !== id),
  );
}

/**
 * A new show from a template, with ids of its own for everything in it, so two shows made from
 * one template can share scenes later without clashing.
 */
export function fromTemplate(template: Show, name: string): Show {
  return {
    ...freshIds(template),
    id: uid('show'),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
