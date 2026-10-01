import { NICKNAME_MAX_LENGTH } from '@durak/shared';

/**
 * Trims and collapses inner whitespace. Returns null when the result is not a
 * valid nickname (1..16 characters, counted as user-visible code points so
 * emoji and Cyrillic count as one character each).
 */
export function normalizeNickname(raw: string): string | null {
  const nickname = raw.trim().replace(/\s+/g, ' ');
  const length = [...nickname].length;
  return length >= 1 && length <= NICKNAME_MAX_LENGTH ? nickname : null;
}

/** Nicknames are unique case-insensitively: "Artur" and "artur" collide. */
export function sameNickname(a: string, b: string): boolean {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase();
}
