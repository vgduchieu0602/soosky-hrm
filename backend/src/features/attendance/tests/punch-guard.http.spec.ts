/// <reference types="jest" />
/**
 * TIER 1 — HTTP: self check-in is blocked on a day already covered by an
 * approved full-day leave (ATT_007). Prevents double-counting a paid-leave day
 * against a punch, which would inflate the payroll work-day total.
 */
import { api, bearer, tokenFor, startDb, stopDb, clearDb, seedRoles } from '@shared/testing/http';
import { Employee } from '@shared/models/employee.model';
import { Department } from '@shared/models/department.model';
import { Position } from '@shared/models/position.model';
import { Shift } from '@shared/models/shift.model';
import { Attendance } from '@shared/models/attendance.model';
import { vnDateKey } from '@features/attendance/domain/attendance-calc';

jest.setTimeout(60_000);

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

async function seedEmployee(userId: string): Promise<string> {
  const dept = await Department.create({ name: 'Eng', code: `D${Date.now()}` });
  const pos = await Position.create({ title: 'Eng', code: `P${Date.now()}`, departmentId: dept._id, level: 1 });
  const emp = await Employee.create({
    employeeCode: `E${userId.slice(-6)}`,
    departmentId: dept._id,
    positionId: pos._id,
    hireDate: new Date('2026-01-01'),
    employeeType: 'full_time',
    status: 'active',
    userId,
  });
  return emp._id.toString();
}

async function seedDefaultShift() {
  await Shift.create({
    name: 'Day',
    type: 'full_day',
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: 60,
    status: 'active',
  });
}

describe('self check-in — full-day leave guard (ATT_007)', () => {
  it('blocks check-in on a day with an approved full-day leave', async () => {
    const { token, userId } = tokenFor(['employee']);
    const employeeId = await seedEmployee(userId);
    await seedDefaultShift();

    // Pre-existing full-day leave attendance for today (as leave approval would create).
    const today = vnDateKey(new Date());
    await Attendance.create({
      employeeId,
      date: today,
      session: 'full_day',
      status: 'leave_paid',
      source: 'leave',
    });

    const res = await api.post('/api/v1/attendances/check-in').set(bearer(token));
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe('ATT_007');
  });

  it('allows check-in on a normal day (no leave)', async () => {
    const { token, userId } = tokenFor(['employee']);
    await seedEmployee(userId);
    await seedDefaultShift();

    const res = await api.post('/api/v1/attendances/check-in').set(bearer(token));
    expect(res.status).toBeLessThan(300);
  });
});
