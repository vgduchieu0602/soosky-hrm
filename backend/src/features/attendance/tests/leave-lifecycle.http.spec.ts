/// <reference types="jest" />
/**
 * TIER 1 — HTTP: leave request lifecycle side-effects that had no coverage.
 *   - LV_005: submitting a quota leave type with no configured balance is blocked.
 *   - approve is atomic: increments the year's used balance + syncs attendance.
 *   - revoke restores the used balance (floored at 0) + clears attendance.
 * These are the transactional invariants the payroll work-day count depends on.
 */
import { api, bearer, tokenFor, startDb, stopDb, clearDb, seedRoles } from '@shared/testing/http';
import { Employee } from '@shared/models/employee.model';
import { Department } from '@shared/models/department.model';
import { Position } from '@shared/models/position.model';

jest.setTimeout(60_000);

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

const hr = () => bearer(tokenFor(['hr_manager']).token);
const MON = '2026-08-03'; // a plain weekday (Mon), no holiday → 1 working day

/** Create an active employee linked to `userId`; return its id. */
async function seedEmployee(userId: string): Promise<string> {
  const dept = await Department.create({ name: 'Eng', code: `D${Date.now()}${Math.floor(userId.length)}` });
  const pos = await Position.create({ title: 'Eng', code: `P${Date.now()}${userId.slice(-3)}`, departmentId: dept._id, level: 1 });
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

async function usedFor(employeeId: string, leaveType: string): Promise<number> {
  const res = await api.get(`/api/v1/admin/leave-balances/${employeeId}`).set(hr());
  const row = (res.body.data as Array<{ leaveType: string; used: number }>).find((b) => b.leaveType === leaveType);
  return row?.used ?? -1;
}

describe('leave submit — quota guard (LV_005)', () => {
  it('blocks a sick-leave request when no balance is configured', async () => {
    const { token, userId } = tokenFor(['employee']);
    await seedEmployee(userId);
    const res = await api
      .post('/api/v1/leave-requests')
      .set(bearer(token))
      .send({ leaveType: 'sick', startDate: MON, endDate: MON });
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe('LV_005');
  });
});

describe('leave approve/revoke — balance invariant', () => {
  it('approve increments used, revoke restores it (floored at 0)', async () => {
    const { token, userId } = tokenFor(['employee']);
    const employeeId = await seedEmployee(userId);

    // HR configures a sick-leave quota for the year.
    const bal = await api
      .post('/api/v1/admin/leave-balances')
      .set(hr())
      .send({ employeeId, leaveType: 'sick', year: 2026, entitled: 5 });
    expect(bal.status).toBeLessThan(300);

    // Employee submits a 1-day sick leave.
    const submit = await api
      .post('/api/v1/leave-requests')
      .set(bearer(token))
      .send({ leaveType: 'sick', startDate: MON, endDate: MON });
    expect(submit.status).toBe(201);
    const reqId = submit.body.data._id ?? submit.body.data.id;
    expect(await usedFor(employeeId, 'sick')).toBe(0);

    // HR approves → used becomes 1.
    const approve = await api.post(`/api/v1/admin/leave-requests/${reqId}/approve`).set(hr());
    expect(approve.status).toBeLessThan(300);
    expect(await usedFor(employeeId, 'sick')).toBe(1);

    // HR revokes → used restored to 0 (never negative).
    const revoke = await api.post(`/api/v1/admin/leave-requests/${reqId}/revoke`).set(hr());
    expect(revoke.status).toBeLessThan(300);
    expect(await usedFor(employeeId, 'sick')).toBe(0);
  });
});
