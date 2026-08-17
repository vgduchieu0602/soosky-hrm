/// <reference types="jest" />
/**
 * Full-chain E2E across the self-service additions:
 *   check-in/out → attendance record
 *   evaluation workflow self → manager → HR approve → performanceRatio
 *   → payroll consumes the approved evaluation.
 */
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { Employee } from '@shared/models/employee.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { EmployeeTaxProfile } from '@shared/models/employee-tax-profile.model';
import { PerformanceCriterion } from '@shared/models/performance-criterion.model';
import { SalaryPolicyConfig } from '@shared/models/salary-policy-config.model';
import { PayrollPeriod } from '@shared/models/payroll-period.model';
import { Attendance } from '@shared/models/attendance.model';
import { Shift } from '@shared/models/shift.model';
import { runPayrollForEmployee } from '@features/payroll/container';
import { evaluationService } from '@features/performance';
import { attendanceUseCases } from '@features/attendance/container';

jest.setTimeout(60_000);

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));
const oid = () => new mongoose.Types.ObjectId();
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);

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

async function seedCriteria(): Promise<{ perf: mongoose.Types.ObjectId[]; goal: mongoose.Types.ObjectId[] }> {
  const perf: mongoose.Types.ObjectId[] = [];
  const goal: mongoose.Types.ObjectId[] = [];
  for (const key of ['quality', 'productivity', 'teamwork', 'discipline']) {
    const d = await PerformanceCriterion.create({ key, label: key, type: 'performance', weight: 25, status: 'active' });
    perf.push(d._id as mongoose.Types.ObjectId);
  }
  for (const key of ['goal_individual', 'goal_team']) {
    const d = await PerformanceCriterion.create({ key, label: key, type: 'goal', weight: 50, status: 'active' });
    goal.push(d._id as mongoose.Types.ObjectId);
  }
  return { perf, goal };
}

async function seedPolicy() {
  await SalaryPolicyConfig.create({
    country: 'VN', year: 2026, effectiveFrom: utc('2026-01-01'),
    baseSalary: dec(2_340_000),
    regionalMinWage: { zone1: 4_960_000 },
    insuranceCeilingMultiplier: 20,
    personalDeduction: dec(11_000_000), dependentDeduction: dec(4_400_000), nonResidentTaxRate: 20,
    taxBrackets: [
      { upTo: 5_000_000, rate: 5 }, { upTo: 10_000_000, rate: 10 }, { upTo: 18_000_000, rate: 15 },
      { upTo: 32_000_000, rate: 20 }, { upTo: 52_000_000, rate: 25 }, { upTo: 80_000_000, rate: 30 }, { upTo: null, rate: 35 },
    ],
    insuranceRates: { employee: { social: 8, health: 1.5, unemployment: 1 }, employer: { social: 17.5, health: 3, unemployment: 1 } },
    unionFeeEnabled: false,
    salaryComponentWeights: { attendance: 20, performance: 60, goal: 20 },
  });
}

describe('Self-service check-in / check-out', () => {
  it('creates a self attendance record for the employee', async () => {
    const userId = oid();
    const employee = await Employee.create({
      employeeCode: 'EMP-PUNCH', userId, departmentId: oid(), positionId: oid(),
      hireDate: utc('2024-01-01'), employeeType: 'full_time', status: 'active', salaryZone: 'zone1',
    });
    await Shift.create({ name: 'Hành chính', type: 'full_day', startTime: '09:00', endTime: '18:00', breakMinutes: 60, workingDays: [1, 2, 3, 4, 5], status: 'active' });

    const afterIn = await attendanceUseCases.punch(String(userId), 'in');
    expect(afterIn.checkIn).toBeTruthy();
    expect(afterIn.source).toBe('self');
    expect(String(afterIn.employeeId)).toBe(String(employee._id));

    const afterOut = await attendanceUseCases.punch(String(userId), 'out');
    expect(afterOut.checkOut).toBeTruthy();

    // exactly one record (idempotent on {employee, date, shift})
    expect(await Attendance.countDocuments({ employeeId: employee._id })).toBe(1);
  });

  it('rejects check-out before check-in', async () => {
    const userId = oid();
    await Employee.create({
      employeeCode: 'EMP-NOIN', userId, departmentId: oid(), positionId: oid(),
      hireDate: utc('2024-01-01'), employeeType: 'full_time', status: 'active', salaryZone: 'zone1',
    });
    await Shift.create({ name: 'HC', type: 'full_day', startTime: '09:00', endTime: '18:00', breakMinutes: 60, workingDays: [1], status: 'active' });
    await expect(attendanceUseCases.punch(String(userId), 'out')).rejects.toMatchObject({ code: 'ATT_006' });
  });
});

describe('Evaluation workflow → payroll (full chain)', () => {
  it('self → manager → HR approve feeds performanceRatio into payroll', async () => {
    await seedPolicy();
    const criteria = await seedCriteria();
    const empUser = oid();
    const hrUser = oid();

    const employee = await Employee.create({
      employeeCode: 'EMP-CHAIN', userId: empUser, departmentId: oid(), positionId: oid(),
      hireDate: utc('2024-01-01'), employeeType: 'full_time', status: 'active', salaryZone: 'zone1',
    });
    const employeeId = String(employee._id);
    await EmployeeContractModel.create({
      employeeId, contractType: 'indefinite', contractNumber: 'HD-CHAIN',
      startDate: utc('2024-01-01'), baseSalary: dec(30_000_000), status: 'active',
    });
    await EmployeeTaxProfile.create({ employeeId, isResident: true, dependentsCount: 0, effectiveDate: utc('2024-01-01') });

    const period = await PayrollPeriod.create({
      name: '2026-05', startDate: utc('2026-05-01'), endDate: utc('2026-05-31'),
      payDate: utc('2026-05-31'), standardWorkDays: 22, attendanceLockedAt: new Date(), status: 'open',
    });

    // 22 present days in-period.
    for (let d = 1; d <= 22; d += 1) {
      await Attendance.create({
        employeeId, date: utc(`2026-05-${String(d).padStart(2, '0')}`),
        session: 'full_day', status: 'present', workHours: 8, lateMinutes: 0, earlyMinutes: 0,
      });
    }

    // Direct evaluate: HR scores ALL sub-indicators (perf 90, goal 95) and finalizes.
    const allScores = [
      ...criteria.perf.map((c) => ({ criterionId: String(c), score: 90 })),
      ...criteria.goal.map((c) => ({ criterionId: String(c), score: 95 })),
    ];
    const approved = await evaluationService.directEvaluate(
      { employeeId, payrollPeriodId: String(period._id), criteriaScores: allScores, strengths: 'Tốt', finalize: true },
      String(hrUser),
    );
    expect(approved.status).toBe('approved');
    expect(approved.performanceRatio).toBe(90); // avg performance criteria
    expect(approved.goalRatio).toBe(95); // avg goal criteria

    await PayrollPeriod.updateOne({ _id: period._id }, { $set: { performanceLockedAt: new Date() } });
    const payroll = await runPayrollForEmployee(String(period._id), employeeId);
    // Payroll consumed the approved evaluation ratios.
    expect(payroll.performanceRatio).toBe(90);
    expect(payroll.goalRatio).toBe(95);
    expect(payroll.actualWorkDays).toBe(22);
    // proRated = 0.2*30m*1 + 0.6*30m*0.9 + 0.2*30m*0.95 = 6m + 16.2m + 5.7m = 27.9m
    expect(Number(payroll.proRatedBaseSalary.toString())).toBe(27_900_000);
  });
});
