import type { EngineState } from '@scrim/engine';
import type { Moment, Show } from '@scrim/format';
import type { OutputStatus, RunMode } from './local.js';

/** Roles a socket can join a room as. */
export type Role = 'host' | 'output' | 'remote' | 'audience';

/** Room code alphabet: no 0/O, 1/I/L. */
export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;
export interface CreateRoomResponse {
  code: string;
  hostKey: string;
  /** Shared by performer remotes and remote outputs; audience needs only the code. */
  deviceKey: string;
  /**
   * For shared tablets passed from person to person: each answer carries a ballot number and
   * counts as its own person. Absent for rooms made before shared tablets.
   */
  sharedKey?: string;
}

/** What the relay needs to run an audience moment; sent by the host. */
export type MomentSpec = Pick<
  Moment,
  'id' | 'type' | 'prompt' | 'options' | 'min' | 'max' | 'variants' | 'moderated' | 'i18n'
> & {
  /** Server-clock epoch ms, or null if the operator closes it. */
  closesAt: number | null;
};

/** One open moment as an audience phone sees it. Prop variants are never sent. */
export interface PublicMoment {
  id: string;
  type: Moment['type'];
  prompt: string;
  options: { id: string; label: string }[];
  min: number;
  max: number;
  closesAt: number | null;
  /** This phone's personal prop, for prop moments. */
  prop?: { label: string; content: string };
  /** The prompt and option labels in other languages; the phone picks one. */
  i18n?: Moment['i18n'];
}

/** A text in the show's own language, and its translations by language code. */
export interface Translated {
  text: string;
  i18n: Record<string, string>;
}

/**
 * The personal access channel as phones see it. Every language goes to every phone, so each
 * person's choices (captions, language, description) stay on their phone.
 */
export interface AccessView {
  languages: { base: string; others: string[] };
  /** The caption up now. */
  caption: Translated | null;
  /** The latest description; a phone reads it aloud once per `seq`. */
  description: (Translated & { seq: number }) | null;
  /** The warning of the cue on standby, shown before it comes. */
  warning: Translated | null;
  /** Counts up for each cue that buzzes. */
  buzz: number;
  /** A relaxed performance is on: phones say so, and that it's OK to step out and come back. */
  relaxed?: boolean;
}

export interface RemoteTrigger {
  id: string;
  name: string;
  color: string;
}

export interface RemoteView {
  showName: string;
  triggers: RemoteTrigger[];
  standby: string | null;
  lastFired: string | null;
  connected: boolean;
  /** The cue on standby, so a performer can say they're ready for it. */
  standbyId?: string | null;
  /** The trigger the standby cue waits for: its remotes show "Your cue". */
  waitFor?: string | null;
  /** The operator has the performer's Ready for the standby cue. */
  ready?: boolean;
  /** The trigger the last fired cue waited for: its remotes show it fired. */
  firedFor?: string | null;
  /** Triggers some cue waits for; they do nothing until it's their cue. */
  cueTriggers?: string[];
  /** The show lets remotes press GO, Hold and Back (Remote GO). */
  canGo?: boolean;
  /** For Remote GO: the show is held, and how long GO must be held to fire (0: a tap). */
  held?: boolean;
  goHoldMs?: number;
}

export interface MomentTotals {
  momentId: string;
  tally: Record<string, number>;
  count: number;
  sum: number;
  sumSq: number;
  n: number;
  /** Text entries not yet sent to the host (all of them after a reconnect). */
  entries: { id: string; text: string }[];
}

export interface Presence {
  audience: number;
  remotes: number;
  outputs: number;
}

// ---- host -> relay ----
export type HostToRelay =
  | { t: 'show'; show: Show }
  | { t: 'state'; state: EngineState; mode: RunMode; offset: number }
  | { t: 'moments'; title: string; open: MomentSpec[] }
  | { t: 'remoteView'; view: Omit<RemoteView, 'connected'> }
  /** Null: the show has no access channel now (nothing to caption, not relaxed). */
  | { t: 'access'; view: AccessView | null }
  /** Keep this room's code for an installation (90 days after its last use), or let it go. */
  | { t: 'keep'; keep: boolean }
  | { t: 'ping'; c: number };

// ---- relay -> host ----
export type RelayToHost =
  | { t: 'welcome'; role: 'host'; code: string }
  | { t: 'totals'; totals: MomentTotals[] }
  | { t: 'presence'; presence: Presence }
  | { t: 'trigger'; triggerId: string; from: string }
  | { t: 'ready'; cueId: string; from: string }
  /** Remote GO: the host runs it only if the show allows remotes to. */
  | { t: 'command'; command: 'go' | 'hold' | 'back'; from: string }
  | { t: 'outputBeat'; clientId: string; outputId: string; status: OutputStatus }
  | { t: 'outputGone'; clientId: string }
  | { t: 'pong'; c: number; s: number }
  | { t: 'error'; message: string };

// ---- audience / remote / output -> relay: shapes in validate.ts (the relay checks them) ----
export type { AudienceToRelay, OutputToRelay, RemoteToRelay } from './validate.js';

// ---- relay -> audience / remote / output ----
export type RelayToAudience =
  | { t: 'welcome'; role: 'audience'; title: string }
  | { t: 'view'; title: string; moments: PublicMoment[]; mine: Record<string, unknown> }
  | { t: 'access'; view: AccessView | null }
  | { t: 'pong'; c: number; s: number }
  | { t: 'error'; message: string };

export type RelayToRemote =
  | { t: 'welcome'; role: 'remote' }
  | { t: 'remoteView'; view: RemoteView }
  | { t: 'ack'; triggerId: string }
  | { t: 'pong'; c: number; s: number }
  | { t: 'error'; message: string };

export type RelayToOutput =
  | { t: 'welcome'; role: 'output' }
  | { t: 'show'; show: Show }
  | { t: 'state'; state: EngineState; mode: RunMode; offset: number }
  | { t: 'hostGone' }
  | { t: 'pong'; c: number; s: number }
  | { t: 'error'; message: string };

/** Close codes the relay uses. */
export const CLOSE = {
  badRequest: 4400,
  unauthorized: 4401,
  notFound: 4404,
  full: 4409,
  replaced: 4410,
} as const;
