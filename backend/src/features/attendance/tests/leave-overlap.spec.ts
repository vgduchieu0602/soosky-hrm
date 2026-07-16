/// <reference types="jest" />
/**
 * Overlap guard (LV_007): an employee cannot hold two pending/approved leave
 * requests covering the same day — except two half-day requests taking
 * different sessions of that day.
 */
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { Employee } from '@shared/models/employee.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { LeaveBalance } from '@shared/models/leave-balance.model';
import { LeaveRequest } from '@shared/models/leave-request.model';
import { leaveUseCases } from '@features/attendance/container';
import { HttpError } from '@shared/errors/http-error';

jest.setTimeout(60_000);

const oid = () => new mongoose.Types.ObjectId();
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);

let repl: MongoMemoryReplSet;
beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
});
afterAll(async () => { await mongoose.disconnect(); await repl.stop(); });
afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

async function officialEmployeeWithUser() {
  const userId = oid();
  const emp = await Employee.create({
    employeeCode: `E${Math.floor(Math.random() * 1e6)}`, userId, departmentId: oid(), positionId: oid(),
    hireDate: utc('2023-01-01'), employeeType: 'full_time', status: 'active',
  });
  await EmployeeContractModel.create({
    employeeId: emp._id, contractType: 'indefinite', contractNumber: `HD-${emp._id}`,
    startDate: utc('2023-01-01'), baseSalary: mongoose.Types.Decimal128.fromString('20000000'),
    status: 'active', employmentStatus: 'official',
  });
  await LeaveBalance.create({ employeeId: emp._id, leaveType: 'annual', year: 2026, entitled: 12, used: 0 });
  return { employeeId: emp._id as mongoose.Types.ObjectId, userId: String(userId) };
}

const expectHttp = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toMatchObject(
    expect.objectContaining({ code }) as unknown as HttpError,
  );
};

describe('Leave overlap guard (LV_007)', () => {
  // 2026-06-01 is a Monday — all dates below are weekdays.
  it('rejects a second request overlapping a pending one', async () => {
    const { userId } = await officialEmployeeWithUser();
    await leaveUseCases.submit(userId, {
      leaveType: 'annual', startDate: utc('2026-06-01'), endDate: utc('2026-06-03'),
    } as never);
    await expectHttp(
      leaveUseCases.submit(userId, {
        leaveType: 'annual', startDate: utc('2026-06-03'), endDate: utc('2026-06-04'),
      } as never),
      'LV_007',
    );
  });

  it('allows adjacent (non-overlapping) requests', async () => {
    const { userId } = await officialEmployeeWithUser();
    await leaveUseCases.submit(userId, {
      leaveType: 'annual', startDate: utc('2026-06-01'), endDate: utc('2026-06-02'),
    } as never);
    const second = await leaveUseCases.submit(userId, {
      leaveType: 'annual', startDate: utc('2026-06-03'), endDate: utc('2026-06-04'),
    } as never);
    expect(second.status).toBe('pending');
  });

  it('allows two half-day requests on the same day taking different sessions', async () => {
    const { userId } = await officialEmployeeWithUser();
    await leaveUseCases.submit(userId, {
      leaveType: 'annual', startDate: utc('2026-06-01'), endDate: utc('2026-06-01'),
      halfDaySession: 'morning',
    } as never);
    const afternoon = await leaveUseCases.submit(userId, {
      leaveType: 'annual', startDate: utc('2026-06-01'), endDate: utc('2026-06-01'),
      halfDaySession: 'afternoon',
    } as never);
    expect(afternoon.days).toBe(0.5);

    // Same session again → conflict.
    await expectHttp(
      leaveUseCases.submit(userId, {
        leaveType: 'annual', startDate: utc('2026-06-01'), endDate: utc('2026-06-01'),
        halfDaySession: 'afternoon',
      } as never),
      'LV_007',
    );
  });

  it('rejects a full-day request over a day already held by a half-day one', async () => {
    const { userId } = await officialEmployeeWithUser();
    await leaveUseCases.submit(userId, {
      leaveType: 'annual', startDate: utc('2026-06-01'), endDate: utc('2026-06-01'),
      halfDaySession: 'morning',
    } as never);
    await expectHttp(
      leaveUseCases.submit(userId, {
        leaveType: 'annual', startDate: utc('2026-06-01'), endDate: utc('2026-06-02'),
      } as never),
      'LV_007',
    );
  });

  it('blocks approving a request whose days were already approved elsewhere', async () => {
    const { employeeId, userId } = await officialEmployeeWithUser();
    // Two overlapping PENDING requests created directly (pre-guard data, or a race).
    const mk = () => LeaveRequest.create({
      employeeId, leaveType: 'annual', startDate: utc('2026-06-01'), endDate: utc('2026-06-02'),
      days: 2, halfDaySession: null, status: 'pending', createdBy: new mongoose.Types.ObjectId(userId),
    });
    const [a, b] = [await mk(), await mk()];

    const approver = String(oid());
    await leaveUseCases.approve(String(a._id), approver);
    await expectHttp(leaveUseCases.approve(String(b._id), approver), 'LV_007');

    // Balance must be charged exactly once.
    const bal = await LeaveBalance.findOne({ employeeId, leaveType: 'annual', year: 2026 }).lean();
    expect(bal?.used).toBe(2);
  });
});
