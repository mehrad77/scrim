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

export type HostMessage =
  | { t: 'show'; v: number; show: Show }
  | { t: 'state'; v: number; seq: number; state: EngineState; mode: RunMode; offset: number }
  | { t: 'beat'; v: number; hostId: string }
  | { t: 'identify'; v: number; outputId: string | null }
  | { t: 'closing'; v: number; hostId: string };

export type ClientMessage =
  | { t: 'hello'; v: number; clientId: string; role: 'output' | 'editor'; outputId: string | null }
  | { t: 'outputBeat'; v: number; clientId: string; outputId: string; status: OutputStatus }
  | { t: 'mediaEnded'; v: number; layerId: string }
  | { t: 'showSaved'; v: number; show: Show }
  /** A key pressed in another Scrim window, so GO and panic work from any screen. */
  | { t: 'key'; v: number; key: string }
  /** An output window could not start sound until clicked. */
  | { t: 'audioBlocked'; v: number; outputId: string }
  | { t: 'bye'; v: number; clientId: string };

export type LocalMessage = HostMessage | ClientMessage;

export function channelName(showId: string): string {
  return `scrim:${showId}`;
}
