/**
 * Why a single-use password token was issued. A domain concept, not a storage
 * detail: `SETUP_TOKEN_TTL_MS` in `domain/policy.ts` keys its TTL rule off it
 * and the password-setup use-case takes it as an argument. Persistence merely
 * stores the value (and reuses the tuple as the Mongoose `enum` validator).
 *
 * 'setup' = brand-new account first password; 'reset' = forgotten/admin reset.
 */
export const SETUP_TOKEN_PURPOSE = ['setup', 'reset'] as const;
export type SetupTokenPurpose = (typeof SETUP_TOKEN_PURPOSE)[number];
