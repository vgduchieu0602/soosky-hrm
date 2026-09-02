import { randomInt } from 'node:crypto';

// Unambiguous alphabet (no 0/O/1/l/I) so emailed passwords are easy to type.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '@#$%&*';
const ALL = UPPER + LOWER + DIGITS + SPECIAL;

function pick(set: string): string {
  return set[randomInt(set.length)]!;
}

/**
 * Generate a random secret (default 10 chars) guaranteed to contain at least
 * one upper, lower, digit and special character.
 *
 * Used to seed a provisioned account with a credential nobody knows: the
 * `users.password` column is required, but the employee never receives this
 * value — they set their own password through the single-use link that
 * `PasswordSetupUseCases` issues. It is never emailed, returned or logged.
 */
export function generateRandomPassword(length = 10): string {
  const len = Math.max(8, length);
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  const rest = Array.from({ length: len - required.length }, () => pick(ALL));
  const chars = [...required, ...rest];
  // Fisher–Yates shuffle so the required chars are not always at the front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
