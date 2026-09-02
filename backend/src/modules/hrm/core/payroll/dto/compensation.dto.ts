import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Id không hợp lệ');

// ---- Allowance ----
export const createAllowanceDto = z
  .object({
    employeeId: objectId,
    name: z.string().min(1).max(120),
    category: z
      .enum(['position', 'responsibility', 'transport', 'meal', 'housing', 'phone', 'other'])
      .optional(),
    type: z.enum(['fixed', 'percentage']),
    amount: z.coerce.number().min(0),
    isTaxable: z.coerce.boolean(),
    isInsuranceBase: z.coerce.boolean().optional(),
    effectiveDate: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
    note: z.string().max(255).nullable().optional(),
  })
  .strict();
export type CreateAllowanceDto = z.infer<typeof createAllowanceDto>;

export const updateAllowanceDto = createAllowanceDto.partial().strict();
export type UpdateAllowanceDto = z.infer<typeof updateAllowanceDto>;

// ---- Bonus ----
export const createBonusDto = z
  .object({
    employeeId: objectId,
    payrollPeriodId: objectId,
    name: z.string().min(1).max(120),
    amount: z.coerce.number().min(0),
    isTaxable: z.coerce.boolean().optional(),
    reason: z.string().max(255).nullable().optional(),
  })
  .strict();
export type CreateBonusDto = z.infer<typeof createBonusDto>;

export const updateBonusDto = z
  .object({
    name: z.string().min(1).max(120).optional(),
    amount: z.coerce.number().min(0).optional(),
    isTaxable: z.coerce.boolean().optional(),
    reason: z.string().max(255).nullable().optional(),
  })
  .strict();
export type UpdateBonusDto = z.infer<typeof updateBonusDto>;

// ---- Deduction (post-tax) ----
export const createDeductionDto = z
  .object({
    employeeId: objectId,
    payrollPeriodId: objectId.nullable().optional(),
    name: z.string().min(1).max(120),
    type: z.enum(['fixed', 'percentage']),
    amount: z.coerce.number().min(0),
    reason: z.string().max(255).nullable().optional(),
    effectiveDate: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
  })
  .strict();
export type CreateDeductionDto = z.infer<typeof createDeductionDto>;

export const updateDeductionDto = createDeductionDto.partial().strict();
export type UpdateDeductionDto = z.infer<typeof updateDeductionDto>;

// ---- Employee tax profile ----
export const upsertTaxProfileDto = z
  .object({
    employeeId: objectId,
    taxCode: z.string().max(20).nullable().optional(),
    isResident: z.coerce.boolean().optional(),
    dependentsCount: z.coerce.number().int().min(0),
    insuranceAmount: z.coerce.number().min(0).optional(),
    effectiveDate: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
    note: z.string().max(255).nullable().optional(),
  })
  .strict();
export type UpsertTaxProfileDto = z.infer<typeof upsertTaxProfileDto>;
