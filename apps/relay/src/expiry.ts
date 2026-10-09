/** A room's keys and how long it has been in use. */
export interface RoomLife {
  createdAt: number;
  /** When a socket last joined or the room last had one; absent in rooms made before. */
  lastSeenAt?: number;
  /** A kept room's code stays for its printed QR codes, even through quiet months. */
  keep?: boolean;
}

/** An ordinary room goes once nothing has joined it for this long. */
export const IDLE_EXPIRY_MS = 24 * 60 * 60 * 1000;
/** A kept room's code is held this long after it was last used. */
export const KEEP_MS = 90 * 24 * 60 * 60 * 1000;

const seen = (r: RoomLife) => r.lastSeenAt ?? r.createdAt;

/**
 * What the room's alarm does: wait while sockets are connected; delete an ordinary room once
 * idle; for a kept one, clear what the last show left (votes, state) but hold the code and its
 * keys until it has been unused for 90 days.
 */
export function expiryDecision(
  room: RoomLife,
  now: number,
  connected: number,
): { action: 'wait' | 'clear' | 'delete'; next: number | null } {
  if (connected > 0) return { action: 'wait', next: now + IDLE_EXPIRY_MS };
  if (!room.keep) return { action: 'delete', next: null };
  if (now - seen(room) >= KEEP_MS) return { action: 'delete', next: null };
  return { action: 'clear', next: seen(room) + KEEP_MS };
}

/**
 * Whether a new room may take this code: never while it is kept, connected or used in the last
 * day. (Before, a room counted as free a day after it was made, even in use.)
 */
export function codeInUse(room: RoomLife | null, now: number, connected: number): boolean {
  if (!room) return false;
  return connected > 0 || !!room.keep || now - seen(room) < IDLE_EXPIRY_MS;
}
