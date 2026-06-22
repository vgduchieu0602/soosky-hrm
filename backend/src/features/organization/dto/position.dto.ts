import { z } from 'zod';

const objectId = z.string().length(24);

export const createPositionDto = z
  .object({
    title: z.string().min(1).max(120).trim(),
    code: z.string().min(1).max(20).trim(),
    departmentId: objectId,
    level: z.coerce.number().int().min(1).max(10).default(1),
    description: z.string().max(500).optional(),
  })
  .strict();
export type CreatePositionDto = z.infer<typeof createPositionDto>;

export const updatePositionDto = z
  .object({
    title: z.string().min(1).max(120).trim().optional(),
    departmentId: objectId.optional(),
    level: z.coerce.number().int().min(1).max(10).optional(),
    description: z.string().max(500).optional(),
    status: z.enum(['active', 'archived']).optional(),
  })
  .strict();
export type UpdatePositionDto = z.infer<typeof updatePositionDto>;
