import type { EngineState } from '@scrim/engine';
import type { Show } from '@scrim/format';

/** Messages on the same-machine BroadcastChannel `scrim:<showId>`. */
export const PROTOCOL_VERSION = 1;

export type RunMode = 'rehearsal' | 'show';

export interface OutputStatus {
  fullscreen: boolean;
  width: number;
  height: number;
  /** Label of the screen the window is on, when the browser exposes it. */
  screen: string | null;
  errors: string[];
}

export interface JoinInfo {
  /** The five-letter room code. */
  code: string;
  /** The audience page's address with the room in it. */
  url: string;
}

export type HostMessage =
  | { t: 'show'; v: number; show: Show }
  | { t: 'state'; v: number; seq: number; state: EngineState; mode: RunMode; offset: number }
  | { t: 'beat'; v: number; hostId: string }
  | { t: 'identify'; v: number; outputId: string | null }
  /** How phones join, for {{join_code}} and join QR codes on stage; null while no room is open. */
  | { t: 'join'; v: number; join: JoinInfo | null }
  | { t: 'closing'; v: number; hostId: string };

export type ClientMessage =
  | { t: 'hello'; v: number; clientId: string; role: 'output' | 'editor'; outputId: string | null }
  | { t: 'outputBeat'; v: number; clientId: string; outputId: string; status: OutputStatus }
  | { t: 'mediaEnded'; v: number; layerId: string }
  | { t: 'showSaved'; v: number; show: Show }
  /** A key pressed in another Scrim window, so GO and panic work from any screen. */
  /** `code` is the physical key (`KeyboardEvent.code`); older windows send only `key`. */
  | { t: 'key'; v: number; key: string; code?: string }
  /** That key came back up, for a hold-to-confirm GO. */
  | { t: 'keyUp'; v: number; key: string; code?: string }
  /** An output window could not start sound until clicked. */
  | { t: 'audioBlocked'; v: number; outputId: string }
  | { t: 'bye'; v: number; clientId: string }
  /** The show's stored room changed (kept, a new code, a room pass): a running show reconnects. */
  | { t: 'roomChanged'; v: number };

export type LocalMessage = HostMessage | ClientMessage;

export function channelName(showId: string): string {
  return `scrim:${showId}`;
}
