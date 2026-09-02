import { z } from 'zod';

const objectId = z.string().length(24);

export const createDepartmentDto = z
  .object({
    name: z.string().min(1).max(120).trim(),
    code: z.string().min(1).max(20).trim(),
    parentDepartmentId: objectId.nullable().optional(),
    managerId: objectId.nullable().optional(),
    description: z.string().max(500).optional(),
  })
  .strict();
export type CreateDepartmentDto = z.infer<typeof createDepartmentDto>;

export const updateDepartmentDto = z
  .object({
    name: z.string().min(1).max(120).trim().optional(),
    code: z.string().min(1).max(20).trim().optional(),
    parentDepartmentId: objectId.nullable().optional(),
    managerId: objectId.nullable().optional(),
    description: z.string().max(500).optional(),
    status: z.enum(['active', 'archived']).optional(),
  })
  .strict();
export type UpdateDepartmentDto = z.infer<typeof updateDepartmentDto>;

/** UC-06/07 — assign or remove the department head. */
export const assignHeadDto = z
  .object({ managerId: objectId.nullable() })
  .strict();
export type AssignHeadDto = z.infer<typeof assignHeadDto>;

/** UC-08 — move a department to a new parent (reparent). */
export const moveDepartmentDto = z
  .object({ parentDepartmentId: objectId.nullable() })
  .strict();
export type MoveDepartmentDto = z.infer<typeof moveDepartmentDto>;

/** UC-09 — bulk-transfer employees to another department. Omit employeeIds to move all. */
export const transferEmployeesDto = z
  .object({
    targetDepartmentId: objectId,
    employeeIds: z.array(objectId).nonempty().optional(),
  })
  .strict();
export type TransferEmployeesDto = z.infer<typeof transferEmployeesDto>;

/** UC-10 — merge this department into a target, then archive it. */
export const mergeDepartmentDto = z
  .object({ targetDepartmentId: objectId })
  .strict();
export type MergeDepartmentDto = z.infer<typeof mergeDepartmentDto>;
