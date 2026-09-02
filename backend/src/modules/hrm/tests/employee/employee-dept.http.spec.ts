import { vi } from 'vitest';
/**
 * TIER 1 — HTTP integration: Employee + Department + Organization, exercised
 * through the full middleware chain (authenticate → role/selfOrHr guards →
 * validate → controller). Focus: the security guards changed in the audit fix
 * (selfOrHr IDOR block, /users + /permissions role guards, terminate access
 * revocation) — none of which had automated coverage before.
 */
import mongoose from 'mongoose';
import { api, bearer, tokenFor, startDb, stopDb, clearDb, seedRoles } from '@shared/testing/http';
import { Employee } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import { EmployeeProfile } from '@modules/hrm/adapters/persistence/mongoose/models/employee-profile.model';
import { Department } from '@modules/hrm/adapters/persistence/mongoose/models/department.model';
import { Position } from '@modules/hrm/adapters/persistence/mongoose/models/position.model';
import { User } from '@shared/models/user.model';
import { Session } from '@shared/models/session.model';

vi.setConfig({ testTimeout: 60_000 });

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

const hr = () => bearer(tokenFor(['hr_manager']).token);
const admin = () => bearer(tokenFor(['admin']).token);

/** Seed a department + position directly, return their ids. */
async function seedDeptPosition() {
  const dept = await Department.create({ name: 'Engineering', code: `D${Date.now()}` });
  const pos = await Position.create({ title: 'Engineer', code: `P${Date.now()}`, departmentId: dept._id, level: 1 });
  return { deptId: dept._id.toString(), posId: pos._id.toString() };
}

async function createEmployeeViaApi(token: string, code: string, email?: string) {
  const { deptId, posId } = await seedDeptPosition();
  const res = await api
    .post('/api/v1/admin/employees')
    .set(bearer(token))
    .send({
      employeeCode: code,
      departmentId: deptId,
      positionId: posId,
      hireDate: '2026-01-01',
      employeeType: 'full_time',
      profile: { firstName: 'A', lastName: 'B', email },
    });
  return res;
}

describe('Department — HTTP guards', () => {
  it('HR creates a department (201)', async () => {
    const res = await api
      .post('/api/v1/admin/departments')
      .set(hr())
      .send({ name: 'Sales', code: 'SAL' });
    expect(res.status).toBe(201);
  });

  it('plain employee CANNOT create a department (403)', async () => {
    const res = await api
      .post('/api/v1/admin/departments')
      .set(bearer(tokenFor(['employee']).token))
      .send({ name: 'Sales', code: 'SAL' });
    expect(res.status).toBe(403);
  });

  it('missing token is rejected (401)', async () => {
    const res = await api.post('/api/v1/admin/departments').send({ name: 'X', code: 'X' });
    expect(res.status).toBe(401);
  });

  it('any authenticated user can list departments (200)', async () => {
    const res = await api.get('/api/v1/departments').set(bearer(tokenFor(['employee']).token));
    expect(res.status).toBe(200);
  });
});

