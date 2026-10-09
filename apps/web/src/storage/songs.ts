import { readSongsFile, songsFile, type Song } from '../lib/songs.js';
import { getSetting, setSetting } from './db.js';

/**
 * The song library on this machine: every show's song wizard picks from it. It lives in the
 * settings store, as templates do, so no database upgrade can block a tab that is running a
 * show.
 */
const KEY = 'songs';

export async function listSongs(): Promise<Song[]> {
  const songs = (await getSetting<Song[]>(KEY)) ?? [];
  return songs.sort((a, b) => a.title.localeCompare(b.title));
}

export async function saveSong(song: Song): Promise<void> {
  const rest = (await listSongs()).filter((s) => s.id !== song.id);
  await setSetting(KEY, [...rest, { ...song, updatedAt: Date.now() }]);
}

export async function deleteSong(id: string): Promise<void> {
  await setSetting(
    KEY,
    (await listSongs()).filter((s) => s.id !== id),
  );
}

/** Add the songs in a songs file to the library; how many it added. */
export async function importSongs(file: Blob): Promise<number> {
  const songs = readSongsFile(await file.text());
  await setSetting(KEY, [...(await listSongs()), ...songs]);
  return songs.length;
}

/** Download the whole library as one file, to share or to move to another machine. */
export async function exportSongs(): Promise<void> {
  const blob = new Blob([songsFile(await listSongs())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'songs.scrim-songs.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
