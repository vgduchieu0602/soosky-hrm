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
