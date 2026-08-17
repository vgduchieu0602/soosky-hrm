import { z } from 'zod';

const group = z.enum(['performance', 'goal']);

export const createCriterionDto = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  type: group,
  weight: z.coerce.number().min(0).max(100),
  order: z.coerce.number().int().min(0).optional(),
}).strict();
export type CreateCriterionDto = z.infer<typeof createCriterionDto>;

export const updateCriterionDto = createCriterionDto.omit({ key: true }).partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required',
);
export type UpdateCriterionDto = z.infer<typeof updateCriterionDto>;
