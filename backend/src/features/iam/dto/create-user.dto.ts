import { z } from 'zod';

export const createUserDto = z.object({
  username: z.string().min(3).max(120).trim(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(200),
  employeeId: z.string().length(24).optional(),
});

export type CreateUserDto = z.infer<typeof createUserDto>;
