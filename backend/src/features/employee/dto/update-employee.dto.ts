import { z } from 'zod';
import { EMPLOYEE_TYPE, EMPLOYEE_STATUS, SALARY_ZONE } from '@shared/models/employee.model';

const objectId = z.string().length(24);

export const updateEmployeeDto = z
  .object({
    departmentId: objectId.optional(),
    positionId: objectId.optional(),
    managerId: objectId.nullable().optional(),
    shiftId: objectId.nullable().optional(),
    employeeType: z.enum(EMPLOYEE_TYPE).optional(),
    status: z.enum(EMPLOYEE_STATUS).optional(),
    salaryZone: z.enum(SALARY_ZONE).optional(),
  })
  .strict();

export type UpdateEmployeeDto = z.infer<typeof updateEmployeeDto>;
