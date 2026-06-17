import { z } from 'zod';

export const updateRoleDto = z
  .object({
    description: z.string().max(500).optional(),
    permissionIds: z.array(z.string().length(24)).optional(),
  })
  .strict();

export type UpdateRoleDto = z.infer<typeof updateRoleDto>;
