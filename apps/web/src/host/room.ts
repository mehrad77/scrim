import type { CreateRoomResponse } from '@scrim/protocol';
import { defaultRelayUrl } from '../lib/config.js';
import { getSetting, setSetting } from '../storage/db.js';

export interface RoomInfo extends CreateRoomResponse {
  relay: string;
  createdAt: number;
  /**
   * Kept for an installation: the relay holds the code 90 days after its last use, and the host
   * never swaps it for a new one, so printed QR codes keep working.
   */
  keep?: boolean;
}

const key = (showId: string) => `room:${showId}`;

export async function storedRoom(showId: string): Promise<RoomInfo | undefined> {
  return getSetting<RoomInfo>(key(showId));
}

export async function createRoom(
  showId: string,
  relay = defaultRelayUrl(),
  keep = false,
): Promise<RoomInfo> {
  const res = await fetch(`${relay}/api/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error(`The relay refused to open a room (${res.status})`);
  const body = (await res.json()) as CreateRoomResponse;
  const room: RoomInfo = { ...body, relay, createdAt: Date.now() };
  if (keep) await setKept(room, true);
  const stored = keep ? { ...room, keep } : room;
  await setSetting(key(showId), stored);
  return stored;
}

/** Ask the relay to keep a room's code (or let it go). Only the room's host key may. */
export async function setKept(room: RoomInfo, keep: boolean): Promise<void> {
  const res = await fetch(`${room.relay}/api/rooms/${room.code}/keep`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hostKey: room.hostKey, keep }),
  });
  if (res.status === 404) throw new Error(`Room ${room.code} has ended: make a new kept code`);
  if (!res.ok) throw new Error(`The relay refused to keep room ${room.code} (${res.status})`);
}

/** Whether the relay still has this room; null when it can't be reached. */
export async function roomExists(room: RoomInfo): Promise<boolean | null> {
  try {
    const res = await fetch(`${room.relay}/api/rooms/${room.code}`);
    return ((await res.json()) as { exists?: boolean }).exists === true;
  } catch {
    return null;
  }
}

export async function saveRoom(showId: string, room: RoomInfo): Promise<void> {
  await setSetting(key(showId), room);
}

/**
 * A room pass: the code and keys a replacement machine needs to run the same room, so the
 * printed QR codes keep working. It holds the host key: keep it like a password.
 */
export function roomPassFile(showId: string, room: RoomInfo): string {
  return JSON.stringify({ format: 'scrim-room-pass', version: 1, showId, room }, null, 2);
}

export function readRoomPass(text: string): { showId: string; room: RoomInfo } {
  const data = JSON.parse(text) as { format?: string; showId?: string; room?: RoomInfo };
  if (data.format !== 'scrim-room-pass' || !data.room?.code || !data.room.hostKey || !data.showId)
    throw new Error('This is not a Scrim room pass');
  return { showId: data.showId, room: data.room };
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
