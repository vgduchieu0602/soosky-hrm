/**
 * IAM domain rules — pure, framework-free. No Express, no Mongoose, no crypto.
 */
import type { SetupTokenPurpose } from '@features/iam/domain/setup-token-purpose';

/** After this many consecutive failed logins an active account is locked. */
export const MAX_FAILED_ATTEMPTS = 5;

/** Treat an identifier as an email when it looks like one; otherwise username. */
export function isEmailIdentifier(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * TTL (ms) for a single-use password token. Onboarding setup links live longer
 * than security-sensitive reset links.
 */
export const SETUP_TOKEN_TTL_MS: Record<SetupTokenPurpose, number> = {
  setup: 7 * 24 * 60 * 60 * 1000, // 7 days
  reset: 2 * 60 * 60 * 1000, // 2 hours
};

/** Build the web link the recipient clicks to land on the set-password page. */
export function buildSetPasswordUrl(baseUrl: string, rawToken: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/auth/set-password?token=${encodeURIComponent(rawToken)}`;
}
