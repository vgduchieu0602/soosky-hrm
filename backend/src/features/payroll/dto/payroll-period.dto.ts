import { z } from 'zod';

export const createPeriodDto = z
  .object({
    name: z.string().regex(/^\d{4}-\d{2}$/, 'name phải dạng YYYY-MM'),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    payDate: z.coerce.date(),
    standardWorkDays: z.coerce.number().int().min(1).max(31).optional(),
  })
  .strict();
export type CreatePeriodDto = z.infer<typeof createPeriodDto>;

export const updatePeriodDto = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    payDate: z.coerce.date().optional(),
    standardWorkDays: z.coerce.number().int().min(1).max(31).optional(),
  })
  .strict();
export type UpdatePeriodDto = z.infer<typeof updatePeriodDto>;

export const approvePayrollDto = z
  .object({
    employeeId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Id không hợp lệ')
      .optional(),
  })
  .strict();
export type ApprovePayrollDto = z.infer<typeof approvePayrollDto>;

export const runPeriodDto = z
  .object({
    requireApprovedEvaluation: z.coerce.boolean().optional(),
  })
  .strict();
export type RunPeriodDto = z.infer<typeof runPeriodDto>;
