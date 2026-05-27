import { z } from 'zod';

export const createRoleDto = z.object({
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().length(24)).optional(),
});

export type CreateRoleDto = z.infer<typeof createRoleDto>;
