import { vi } from 'vitest';
/**
 * Annual-leave policy: official employees get 12 days/year (lazy grant); unused
 * days carry over and stay usable for up to 3 years (pooled = current + 2 prior).
 */
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { Employee } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import { EmployeeContractModel } from '@modules/hrm/adapters/persistence/mongoose/models/employee-contract.model';
import { LeaveBalance } from '@modules/hrm/adapters/persistence/mongoose/models/leave-balance.model';
import { leaveEntitlement } from '@modules/hrm/adapters/container/attendance';

vi.setConfig({ testTimeout: 60_000 });

const oid = () => new mongoose.Types.ObjectId();
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);

let repl: MongoMemoryReplSet;
beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
});
// MongoMemoryReplSet shutdown can exceed Vitest's default 10s hook timeout on Windows.
afterAll(async () => { await mongoose.disconnect(); await repl.stop(); }, 60_000);
afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

async function officialEmployee() {
  const emp = await Employee.create({
    employeeCode: `E${Math.floor(Math.random() * 1e6)}`, departmentId: oid(), positionId: oid(),
    hireDate: utc('2023-01-01'), employeeType: 'full_time', status: 'active',
  });
  await EmployeeContractModel.create({
    employeeId: emp._id, contractType: 'indefinite', contractNumber: `HD-${emp._id}`,
    startDate: utc('2023-01-01'), baseSalary: mongoose.Types.Decimal128.fromString('20000000'),
    status: 'active', employmentStatus: 'official',
  });
  return emp._id as mongoose.Types.ObjectId;
}

describe('Annual leave — 12 days + 3-year carryover', () => {
  it('grants 12 days lazily for an official employee', async () => {
    const id = await officialEmployee();
    await leaveEntitlement.ensureEntitlement(String(id), 2026);
    const bal = await LeaveBalance.findOne({ employeeId: id, leaveType: 'annual', year: 2026 }).lean();
    expect(bal?.entitled).toBe(12);
    expect(bal?.used).toBe(0);
  });

  it('does NOT grant annual leave to a non-official employee', async () => {
    const emp = await Employee.create({
      employeeCode: 'E-PROB', departmentId: oid(), positionId: oid(),
      hireDate: utc('2026-01-01'), employeeType: 'full_time', status: 'active',
    });
    await EmployeeContractModel.create({
      employeeId: emp._id, contractType: 'fixed_term', contractNumber: 'HD-PROB',
      startDate: utc('2026-01-01'), baseSalary: mongoose.Types.Decimal128.fromString('10000000'),
      status: 'active', employmentStatus: 'probation',
    });
    await leaveEntitlement.ensureEntitlement(String(emp._id), 2026);
    expect(await LeaveBalance.countDocuments({ employeeId: emp._id, leaveType: 'annual' })).toBe(0);
    expect(await leaveEntitlement.remaining(String(emp._id), 2026)).toBe(0);
  });

  it('pools remaining over the last 3 years and expires older years', async () => {
    const id = await officialEmployee();
    // Current year 2026: 12 entitled, 5 used
    await LeaveBalance.create({ employeeId: id, leaveType: 'annual', year: 2026, entitled: 12, used: 5 });
    // 2025 (within window): 12 entitled, 8 used → 4 left
    await LeaveBalance.create({ employeeId: id, leaveType: 'annual', year: 2025, entitled: 12, used: 8 });
    // 2023 (older than Y-2=2024): must be excluded
    await LeaveBalance.create({ employeeId: id, leaveType: 'annual', year: 2023, entitled: 12, used: 0 });

    // (12+12) − (5+8) = 11 ; 2023's 12 days expired (out of window)
    expect(await leaveEntitlement.remaining(String(id), 2026)).toBe(11);
  });
});
