/**
 * Runtime validation for everything that crosses the network from a client.
 * TypeScript types protect us at compile time; these protect us at runtime,
 * because a client is untrusted (anyone on the LAN can open a socket).
 */
import { z } from 'zod';
import { isCardId } from '../domain/cards.js';
import type { CardId } from '../domain/cards.js';
import { PLAYER_COLORS } from '../domain/player.js';
import { TURN_SECONDS_OPTIONS } from '../engine/constants.js';

/** Payload of commands that carry no data. Extra keys are rejected. */
export const emptyPayloadSchema = z.strictObject({});
export type EmptyPayload = z.infer<typeof emptyPayloadSchema>;

/** `host:start`: an omitted or null `turnSeconds` means no turn timer. */
export const startPayloadSchema = z.strictObject({
  turnSeconds: z.literal(TURN_SECONDS_OPTIONS).nullable().optional(),
});
export type StartPayload = z.infer<typeof startPayloadSchema>;

export const kickPayloadSchema = z.strictObject({ playerId: z.string().min(1).max(64) });
export type KickPayload = z.infer<typeof kickPayloadSchema>;

export const joinPayloadSchema = z.strictObject({
  // Length and uniqueness are lobby rules, checked on the server after normalization.
  nickname: z.string().max(64),
  color: z.enum(PLAYER_COLORS),
});
export type JoinPayload = z.infer<typeof joinPayloadSchema>;

const cardIdSchema = z
  .string()
  .refine(isCardId)
  .transform((id) => id as CardId);

export const attackPayloadSchema = z.strictObject({ cardId: cardIdSchema });
export type AttackPayload = z.infer<typeof attackPayloadSchema>;

export const defendPayloadSchema = z.strictObject({
  cardId: cardIdSchema,
  targetAttackIndex: z.number().int().min(0).max(5),
});
export type DefendPayload = z.infer<typeof defendPayloadSchema>;

/** Socket.IO handshake `auth` object. */
export const handshakeAuthSchema = z.discriminatedUnion('role', [
  z.strictObject({ role: z.literal('board') }),
  z.strictObject({
    role: z.literal('player'),
    sessionToken: z.uuid().optional(),
  }),
]);
export type HandshakeAuth = z.infer<typeof handshakeAuthSchema>;
export type ClientRole = HandshakeAuth['role'];
