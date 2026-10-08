import type { EngineState } from '@scrim/engine';
import type { Show } from '@scrim/format';
import type { RunMode } from '@scrim/protocol';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface VersionRecord {
  id?: number;
  showId: string;
  savedAt: number;
  label: string;
  show: Show;
}

export interface JournalRecord {
  showId: string;
  runId: string;
  mode: RunMode;
  savedAt: number;
  state: EngineState;
}

export interface RunLogEntry {
  at: number;
  kind: 'cue' | 'moment' | 'trigger' | 'rule' | 'panic' | 'warning' | 'info';
  text: string;
  /** Folded lines under the entry, such as why each skipped rule didn't run. */
  detail?: string[];
}

export interface RunRecord {
  id: string;
  showId: string;
  showName: string;
  startedAt: number;
  endedAt: number;
  cuesFired: number;
  entries: RunLogEntry[];
}

interface ScrimDB extends DBSchema {
  shows: { key: string; value: Show };
  versions: { key: number; value: VersionRecord; indexes: { showId: string } };
  journal: { key: string; value: JournalRecord };
  runs: { key: string; value: RunRecord; indexes: { showId: string } };
  settings: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<ScrimDB>> | null = null;

export function db(): Promise<IDBPDatabase<ScrimDB>> {
  dbPromise ??= openDB<ScrimDB>('scrim', 1, {
    upgrade(database) {
      database.createObjectStore('shows', { keyPath: 'id' });
      const versions = database.createObjectStore('versions', {
        keyPath: 'id',
        autoIncrement: true,
      });
      versions.createIndex('showId', 'showId');
      database.createObjectStore('journal', { keyPath: 'showId' });
      const runs = database.createObjectStore('runs', { keyPath: 'id' });
      runs.createIndex('showId', 'showId');
      database.createObjectStore('settings');
    },
  });
  return dbPromise;
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('settings', key)) as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put('settings', value, key);
}

export async function deleteSetting(key: string): Promise<void> {
  await (await db()).delete('settings', key);
}
