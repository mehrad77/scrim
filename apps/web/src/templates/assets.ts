import type { Media } from '@scrim/format';
import { getSetting, setSetting } from '../storage/db.js';
import { addMediaBlob, mediaFile } from '../storage/media.js';
import type { AssetSpec, TemplateMedia, TemplateSeed } from './types.js';

/** public/templates/index.json, written by scripts/template-media/build.mjs. */
export interface AssetIndex {
  version: 1;
  files: Record<string, AssetEntry>;
}

export interface AssetEntry {
  /** The media's name in the show; for a font, its family plus the extension. */
  name: string;
  mime: string;
  bytes: number;
  sha256: string;
  credit: Credit;
  /** A font's licence, beside it under public/templates/. */
  licenceFile?: string;
}

export interface Credit {
  title: string;
  creator: string;
  year?: string;
  source: string;
  url: string;
  licence: Licence;
  /** Why it is public domain, when that isn't a licence: "US government work". */
  basis?: string;
}

export const LICENCES = ['PD', 'CC0-1.0', 'OFL-1.1'] as const;
export type Licence = (typeof LICENCES)[number];

const base = () => `${import.meta.env.BASE_URL}templates/`;

let index: Promise<AssetIndex> | null = null;

export function assetIndex(): Promise<AssetIndex> {
  index ??= fetch(`${base()}index.json`).then(
    (r) => {
      if (!r.ok) throw new Error(`The template list didn’t load (${r.status})`);
      return r.json() as Promise<AssetIndex>;
    },
    (e: unknown) => {
      throw new Error('The templates need the internet the first time. Connect and try again.', {
        cause: e,
      });
    },
  );
  index.catch(() => (index = null));
  return index;
}

/** How much a template downloads the first time, in bytes. */
export function downloadSize(seed: TemplateSeed, idx: AssetIndex): number {
  return [...new Set(seed.assets.map((a) => a.path))].reduce(
    (n, path) => n + (idx.files[path]?.bytes ?? 0),
    0,
  );
}

/** How much a template still has to download on this machine, in bytes: 0 once it's all here. */
export async function downloadNeeded(seed: TemplateSeed, idx: AssetIndex): Promise<number> {
  let n = 0;
  for (const path of new Set(seed.assets.map((a) => a.path))) {
    const e = idx.files[path];
    if (e && !(await stored(e.sha256, e.bytes))) n += e.bytes;
  }
  return n;
}

/** Media already fetched for an earlier show, by content hash, so a second copy costs nothing. */
const CACHE_KEY = 'templateMedia';

async function stored(sha: string, bytes: number): Promise<Media | null> {
  const cache = (await getSetting<Record<string, Media>>(CACHE_KEY)) ?? {};
  const media = cache[sha];
  if (!media) return null;
  const file = await mediaFile(media.id);
  return file && file.size === bytes ? media : null;
}

async function remember(sha: string, media: Media): Promise<void> {
  const cache = (await getSetting<Record<string, Media>>(CACHE_KEY)) ?? {};
  cache[sha] = media;
  await setSetting(CACHE_KEY, cache);
}

export interface Progress {
  done: number;
  total: number;
  bytes: number;
  totalBytes: number;
}

/**
 * Fetch a template's files and store them as media on this machine, reusing any fetched before.
 * Throws with a plain message when offline or a file is missing.
 */
export function fetchAssets(
  seed: TemplateSeed,
  onProgress?: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<TemplateMedia> {
  // One at a time, so two quick clicks share stored files instead of racing to store them twice.
  const run = queue.then(() => fetchNow(seed, onProgress, signal));
  queue = run.catch(() => undefined);
  return run;
}

let queue: Promise<unknown> = Promise.resolve();

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchNow(
  seed: TemplateSeed,
  onProgress?: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<TemplateMedia> {
  const idx = await assetIndex();
  const paths = [...new Set(seed.assets.map((a) => a.path))];
  const entries = paths.map((path) => {
    const entry = idx.files[path];
    if (!entry) throw new Error(`The template file ${path} is missing`);
    return [path, entry] as const;
  });
  const progress: Progress = {
    done: 0,
    total: entries.length,
    bytes: 0,
    totalBytes: entries.reduce((n, [, e]) => n + e.bytes, 0),
  };
  onProgress?.({ ...progress });
  const byPath = new Map<string, Media>();
  for (const [path, entry] of entries) {
    signal?.throwIfAborted();
    let media = await stored(entry.sha256, entry.bytes);
    if (!media) {
      let res: Response;
      try {
        res = await fetch(`${base()}${path}`, { signal });
      } catch (e) {
        if (signal?.aborted) throw e;
        throw new Error('This template needs the internet the first time. Connect and try again.', {
          cause: e,
        });
      }
      if (!res.ok) throw new Error(`${entry.name} didn’t download (${res.status})`);
      const blob = await res.blob();
      // A captive portal or a host's fallback page can answer 200 with something else.
      if (blob.size !== entry.bytes || (await sha256(blob)) !== entry.sha256)
        throw new Error(
          `${entry.name} didn’t download completely. Check the connection and try again.`,
        );
      media = await addMediaBlob(new Blob([blob], { type: entry.mime }), entry.name);
      await remember(entry.sha256, media);
    }
    byPath.set(path, { ...media, name: entry.name });
    progress.done++;
    progress.bytes += entry.bytes;
    onProgress?.({ ...progress });
  }
  return Object.fromEntries(seed.assets.map((a: AssetSpec) => [a.key, byPath.get(a.path)!]));
}