describe('Employee — create + role guard', () => {
  it('HR creates an employee in onboarding (201)', async () => {
    const res = await createEmployeeViaApi(tokenFor(['hr_manager']).token, 'EMP001');
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('onboarding');
  });

  it('plain employee CANNOT create an employee (403)', async () => {
    const res = await createEmployeeViaApi(tokenFor(['employee']).token, 'EMP002');
    expect(res.status).toBe(403);
  });

  it('rejects an invalid employeeType (validation, 4xx)', async () => {
    const { deptId, posId } = await seedDeptPosition();
    const res = await api
      .post('/api/v1/admin/employees')
      .set(hr())
      .send({
        employeeCode: 'EMP003',
        departmentId: deptId,
        positionId: posId,
        hireDate: '2026-01-01',
        employeeType: 'astronaut',
        profile: { firstName: 'A', lastName: 'B' },
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('selfOrHr — IDOR guard on /employees/:id', () => {
  it('an employee can read their OWN record (200)', async () => {
    const create = await createEmployeeViaApi(tokenFor(['hr_manager']).token, 'SELF1');
    const empId = create.body.data._id ?? create.body.data.id;
    const me = tokenFor(['employee']);
    await Employee.updateOne({ _id: empId }, { $set: { userId: me.userId } });

    const res = await api.get(`/api/v1/employees/${empId}`).set(bearer(me.token));
    expect(res.status).toBe(200);
  });

  it("an employee CANNOT read ANOTHER employee's record (403)", async () => {
    const other = await createEmployeeViaApi(tokenFor(['hr_manager']).token, 'OTHER1');
    const otherId = other.body.data._id ?? other.body.data.id;
    const stranger = tokenFor(['employee']); // not linked to anyone

    const res = await api.get(`/api/v1/employees/${otherId}`).set(bearer(stranger.token));
    expect(res.status).toBe(403);
  });

  it("an employee CANNOT read another's bank accounts (403)", async () => {
    const other = await createEmployeeViaApi(tokenFor(['hr_manager']).token, 'OTHER2');
    const otherId = other.body.data._id ?? other.body.data.id;
    const res = await api
      .get(`/api/v1/employees/${otherId}/bank-accounts`)
      .set(bearer(tokenFor(['employee']).token));
    expect(res.status).toBe(403);
  });

  it('HR can read any employee record (200)', async () => {
    const other = await createEmployeeViaApi(tokenFor(['hr_manager']).token, 'OTHER3');
    const otherId = other.body.data._id ?? other.body.data.id;
    const res = await api.get(`/api/v1/employees/${otherId}`).set(hr());
    expect(res.status).toBe(200);
  });
});

describe('grant-login + terminate (access lifecycle)', () => {
  it('grant-login provisions an account', async () => {
    const create = await createEmployeeViaApi(tokenFor(['hr_manager']).token, 'GL1', 'gl1@test.com');
    const empId = create.body.data._id ?? create.body.data.id;

    const res = await api
      .post(`/api/v1/admin/employees/${empId}/grant-login`)
      .set(hr())
      .send({ sendEmail: false });
    expect(res.status).toBe(200);

    const emp = await Employee.findById(empId);
    expect(emp?.userId).toBeTruthy();
  });

  it('terminate disables the user AND revokes its sessions (atomic)', async () => {
    const create = await createEmployeeViaApi(tokenFor(['hr_manager']).token, 'TERM1', 'term1@test.com');
    const empId = create.body.data._id ?? create.body.data.id;
    await api.post(`/api/v1/admin/employees/${empId}/grant-login`).set(hr()).send({ sendEmail: false });

    const emp = await Employee.findById(empId);
    const userId = emp!.userId!;
    // Simulate a live session for the user.
    await Session.create({
      _id: new mongoose.Types.ObjectId(),
      userId,
      refreshTokenHash: 'hash',
      expiresAt: new Date(Date.now() + 7 * 864e5),
    });

    const res = await api
      .post(`/api/v1/admin/employees/${empId}/terminate`)
      .set(hr())
      .send({ reason: 'end of contract' });
    expect(res.status).toBe(200);

    const after = await Employee.findById(empId);
    expect(after?.status).toBe('terminated');
    expect(after?.userId).toBeFalsy(); // unset

    const user = await User.findById(userId);
    expect(user?.status).toBe('disabled');

    const sessions = await Session.find({ userId });
    expect(sessions.every((s) => s.revokedAt)).toBe(true);
  });
});

describe('IAM admin guards (/users, /permissions)', () => {
  it('plain employee CANNOT create a user (403)', async () => {
    const res = await api
      .post('/api/v1/users')
      .set(bearer(tokenFor(['employee']).token))
      .send({ username: 'x', email: 'x@test.com', password: 'Password123!' });
    expect(res.status).toBe(403);
  });

  it('plain employee CANNOT delete a user (403)', async () => {
    const res = await api
      .delete(`/api/v1/users/${new mongoose.Types.ObjectId().toString()}`)
      .set(bearer(tokenFor(['employee']).token));
    expect(res.status).toBe(403);
  });

  it('plain employee CANNOT create a permission (403)', async () => {
    const res = await api
      .post('/api/v1/permissions')
      .set(bearer(tokenFor(['employee']).token))
      .send({ key: 'x:y', description: 'x' });
    expect(res.status).toBe(403);
  });

  it('admin CAN list users (200)', async () => {
    const res = await api.get('/api/v1/users').set(admin());
    expect(res.status).toBe(200);
  });
});
