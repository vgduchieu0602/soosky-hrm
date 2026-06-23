import { z } from "zod";

// Mirrors backend update-profile.dto.ts + update-employee.dto.ts.
// No `.transform()` here so the form's input/output type stays identical
// (required by react-hook-form's resolver). Empty strings are converted to
// `undefined` in the submit handler instead.
const emailOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, {
    message: "Email không hợp lệ",
  });

export const editEmployeeSchema = z.object({
  // profile (PII)
  firstName: z.string().trim().min(1, "Bắt buộc").max(120),
  middleName: z.string().trim().max(120),
  lastName: z.string().trim().min(1, "Bắt buộc").max(120),
  dateOfBirth: z.string(),
  gender: z.enum(["male", "female", "other", "undisclosed"]),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]),
  nationality: z.string().trim().min(2, "≥ 2 ký tự").max(3, "≤ 3 ký tự"),
  phone: z.string(),
  email: emailOrEmpty, // personal
  workEmail: emailOrEmpty, // company
  address: z.string(),
  // work info
  departmentId: z.string().length(24, "Chọn phòng ban"),
  positionId: z.string().length(24, "Chọn chức vụ"),
  managerId: z.string(),
  shiftId: z.string(),
  employeeType: z.enum(["full_time", "part_time", "contract", "intern"]),
  salaryZone: z.enum(["zone1", "zone2", "zone3", "zone4"]),
});

export type EditEmployeeForm = z.infer<typeof editEmployeeSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Bắt buộc").max(120),
  relationship: z.enum(["spouse", "parent", "sibling", "other"]),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || v.length >= 6, { message: "≥ 6 ký tự" }),
  isPrimary: z.boolean().optional(),
});

export const contractSchema = z.object({
  contractType: z.enum(["fixed_term", "indefinite"]),
  employmentStatus: z.enum(["probation", "official", "internship"]).default("official"),
  contractNumber: z.string().trim().min(1, "Bắt buộc").max(80),
  startDate: z.string().min(1, "Bắt buộc"),
  endDate: z
    .string()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  baseSalary: z.coerce.number().nonnegative("≥ 0"),
});
