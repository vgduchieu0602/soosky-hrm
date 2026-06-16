import { z } from 'zod';

export const setPasswordDto = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8).max(72),
  })
  .strict();

export type SetPasswordDto = z.infer<typeof setPasswordDto>;
