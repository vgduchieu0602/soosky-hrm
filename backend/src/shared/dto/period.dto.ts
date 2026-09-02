import { z } from 'zod';

/**
 * Shared DTOs for the HR "period" concept (collection `payrollPeriods`).
 * Lives in `shared/` so both `features/period` and `features/payroll` can import
 * them without creating a feature-to-feature circular dependency. The collection
 * is owned by the `period` feature; payroll only *consumes* periods via
 * `PeriodReader`.
 */

export const createPeriodDto = z.object({
  name: z.string().trim().min(1).max(40),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  payDate: z.coerce.date(),
  standardWorkDays: z.number().int().positive().max(31).optional(),
});
export type CreatePeriodDto = z.infer<typeof createPeriodDto>;

export const updatePeriodDto = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  payDate: z.coerce.date().optional(),
  standardWorkDays: z.number().int().positive().max(31).optional(),
});
export type UpdatePeriodDto = z.infer<typeof updatePeriodDto>;
