/// <reference types="jest" />
/**
 * Reproduces the reported bug: create employee → grant login (send invite) →
 * the Account tab (getAccount) must report hasAccount:true.
 * Also covers the self-heal path when only the reverse link (user.employeeId)
 * is set but employee.userId was lost.
 */
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { Employee } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { User } from '@shared/models/user.model';
import { Role } from '@shared/models/role.model';
import { accountProvisioningService, employeeAccountService } from '@features/employee/container';

jest.setTimeout(60_000);

const oid = () => new mongoose.Types.ObjectId();

let repl: MongoMemoryReplSet;

beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await repl.stop();
});
afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

async function makeEmployee(email = 'nv.test@gmail.com') {
  const emp = await Employee.create({
    employeeCode: `E${Math.floor(Math.random() * 1e6)}`,
    departmentId: oid(),
    positionId: oid(),
    hireDate: new Date('2026-01-01'),
    employeeType: 'full_time',
    status: 'onboarding',
  });
  await EmployeeProfile.create({ employeeId: emp._id, firstName: 'Test', lastName: 'NV', email });
  return emp;
}

describe('Employee account flow', () => {
  beforeEach(async () => {
    await Role.create({ name: 'employee', description: 'emp', isSystem: true });
  });

  it('grant-login then getAccount reports hasAccount:true', async () => {
    const hr = oid().toString();
    const emp = await makeEmployee();

    const res = await accountProvisioningService.grantLogin(emp._id.toString(), { sendEmail: true }, hr);
    expect(res.userId).toBeTruthy();

    // Both link directions persisted.
    const reloaded = await Employee.findById(emp._id);
    expect(reloaded?.userId?.toString()).toBe(res.userId);
    const user = await User.findById(res.userId);
    expect(user?.employeeId?.toString()).toBe(emp._id.toString());

    const account = await employeeAccountService.getAccount(emp._id.toString());
    expect(account.hasAccount).toBe(true);
    if (account.hasAccount) {
      expect(account.username).toBe('nv.test'); // derived from email prefix
      expect(account.email).toBe('nv.test@gmail.com');
      expect(account.role).toBe('employee');
    }
  });

  it('self-heals when only user.employeeId is set (one-sided link)', async () => {
    const hr = oid().toString();
    const emp = await makeEmployee('one.sided@gmail.com');
    const res = await accountProvisioningService.grantLogin(emp._id.toString(), { sendEmail: false }, hr);

    // Simulate the broken state: employee.userId lost, user.employeeId intact.
    await Employee.updateOne({ _id: emp._id }, { $unset: { userId: 1 } });
    expect((await Employee.findById(emp._id))?.userId).toBeFalsy();

    const account = await employeeAccountService.getAccount(emp._id.toString());
    expect(account.hasAccount).toBe(true);
    // Heal restored the forward link.
    expect((await Employee.findById(emp._id))?.userId?.toString()).toBe(res.userId);
  });

  it('reports hasAccount:false for an employee that was never provisioned', async () => {
    const emp = await makeEmployee('never@gmail.com');
    const account = await employeeAccountService.getAccount(emp._id.toString());
    expect(account.hasAccount).toBe(false);
  });
});
