import { z } from "zod";

// Client-side field validation for the org dialogs. Mirrors backend
// department.dto.ts / position.dto.ts. Used via safeParse to surface
// per-field error messages.

const codeRule = z
  .string()
  .trim()
  .min(1, "Bắt buộc")
  .max(20, "≤ 20 ký tự")
  .regex(/^[A-Z0-9_-]+$/, "Chỉ chữ HOA, số, - hoặc _");

export const departmentFormSchema = z.object({
  name: z.string().trim().min(1, "Bắt buộc").max(120, "≤ 120 ký tự"),
  code: codeRule,
  parentDepartmentId: z.string(),
  description: z.string().max(500, "≤ 500 ký tự"),
  status: z.enum(["active", "archived"]),
});
export type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

export const positionFormSchema = z.object({
  title: z.string().trim().min(1, "Bắt buộc").max(120, "≤ 120 ký tự"),
  code: codeRule,
  level: z.number().int().min(1).max(10),
  description: z.string().max(500, "≤ 500 ký tự"),
});
export type PositionFormValues = z.infer<typeof positionFormSchema>;

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
