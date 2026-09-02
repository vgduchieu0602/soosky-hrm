import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Id không hợp lệ');

// Statuses HR may set explicitly (without check-in/out times).
const manualStatus = z.enum(['leave_paid', 'leave_unpaid', 'holiday', 'absent']);

// Slot = (employee, date, shift/ca). Each day can hold N ca, one record per ca.
export const upsertAttendanceDto = z
  .object({
    employeeId: objectId,
    date: z.coerce.date(),
    shiftId: objectId,
    checkIn: z.coerce.date().nullable().optional(),
    checkOut: z.coerce.date().nullable().optional(),
    status: manualStatus.optional(),
    note: z.string().max(255).nullable().optional(),
  })
  .strict();
export type UpsertAttendanceDto = z.infer<typeof upsertAttendanceDto>;

export const adjustAttendanceDto = z
  .object({
    shiftId: objectId.optional(),
    checkIn: z.coerce.date().nullable().optional(),
    checkOut: z.coerce.date().nullable().optional(),
    status: manualStatus.optional(),
    note: z.string().max(255).nullable().optional(),
    reason: z.string().max(255).optional(),
  })
  .strict();
export type AdjustAttendanceDto = z.infer<typeof adjustAttendanceDto>;

export const bulkUpsertAttendanceDto = z
  .object({ rows: z.array(upsertAttendanceDto).min(1).max(500) })
  .strict();
export type BulkUpsertAttendanceDto = z.infer<typeof bulkUpsertAttendanceDto>;
