import {
  summarizeAttendance,
  toPayrollWorkDays,
  dedupeByDay,
  type AttendanceRow,
} from '@modules/hrm/core/payroll/domain/attendance-summary';

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
    ]);
    expect(s.workedDays).toBe(3);
    expect(s.actualWorkDays).toBe(3);
    expect(s.unpaidDays).toBe(0);
    expect(s.totalWorkHours).toBe(21.5);
  });

  it('does NOT count an incomplete (no check-out) day as a paid work day', () => {
    const s = summarizeAttendance([
      row('present', 'full_day', 8),
      row('incomplete', 'full_day', null),
    ]);
    expect(s.workedDays).toBe(1);
    expect(s.incompleteDays).toBe(1);
    expect(s.actualWorkDays).toBe(1); // incomplete excluded → ratio not inflated
    expect(s.unpaidDays).toBe(0);
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

describe('dedupeByDay (double-count guard)', () => {
  const dayRow = (
    date: string,
    status: AttendanceRow['status'],
    session: AttendanceRow['session'] = 'full_day',
  ): AttendanceRow & { date: Date } => ({ date: new Date(date), status, session });

  it('collapses a full-day leave that coexists with a punch on the same day', () => {
    // A present punch (real shiftId) and a leave_paid row (shiftId:null) can both
    // exist for one day — without dedupe the day counts as 2 paid days.
    const rows = [
      dayRow('2026-06-01', 'present'),
      dayRow('2026-06-01', 'leave_paid'),
    ];
    const s = summarizeAttendance(dedupeByDay(rows));
    expect(s.actualWorkDays).toBe(1);
    expect(s.workedDays).toBe(0);
    expect(s.paidLeaveDays).toBe(1);
  });

  it('leaves distinct days untouched', () => {
    const rows = [
      dayRow('2026-06-01', 'present'),
      dayRow('2026-06-02', 'leave_paid'),
      dayRow('2026-06-03', 'present'),
    ];
    const s = summarizeAttendance(dedupeByDay(rows));
    expect(s.actualWorkDays).toBe(3);
    expect(s.workedDays).toBe(2);
    expect(s.paidLeaveDays).toBe(1);
  });

  it('does not collapse when no full-day leave/holiday override is present', () => {
    const rows = [
      dayRow('2026-06-01', 'present', 'morning'),
      dayRow('2026-06-01', 'present', 'afternoon'),
    ];
    const s = summarizeAttendance(dedupeByDay(rows));
    expect(s.workedDays).toBe(1); // 0.5 + 0.5, two legitimate half-day sessions
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
