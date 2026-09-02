import { z } from 'zod';
import { EMPLOYEE_TYPE, SALARY_ZONE } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import { GENDER, MARITAL_STATUS } from '@modules/hrm/adapters/persistence/mongoose/models/employee-profile.model';

const objectId = z.string().length(24);

export const createEmployeeDto = z.object({
  employeeCode: z.string().min(3).max(40).trim(),
  fingerprintId: z.string().min(1).max(40).trim().optional(),
  departmentId: objectId,
  positionId: objectId,
  managerId: objectId.optional(),
  shiftId: objectId.optional(),
  hireDate: z.coerce.date(),
  employeeType: z.enum(EMPLOYEE_TYPE),
  salaryZone: z.enum(SALARY_ZONE).optional(),
  profile: z.object({
    firstName: z.string().min(1).max(120).trim(),
    middleName: z.string().max(120).trim().optional(),
    lastName: z.string().min(1).max(120).trim(),
    dateOfBirth: z.coerce.date().optional(),
    gender: z.enum(GENDER).optional(),
    nationality: z.string().min(2).max(3).optional(),
    maritalStatus: z.enum(MARITAL_STATUS).optional(),
    email: z.string().email().optional(),
    workEmail: z.string().email().optional(),
    phone: z.string().min(6).max(40).optional(),
    address: z.string().max(255).optional(),
    socialInsuranceNo: z.string().max(40).trim().optional(),
    taxCode: z.string().max(40).trim().optional(),
    vehiclePlate: z.string().max(20).trim().optional(),
  }),
});

export type CreateEmployeeDto = z.infer<typeof createEmployeeDto>;
