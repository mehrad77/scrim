import { z } from 'zod';
import { ROOM_ALPHABET, ROOM_CODE_LENGTH } from './relay.js';

/*
 * What the relay accepts from devices it doesn't trust, checked with zod. Only the relay
 * imports these values, so phones and output windows never download zod (the package is
 * side-effect free, so an unused module is dropped).
 */

export const RoomCodeSchema = z
  .string()
  .regex(new RegExp(`^[${ROOM_ALPHABET}]{${ROOM_CODE_LENGTH}}$`));

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
