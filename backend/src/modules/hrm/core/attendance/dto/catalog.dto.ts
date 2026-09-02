import { z } from 'zod';
import { SHIFT_TYPE } from '@modules/hrm/adapters/persistence/mongoose/models/shift.model';
import { PAID_STATUS } from '@modules/hrm/adapters/persistence/mongoose/models/attendance-symbol.model';
import { ATTENDANCE_STATUS } from '@modules/hrm/adapters/persistence/mongoose/models/attendance.model';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Định dạng HH:mm');

// ---- Shift ----
export const createShiftDto = z
  .object({
    name: z.string().min(1).max(120).trim(),
    type: z.enum(SHIFT_TYPE).optional(),
    startTime: hhmm,
    endTime: hhmm,
    breakMinutes: z.coerce.number().int().min(0).max(480).optional(),
    workingDays: z.array(z.coerce.number().int().min(1).max(7)).optional(),
  })
  .strict();
export type CreateShiftDto = z.infer<typeof createShiftDto>;

export const updateShiftDto = createShiftDto
  .partial()
  .extend({ status: z.enum(['active', 'archived']).optional() });
export type UpdateShiftDto = z.infer<typeof updateShiftDto>;

// ---- Holiday ----
export const createHolidayDto = z
  .object({
    name: z.string().min(1).max(160).trim(),
    date: z.coerce.date(),
    isRecurring: z.boolean().optional(),
    country: z.string().min(1).max(3).optional(),
    description: z.string().max(255).optional(),
  })
  .strict();
export type CreateHolidayDto = z.infer<typeof createHolidayDto>;

export const updateHolidayDto = createHolidayDto.partial();
export type UpdateHolidayDto = z.infer<typeof updateHolidayDto>;

// ---- Attendance symbol ----
export const createSymbolDto = z
  .object({
    code: z.string().min(1).max(10).trim(),
    label: z.string().min(1).max(120).trim(),
    paidStatus: z.enum(PAID_STATUS).optional(),
    affectsPayroll: z.boolean().optional(),
    leaveType: z.string().max(40).optional(),
    color: z.string().max(20).optional(),
    appliesTo: z.enum(ATTENDANCE_STATUS).optional(),
  })
  .strict();
export type CreateSymbolDto = z.infer<typeof createSymbolDto>;

export const updateSymbolDto = createSymbolDto.partial().extend({
  // allow clearing the status assignment
  appliesTo: z.enum(ATTENDANCE_STATUS).nullable().optional(),
});
export type UpdateSymbolDto = z.infer<typeof updateSymbolDto>;
