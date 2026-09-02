import { z } from 'zod';

export const grantLoginDto = z
  .object({
    username: z.string().min(3).max(120).trim().optional(),
    // Supplement / override the personal email when the profile has none (or to
    // correct it). Persisted to the profile and used as the invite recipient.
    email: z.string().email().max(120).trim().toLowerCase().optional(),
    sendEmail: z.boolean().default(true),
  })
  .strict();

export type GrantLoginDto = z.infer<typeof grantLoginDto>;
