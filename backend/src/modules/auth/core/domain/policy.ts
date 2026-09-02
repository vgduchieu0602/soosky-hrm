/**
 * Auth domain rules — pure, framework-free. No Express, no Mongoose, no crypto.
 */
import type { SetupTokenPurpose } from '@modules/auth/core/domain/setup-token-purpose';

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
