import type { CreateRoomResponse } from '@scrim/protocol';
import { defaultRelayUrl } from '../lib/config.js';
import { getSetting, setSetting } from '../storage/db.js';

export interface RoomInfo extends CreateRoomResponse {
  relay: string;
  createdAt: number;
}

const key = (showId: string) => `room:${showId}`;

export async function storedRoom(showId: string): Promise<RoomInfo | undefined> {
  return getSetting<RoomInfo>(key(showId));
}

export async function createRoom(showId: string, relay = defaultRelayUrl()): Promise<RoomInfo> {
  const res = await fetch(`${relay}/api/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error(`The relay refused to open a room (${res.status})`);
  const body = (await res.json()) as CreateRoomResponse;
  const room: RoomInfo = { ...body, relay, createdAt: Date.now() };
  await setSetting(key(showId), room);
  return room;
}

/** Base URL phones and remote devices should use to reach this app. */
export function appBase(): string {
  const stored = localStorage.getItem('scrim.publicUrl');
  return (stored || location.origin).replace(/\/$/, '');
}

export function audienceUrl(room: RoomInfo): string {
  return `${appBase()}/audience.html?${new URLSearchParams({ r: room.code, relay: room.relay })}`;
}

/**
 * The audience page for a tablet passed from person to person: each answer counts as its own
 * person. Null for a room made before shared tablets existed.
 */
export function sharedUrl(room: RoomInfo): string | null {
  if (!room.sharedKey) return null;
  return `${appBase()}/audience.html?${new URLSearchParams({ r: room.code, relay: room.relay, s: room.sharedKey })}`;
}

export function remoteUrl(room: RoomInfo): string {
  return `${appBase()}/remote?${new URLSearchParams({ r: room.code, k: room.deviceKey, relay: room.relay })}`;
}

export function remoteOutputUrl(room: RoomInfo, outputId: string): string {
  return `${appBase()}/remote-output?${new URLSearchParams({ r: room.code, k: room.deviceKey, relay: room.relay, o: outputId })}`;
}
