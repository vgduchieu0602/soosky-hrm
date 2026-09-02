import { AttendanceUseCases } from '@modules/hrm/core/attendance/app/attendance.usecases';

describe('attendance period lock guard', () => {
  it('rejects a write in a locked payroll period with ATTENDANCE_PERIOD_LOCKED', async () => {
    // Only the ports the guard actually reaches are stubbed; the tuple type
    // keeps the argument order and arity checked against the real constructor.
    const deps = [
      {},
      { findByUserId: async () => ({ _id: 'employee-1' }) },
      { findDefaultShiftWindow: async () => ({ id: 'shift-1', startTime: '08:00', endTime: '17:00', breakMinutes: 60 }) },
      { loadPolicy: async () => ({ timezone: 'Asia/Ho_Chi_Minh' }) },
      { lockedPeriodName: async () => '2026-08' },
      {},
      { now: () => new Date('2026-08-17T02:00:00.000Z') },
      {},
    ] as unknown as ConstructorParameters<typeof AttendanceUseCases>;
    const useCases = new AttendanceUseCases(...deps);

    await expect(useCases.punch('user-1', 'in')).rejects.toMatchObject({
      statusCode: 409,
      code: 'ATTENDANCE_PERIOD_LOCKED',
    });
  });
});
