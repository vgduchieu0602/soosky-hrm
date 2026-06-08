import { z } from 'zod';

export const changePasswordDto = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(72),
  })
  .strict();

export type ChangePasswordDto = z.infer<typeof changePasswordDto>;
