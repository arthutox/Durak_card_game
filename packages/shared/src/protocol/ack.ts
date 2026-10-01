import type { ErrorCode } from './errors.js';

/** Every client → server command is acknowledged with one of these. */
export type Ack<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: ErrorCode };

export type AckFn<T> = (response: Ack<T>) => void;

export const ackOk = <T>(data: T): Ack<T> => ({ ok: true, data });
export const ackError = (error: ErrorCode): Ack<never> => ({ ok: false, error });
