import { z } from 'zod';

// ---- Payroll workflow DTOs (periods themselves live in the `period` feature) ----

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
