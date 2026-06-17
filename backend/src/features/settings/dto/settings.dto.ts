import { z } from 'zod';

// ---------- Company / general config ----------
export const updateCompanyConfigDto = z
  .object({
    companyName: z.string().min(1).max(160).trim().optional(),
    logoUrl: z.string().url().optional(),
    timezone: z.string().min(1).max(64).optional(),
    locale: z.string().min(2).max(10).optional(),
    currency: z.string().min(3).max(3).optional(),
    standardWorkDays: z.coerce.number().int().min(1).max(31).optional(),
    payCycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
    graceLateMinutes: z.coerce.number().int().min(0).max(120).optional(),
    graceEarlyMinutes: z.coerce.number().int().min(0).max(120).optional(),
    contactEmail: z.string().email().optional(),
    address: z.string().max(255).optional(),
  })
  .strict();
export type UpdateCompanyConfigDto = z.infer<typeof updateCompanyConfigDto>;

// ---------- Salary policy config ----------
const componentWeights = z
  .object({
    attendance: z.coerce.number().min(0).max(100),
    performance: z.coerce.number().min(0).max(100),
    goal: z.coerce.number().min(0).max(100),
  })
  .refine((w) => w.attendance + w.performance + w.goal === 100, {
    message: 'Tổng tỉ lệ 3 cấu phần phải bằng 100',
  });

export const createSalaryPolicyDto = z
  .object({
    country: z.string().min(2).max(3),
    year: z.coerce.number().int().min(2000).max(2100),
    effectiveFrom: z.coerce.date(),
    baseSalary: z.coerce.number().nonnegative(),
    insuranceCeilingMultiplier: z.coerce.number().positive().optional(),
    personalDeduction: z.coerce.number().nonnegative().optional(),
    dependentDeduction: z.coerce.number().nonnegative().optional(),
    nonResidentTaxRate: z.coerce.number().min(0).max(100).optional(),
    salaryComponentWeights: componentWeights.optional(),
  })
  .strict();
export type CreateSalaryPolicyDto = z.infer<typeof createSalaryPolicyDto>;

export const updateSalaryPolicyDto = z
  .object({
    effectiveFrom: z.coerce.date().optional(),
    baseSalary: z.coerce.number().nonnegative().optional(),
    insuranceCeilingMultiplier: z.coerce.number().positive().optional(),
    personalDeduction: z.coerce.number().nonnegative().optional(),
    dependentDeduction: z.coerce.number().nonnegative().optional(),
    nonResidentTaxRate: z.coerce.number().min(0).max(100).optional(),
    salaryComponentWeights: componentWeights.optional(),
  })
  .strict();
export type UpdateSalaryPolicyDto = z.infer<typeof updateSalaryPolicyDto>;

// ---------- Performance criterion ----------
export const createCriterionDto = z
  .object({
    key: z.string().min(1).max(60).trim(),
    label: z.string().min(1).max(200).trim(),
    description: z.string().max(500).optional(),
    weight: z.coerce.number().min(0).max(100),
    order: z.coerce.number().int().min(0).optional(),
  })
  .strict();
export type CreateCriterionDto = z.infer<typeof createCriterionDto>;

export const updateCriterionDto = z
  .object({
    label: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(500).optional(),
    weight: z.coerce.number().min(0).max(100).optional(),
    order: z.coerce.number().int().min(0).optional(),
    status: z.enum(['active', 'archived']).optional(),
  })
  .strict();
export type UpdateCriterionDto = z.infer<typeof updateCriterionDto>;
