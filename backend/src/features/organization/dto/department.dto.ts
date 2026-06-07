import { z } from 'zod';

const objectId = z.string().length(24);

export const createDepartmentDto = z
  .object({
    name: z.string().min(1).max(120).trim(),
    code: z.string().min(1).max(20).trim(),
    parentDepartmentId: objectId.nullable().optional(),
    description: z.string().max(500).optional(),
  })
  .strict();
export type CreateDepartmentDto = z.infer<typeof createDepartmentDto>;

export const updateDepartmentDto = z
  .object({
    name: z.string().min(1).max(120).trim().optional(),
    parentDepartmentId: objectId.nullable().optional(),
    description: z.string().max(500).optional(),
    status: z.enum(['active', 'archived']).optional(),
  })
  .strict();
export type UpdateDepartmentDto = z.infer<typeof updateDepartmentDto>;
