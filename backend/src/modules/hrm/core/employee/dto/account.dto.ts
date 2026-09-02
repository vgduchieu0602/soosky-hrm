import { z } from 'zod';

export const updateAccountDto = z
  .object({
    status: z.enum(['active', 'disabled']).optional(),
    role: z.string().min(2).max(40).optional(),
  })
  .strict()
  .refine((d) => d.status !== undefined || d.role !== undefined, {
    message: 'Provide status and/or role',
  });

export type UpdateAccountDto = z.infer<typeof updateAccountDto>;
