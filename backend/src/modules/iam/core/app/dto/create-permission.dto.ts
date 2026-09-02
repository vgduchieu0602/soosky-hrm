import { z } from 'zod';

export const createPermissionDto = z.object({
  key: z.string().min(1).max(120).trim(),
  resource: z.string().min(1).max(120).trim(),
  action: z.enum(['create', 'read', 'update', 'delete', 'approve']),
  description: z.string().max(500).optional(),
});

export type CreatePermissionDto = z.infer<typeof createPermissionDto>;
