import { z } from 'zod';

export const grantLoginDto = z
  .object({
    username: z.string().min(3).max(120).trim().optional(),
    sendEmail: z.boolean().default(true),
  })
  .strict();

export type GrantLoginDto = z.infer<typeof grantLoginDto>;
