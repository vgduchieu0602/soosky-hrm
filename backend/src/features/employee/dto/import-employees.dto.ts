import { z } from 'zod';
import { EMPLOYEE_TYPE, SALARY_ZONE } from '@shared/models/employee.model';
import { GENDER } from '@shared/models/employee-profile.model';

// One CSV row → one employee. Department/position are referenced by their human
// CODE (resolved server-side) instead of ObjectId, since the CSV is hand-edited.
export const importEmployeeRowDto = z.object({
  employeeCode: z.string().min(3).max(40).trim(),
  firstName: z.string().min(1).max(120).trim(),
  middleName: z.string().max(120).trim().optional(),
  lastName: z.string().min(1).max(120).trim(),
  departmentCode: z.string().min(1).max(20).trim(),
  positionCode: z.string().min(1).max(20).trim(),
  employeeType: z.enum(EMPLOYEE_TYPE),
  hireDate: z.coerce.date(),
  email: z.string().email().optional(),
  phone: z.string().min(6).max(40).optional(),
  gender: z.enum(GENDER).optional(),
  salaryZone: z.enum(SALARY_ZONE).optional(),
});
export type ImportEmployeeRowDto = z.infer<typeof importEmployeeRowDto>;

export const importEmployeesDto = z
  .object({ rows: z.array(importEmployeeRowDto).min(1).max(500) })
  .strict();
export type ImportEmployeesDto = z.infer<typeof importEmployeesDto>;
