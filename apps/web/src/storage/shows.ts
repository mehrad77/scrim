import { parseShow, readBundle, uid, writeBundle, type Show } from '@scrim/format';
import { db, type RunRecord, type VersionRecord } from './db.js';
import { deleteMediaFile, mediaFile, mediaWriter } from './media.js';
import { listTemplates } from './templates.js';

const MAX_VERSIONS = 50;
const AUTO_VERSION_EVERY_MS = 5 * 60 * 1000;

export async function listShows(): Promise<Show[]> {
  const shows = await (await db()).getAll('shows');
  return shows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getShow(id: string): Promise<Show | undefined> {
  return (await db()).get('shows', id);
}

/** Save a show; snapshots a version when the last one is old enough. */
export async function saveShow(show: Show): Promise<void> {
  const database = await db();
  await database.put('shows', show);
  const latest = await latestVersion(show.id);
  if (!latest || show.updatedAt - latest.savedAt > AUTO_VERSION_EVERY_MS) {
    await addVersion(show, 'Autosave');
  }
}

export async function addVersion(show: Show, label: string): Promise<void> {
  const database = await db();
  await database.add('versions', { showId: show.id, savedAt: Date.now(), label, show });
  const all = await database.getAllKeysFromIndex('versions', 'showId', show.id);
  const excess = all.length - MAX_VERSIONS;
  for (const key of all.slice(0, Math.max(0, excess))) await database.delete('versions', key);
}

export async function listVersions(showId: string): Promise<VersionRecord[]> {
  const all = await (await db()).getAllFromIndex('versions', 'showId', showId);
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

async function latestVersion(showId: string): Promise<VersionRecord | undefined> {
  return (await listVersions(showId))[0];
}

/** Delete a show, its history and journal, and media no other show uses. */
export async function deleteShow(id: string): Promise<void> {
  const database = await db();
  const show = await database.get('shows', id);
  await database.delete('shows', id);
  await database.delete('journal', id);
  for (const key of await database.getAllKeysFromIndex('versions', 'showId', id)) {
    await database.delete('versions', key);
  }
  for (const key of await database.getAllKeysFromIndex('runs', 'showId', id))
    await database.delete('runs', key);
  if (!show) return;
  const others = [...(await database.getAll('shows')), ...(await listTemplates())];
  const used = new Set(others.flatMap((s) => s.media.map((m) => m.id)));
  for (const m of show.media) if (!used.has(m.id)) await deleteMediaFile(m.id);
}

export function duplicateShow(show: Show, name: string): Show {
  return {
    ...structuredClone(show),
    id: uid('show'),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function listRuns(showId: string): Promise<RunRecord[]> {
  const runs = await (await db()).getAllFromIndex('runs', 'showId', showId);
  return runs.sort((a, b) => b.startedAt - a.startedAt);
}

// ---- .scrim bundles ----

export function bundleFileName(show: Show): string {
  return `${show.name.replace(/[^\w\- ]+/g, '').trim() || 'show'}.scrim`;
}

export function exportStream(show: Show): ReadableStream<Uint8Array> {
  return writeBundle(
    show,
    show.media.map((m) => ({
      id: m.id,
      open: async () => {
        const file = await mediaFile(m.id);
        if (!file) throw new Error(`Media "${m.name}" is missing from this machine`);
        return file.stream();
      },
    })),
  );
}

/** Save a bundle to disk, streaming when the File System Access API is available. */
export async function exportShow(show: Show): Promise<void> {
  const name = bundleFileName(show);
  const picker = (
    window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle> }
  ).showSaveFilePicker;
  if (picker) {
    let handle: FileSystemFileHandle;
    try {
      handle = await picker({
        suggestedName: name,
        types: [{ description: 'Scrim show', accept: { 'application/zip': ['.scrim'] } }],
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      throw e;
    }
    await exportStream(show).pipeTo(await handle.createWritable());
    return;
  }
  const blob = await new Response(exportStream(show)).blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export type ImportConflict = 'replace' | 'copy';

/**
 * Import a bundle. Media is written straight into storage; if a show with the
 * same id exists, `onConflict` decides whether to replace it or keep both.
 */
export async function importShow(
  file: Blob,
  onConflict: (existing: Show) => Promise<ImportConflict | null>,
): Promise<Show | null> {
  const show = await readBundle(file.stream(), { openMedia: (id) => mediaWriter(id) });
  const existing = await getShow(show.id);
  let result = show;
  if (existing) {
    const choice = await onConflict(existing);
    if (!choice) return null;
    if (choice === 'copy') result = duplicateShow(show, `${show.name} (imported)`);
  }
  await saveShow(result);
  return result;
}

export async function restoreVersion(version: VersionRecord, current: Show): Promise<Show> {
  await addVersion(current, 'Before restore');
  const restored = { ...parseShow(structuredClone(version.show)), updatedAt: Date.now() };
  await saveShow(restored);
  return restored;
}
