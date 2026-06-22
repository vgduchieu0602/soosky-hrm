import { z } from "zod";

// Client-side validation for payroll forms. Mirrors backend DTOs
// (payroll-period.dto.ts, compensation.dto.ts).

export const periodFormSchema = z.object({
  name: z.string().regex(/^\d{4}-\d{2}$/, "Dạng YYYY-MM, vd 2026-06"),
  startDate: z.string().min(1, "Bắt buộc"),
  endDate: z.string().min(1, "Bắt buộc"),
  payDate: z.string().min(1, "Bắt buộc"),
  standardWorkDays: z.number().int().min(1, "≥ 1").max(31, "≤ 31"),
});

export const allowanceFormSchema = z.object({
  employeeId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Chọn nhân viên"),
  name: z.string().trim().min(1, "Bắt buộc").max(120, "≤ 120 ký tự"),
  type: z.enum(["fixed", "percentage"]),
  amount: z.number().min(0, "≥ 0"),
  effectiveDate: z.string().min(1, "Bắt buộc"),
});

export const bonusFormSchema = z.object({
  employeeId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Chọn nhân viên"),
  payrollPeriodId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Chọn kỳ lương"),
  name: z.string().trim().min(1, "Bắt buộc").max(120, "≤ 120 ký tự"),
  amount: z.number().min(0, "≥ 0"),
});

export const deductionFormSchema = z.object({
  employeeId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Chọn nhân viên"),
  name: z.string().trim().min(1, "Bắt buộc").max(120, "≤ 120 ký tự"),
  type: z.enum(["fixed", "percentage"]),
  amount: z.number().min(0, "≥ 0"),
  effectiveDate: z.string().min(1, "Bắt buộc"),
});

export const taxProfileFormSchema = z.object({
  employeeId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Chọn nhân viên"),
  dependentsCount: z.number().int().min(0, "≥ 0"),
  effectiveDate: z.string().min(1, "Bắt buộc"),
});

/** Returns a map of field → first error message, or null if valid. */
export function fieldErrors(
  schema: z.ZodType,
  value: unknown,
): Record<string, string> | null {
  const res = schema.safeParse(value);
  if (res.success) return null;
  const errs: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !errs[key]) errs[key] = issue.message;
  }
  return errs;
}
