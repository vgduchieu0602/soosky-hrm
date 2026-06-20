/// <reference types="jest" />
import {
  summarizeAttendance,
  toPayrollWorkDays,
  type AttendanceRow,
} from '@features/payroll/services/attendance-aggregate.service';

const row = (
  status: AttendanceRow['status'],
  session: AttendanceRow['session'] = 'full_day',
  workHours: number | null = null,
): AttendanceRow => ({ status, session, workHours });

describe('summarizeAttendance', () => {
  it('counts worked statuses as actual work days and sums hours', () => {
    const s = summarizeAttendance([
      row('present', 'full_day', 8),
      row('late', 'full_day', 7.5),
      row('early_leave', 'full_day', 6),
      row('incomplete', 'full_day', null),
    ]);
    expect(s.workedDays).toBe(4);
    expect(s.actualWorkDays).toBe(4);
    expect(s.unpaidDays).toBe(0);
    expect(s.totalWorkHours).toBe(21.5);
  });

  it('treats paid leave and holiday as paid (counts toward actualWorkDays, not worked)', () => {
    const s = summarizeAttendance([
      row('present', 'full_day', 8),
      row('leave_paid'),
      row('holiday'),
    ]);
    expect(s.workedDays).toBe(1);
    expect(s.paidLeaveDays).toBe(1);
    expect(s.holidayDays).toBe(1);
    expect(s.actualWorkDays).toBe(3); // 1 worked + 1 paid leave + 1 holiday
    expect(s.unpaidDays).toBe(0);
  });

  it('treats unpaid leave and absence as unpaid (excluded from actualWorkDays)', () => {
    const s = summarizeAttendance([
      row('present', 'full_day', 8),
      row('leave_unpaid'),
      row('absent'),
    ]);
    expect(s.actualWorkDays).toBe(1);
    expect(s.unpaidLeaveDays).toBe(1);
    expect(s.absentDays).toBe(1);
    expect(s.unpaidDays).toBe(2);
  });

  it('weights half-day sessions at 0.5', () => {
    const s = summarizeAttendance([
      row('present', 'morning', 4),
      row('present', 'afternoon', 4),
      row('leave_unpaid', 'morning'),
    ]);
    expect(s.workedDays).toBe(1); // 0.5 + 0.5
    expect(s.unpaidDays).toBe(0.5);
    expect(s.totalWorkHours).toBe(8);
  });

  it('handles an empty period', () => {
    const s = summarizeAttendance([]);
    expect(s.actualWorkDays).toBe(0);
    expect(s.recordCount).toBe(0);
  });
});

describe('toPayrollWorkDays', () => {
  it('maps a summary onto IPayroll work-day fields', () => {
    const s = summarizeAttendance([
      ...Array.from({ length: 20 }, () => row('present', 'full_day', 8)),
      row('leave_paid'),
      row('leave_unpaid'),
    ]);
    const wd = toPayrollWorkDays(s, 22);
    expect(wd).toEqual({
      standardWorkDays: 22,
      actualWorkDays: 21, // 20 worked + 1 paid leave
      unpaidLeaveDays: 1, // 1 unpaid leave
      workDays: 20,
      leaveDays: 1,
    });
  });
});
