import { z } from 'zod';
import { LEAVE_TYPE } from '@shared/models/leave-request.model';

export const submitLeaveDto = z
  .object({
    leaveType: z.enum(LEAVE_TYPE),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    halfDaySession: z.enum(['morning', 'afternoon']).nullable().optional(),
    reason: z.string().max(500).optional(),
  })
  .strict()
  .refine((d) => d.endDate >= d.startDate, {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['endDate'],
  });
export type SubmitLeaveDto = z.infer<typeof submitLeaveDto>;

export const rejectLeaveDto = z
  .object({ reason: z.string().min(1).max(255) })
  .strict();
export type RejectLeaveDto = z.infer<typeof rejectLeaveDto>;

export const upsertLeaveBalanceDto = z
  .object({
    employeeId: z.string().length(24),
    leaveType: z.enum(LEAVE_TYPE),
    year: z.coerce.number().int().min(2000).max(2100),
    entitled: z.coerce.number().min(0),
  })
  .strict();
export type UpsertLeaveBalanceDto = z.infer<typeof upsertLeaveBalanceDto>;
