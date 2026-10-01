/**
 * Explicit success/failure value. Rule violations are expected outcomes, not
 * exceptions, so domain code returns a Result instead of throwing.
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
