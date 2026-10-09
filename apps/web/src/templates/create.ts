import type { Show } from '@scrim/format';
import { rememberTemplate } from '../lib/learn.js';
import { fetchAssets, type Progress } from './assets.js';
import type { TemplateSeed } from './types.js';

/**
 * Make a new show from a template: fetch its files (once per machine), build it, and note how it
 * started for its Learn checklist. The caller saves it.
 */
export async function createFromTemplate(
  seed: TemplateSeed,
  name: string,
  onProgress?: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<Show> {
  const media = await fetchAssets(seed, onProgress, signal);
  const show = seed.make(media);
  show.name = name.trim() || seed.title;
  rememberTemplate(show, seed.id);
  return show;
}
