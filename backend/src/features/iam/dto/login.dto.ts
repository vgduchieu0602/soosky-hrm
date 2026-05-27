import { z } from 'zod';

export const loginDto = z.object({
  identifier: z.string().min(1, 'identifier required').max(120).trim(),
  password: z.string().min(1, 'password required').max(200),
});

export type LoginDto = z.infer<typeof loginDto>;
