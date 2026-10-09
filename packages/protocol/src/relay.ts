import { z } from 'zod';
import type { EngineState } from '@scrim/engine';
import type { Moment, Show } from '@scrim/format';
import type { OutputStatus, RunMode } from './local.js';

/** Roles a socket can join a room as. */
export type Role = 'host' | 'output' | 'remote' | 'audience';

/** Room code alphabet: no 0/O, 1/I/L. */
export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;
export const RoomCodeSchema = z
  .string()
  .regex(new RegExp(`^[${ROOM_ALPHABET}]{${ROOM_CODE_LENGTH}}$`));

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
  'id' | 'type' | 'prompt' | 'options' | 'min' | 'max' | 'variants' | 'moderated'
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

// ---- audience / remote / output -> relay (untrusted: validated) ----
/** A shared tablet's person number; ignored from phones joined without the shared key. */
const Ballot = z.number().int().min(0).max(100_000).optional();

export const AudienceToRelaySchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('vote'),
    momentId: z.string().max(64),
    optionId: z.string().max(64),
    ballot: Ballot,
  }),
  z.object({
    t: z.literal('tap'),
    momentId: z.string().max(64),
    count: z.number().int().min(1).max(50),
  }),
  z.object({
    t: z.literal('slider'),
    momentId: z.string().max(64),
    value: z.number().finite(),
    ballot: Ballot,
  }),
  z.object({
    t: z.literal('text'),
    momentId: z.string().max(64),
    text: z.string().trim().min(1).max(280),
    ballot: Ballot,
  }),
  z.object({ t: z.literal('ping'), c: z.number() }),
]);
export type AudienceToRelay = z.infer<typeof AudienceToRelaySchema>;

export const RemoteToRelaySchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('trigger'), triggerId: z.string().max(64) }),
  z.object({ t: z.literal('ready'), cueId: z.string().max(64) }),
  z.object({ t: z.literal('command'), command: z.enum(['go', 'hold', 'back']) }),
  z.object({ t: z.literal('ping'), c: z.number() }),
]);
export type RemoteToRelay = z.infer<typeof RemoteToRelaySchema>;

export const OutputToRelaySchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('outputBeat'),
    outputId: z.string().max(64),
    status: z.object({
      fullscreen: z.boolean(),
      width: z.number(),
      height: z.number(),
      screen: z.string().max(200).nullable(),
      errors: z.array(z.string().max(500)).max(20),
    }),
  }),
  z.object({ t: z.literal('ping'), c: z.number() }),
]);
export type OutputToRelay = z.infer<typeof OutputToRelaySchema>;

// ---- relay -> audience / remote / output ----
export type RelayToAudience =
  | { t: 'welcome'; role: 'audience'; title: string }
  | { t: 'view'; title: string; moments: PublicMoment[]; mine: Record<string, unknown> }
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
