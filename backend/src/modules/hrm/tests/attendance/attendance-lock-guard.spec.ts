import { AttendanceUseCases } from '@modules/hrm/core/attendance/app/attendance.usecases';

describe('attendance period lock guard', () => {
  it('rejects a write in a locked payroll period with ATTENDANCE_PERIOD_LOCKED', async () => {
    const useCases = new AttendanceUseCases(
      {} as any,
      { findByUserId: async () => ({ _id: 'employee-1' }) } as any,
      { findDefaultShiftWindow: async () => ({ id: 'shift-1', startTime: '08:00', endTime: '17:00', breakMinutes: 60 }) } as any,
      { loadPolicy: async () => ({ timezone: 'Asia/Ho_Chi_Minh' }) } as any,
      { lockedPeriodName: async () => '2026-08' } as any,
      {} as any,
      { now: () => new Date('2026-08-17T02:00:00.000Z') } as any,
      {} as any,
    );

    await expect(useCases.punch('user-1', 'in')).rejects.toMatchObject({
      statusCode: 409,
      code: 'ATTENDANCE_PERIOD_LOCKED',
    });
  });
});
