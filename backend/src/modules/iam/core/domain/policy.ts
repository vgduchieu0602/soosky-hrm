/**
 * IAM domain rules — pure, framework-free. No Express, no Mongoose, no crypto.
 * These describe the identity store itself: how an account is looked up and
 * when repeated failures lock it.
 */

/** After this many consecutive failed logins an active account is locked. */
export const MAX_FAILED_ATTEMPTS = 5;

/** Treat an identifier as an email when it looks like one; otherwise username. */
export function isEmailIdentifier(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
