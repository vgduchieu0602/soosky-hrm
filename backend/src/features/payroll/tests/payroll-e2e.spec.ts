/// <reference types="jest" />
/**
 * End-to-end chain test: attendance + evaluation + policy + contract → payroll.
 * Runs against an in-memory Mongo replica set (payroll-run uses transactions).
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
import { MonthlyEvaluation } from '@shared/models/monthly-evaluation.model';
import { Payroll } from '@shared/models/payroll.model';
import { runPayrollForEmployee } from '@features/payroll/container';
import { evaluationService } from '@features/performance';

jest.setTimeout(60_000);

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));
const num = (d: mongoose.Types.Decimal128) => Number(d.toString());
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

async function seedPolicy() {
  await SalaryPolicyConfig.create({
    country: 'VN',
    year: 2026,
    effectiveFrom: utc('2026-01-01'),
    baseSalary: dec(2_340_000),
    regionalMinWage: { zone1: 4_960_000, zone2: 4_410_000, zone3: 3_860_000, zone4: 3_450_000 },
    insuranceCeilingMultiplier: 20,
    personalDeduction: dec(11_000_000),
    dependentDeduction: dec(4_400_000),
    nonResidentTaxRate: 20,
    taxBrackets: [
      { upTo: 5_000_000, rate: 5 },
      { upTo: 10_000_000, rate: 10 },
      { upTo: 18_000_000, rate: 15 },
      { upTo: 32_000_000, rate: 20 },
      { upTo: 52_000_000, rate: 25 },
      { upTo: 80_000_000, rate: 30 },
      { upTo: null, rate: 35 },
    ],
    insuranceRates: {
      employee: { social: 8, health: 1.5, unemployment: 1 },
      employer: { social: 17.5, health: 3, unemployment: 1 },
    },
    unionFeeEnabled: false,
    salaryComponentWeights: { attendance: 20, performance: 60, goal: 20 },
  });
}

/** Policy reflecting the real company config: fixed BHXH salary 5.5M, employer
 *  20.5%, union fee 1% of the fixed salary. */
async function seedCompanyPolicy() {
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
    insuranceRates: {
      employee: { social: 8, health: 1.5, unemployment: 1 }, // 10.5%
      employer: { social: 17, health: 3, unemployment: 0.5 }, // 20.5%
    },
    socialInsuranceSalary: dec(5_500_000),
    unionFeeRate: 1,
    unionFeeEnabled: true,
    salaryComponentWeights: { attendance: 20, performance: 60, goal: 20 },
  });
}

async function seedCriteria(): Promise<mongoose.Types.ObjectId[]> {
  const defs = [
    { key: 'quality', type: 'performance' },
    { key: 'productivity', type: 'performance' },
    { key: 'teamwork', type: 'performance' },
    { key: 'discipline', type: 'performance' },
    { key: 'goal_individual', type: 'goal' },
    { key: 'goal_team', type: 'goal' },
  ];
  const ids: mongoose.Types.ObjectId[] = [];
  for (let i = 0; i < defs.length; i += 1) {
    const type = defs[i].type as 'performance' | 'goal';
    const groupCount = defs.filter((definition) => definition.type === type).length;
    const doc = await PerformanceCriterion.create({
      key: defs[i].key, label: defs[i].key, type, weight: 100 / groupCount, order: i + 1, status: 'active',
    });
    ids.push(doc._id as mongoose.Types.ObjectId);
  }
  return ids;
}

describe('Evaluation engine', () => {
  it('computes performance & goal ratios on direct finalize', async () => {
    const criteria = await seedCriteria();
    const employee = await Employee.create({
      employeeCode: 'EMP-EVAL', departmentId: oid(), positionId: oid(),
      hireDate: utc('2024-01-01'), employeeType: 'full_time', status: 'active', salaryZone: 'zone1',
    });
    const periodId = oid();
    const approved = await evaluationService.directEvaluate(
      {
        employeeId: String(employee._id),
        payrollPeriodId: String(periodId),
        criteriaScores: criteria.map((criterionId) => ({ criterionId: String(criterionId), score: 100 })),
        finalize: true,
      },
      String(oid()),
    );
    expect(approved.performanceRatio).toBe(100); // avg of performance criteria (all 100)
    expect(approved.goalRatio).toBe(100); // avg of goal criteria (all 100)
    expect(approved.status).toBe('approved');
  });
});

describe('Full chain: attendance + evaluation → payroll', () => {
  it('produces the correct net salary end-to-end', async () => {
    await seedPolicy();
    const criteria = await seedCriteria();

    const employee = await Employee.create({
      employeeCode: 'EMP-E2E',
      departmentId: oid(),
      positionId: oid(),
      hireDate: utc('2024-01-01'),
      employeeType: 'full_time',
      status: 'active',
      salaryZone: 'zone1',
    });
    const employeeId = String(employee._id);

    await EmployeeContractModel.create({
      employeeId,
      contractType: 'indefinite',
      contractNumber: 'HD-E2E',
      startDate: utc('2024-01-01'),
      baseSalary: dec(30_000_000),
      status: 'active',
    });

    await EmployeeTaxProfile.create({
      employeeId,
      isResident: true,
      dependentsCount: 0,
      insuranceAmount: 3_150_000, // HR-entered fixed BHXH (simplified payroll)
      effectiveDate: utc('2024-01-01'),
    });

    const period = await PayrollPeriod.create({
      name: '2026-05',
      startDate: utc('2026-05-01'),
      endDate: utc('2026-05-31'),
      payDate: utc('2026-05-31'),
      standardWorkDays: 22, attendanceLockedAt: new Date(),
      status: 'open',
    });

    // 22 full present work days within the period.
    for (let d = 1; d <= 22; d += 1) {
      await Attendance.create({
        employeeId,
        date: utc(`2026-05-${String(d).padStart(2, '0')}`),
        session: 'full_day',
        status: 'present',
        workHours: 8,
        lateMinutes: 0,
        earlyMinutes: 0,
      });
    }

    // Approved evaluation: all criteria 100, goal 100 → ratios 100.
    await MonthlyEvaluation.create({
      employeeId,
      payrollPeriodId: period._id,
      criteriaScores: criteria.map((criterionId) => ({ criterionId, score: 100 })),
      performanceRatio: 100,
      goalResult: 100,
      goalRatio: 100,
      status: 'approved',
    });

    const payroll = await runPayrollForEmployee(String(period._id), employeeId);

    // Hand-calc: base 30M, full attendance/perf/goal → proRated 30M, gross 30M.
    expect(payroll.actualWorkDays).toBe(22);
    expect(payroll.attendanceRatio).toBe(1);
    expect(num(payroll.proRatedBaseSalary)).toBe(30_000_000);
    expect(num(payroll.grossSalary)).toBe(30_000_000);
    // insurance: fixed HR-entered amount (simplified payroll — no % computation)
    expect(num(payroll.insurance)).toBe(3_150_000);
    // tax is disabled system-wide → always 0
    expect(num(payroll.tax)).toBe(0);
    // net = gross − insurance − union fee (tax 0)
    expect(num(payroll.netSalary)).toBe(30_000_000 - 3_150_000 - num(payroll.unionFee));
    expect(payroll.status).toBe('draft');

    // Persisted exactly once (idempotent unique index).
    expect(await Payroll.countDocuments({ payrollPeriodId: period._id })).toBe(1);
  });

  it('official: insurance on fixed 5.5M base (NLĐ 577,500 / DN 1,127,500) + union fee 55,000', async () => {
    await seedCompanyPolicy();
    const criteria = await seedCriteria();
    const employee = await Employee.create({
      employeeCode: 'EMP-OFFICIAL', departmentId: oid(), positionId: oid(),
      hireDate: utc('2024-01-01'), employeeType: 'full_time', status: 'active', salaryZone: 'zone1',
    });
    const employeeId = String(employee._id);
    await EmployeeContractModel.create({
      employeeId, contractType: 'indefinite', contractNumber: 'HD-OFFICIAL',
      startDate: utc('2024-01-01'), baseSalary: dec(15_000_000), status: 'active',
    });
    await EmployeeTaxProfile.create({ employeeId, isResident: true, dependentsCount: 0, insuranceAmount: 577_500, effectiveDate: utc('2024-01-01') });
    const period = await PayrollPeriod.create({
      name: '2026-08', startDate: utc('2026-08-01'), endDate: utc('2026-08-31'),
      payDate: utc('2026-08-31'), standardWorkDays: 22, attendanceLockedAt: new Date(), status: 'open',
    });
    for (let d = 1; d <= 22; d += 1) {
      await Attendance.create({ employeeId, date: utc(`2026-08-${String(d).padStart(2, '0')}`), session: 'full_day', status: 'present', workHours: 8 });
    }
    await MonthlyEvaluation.create({
      employeeId, payrollPeriodId: period._id,
      criteriaScores: criteria.map((criterionId) => ({ criterionId, score: 100 })),
      performanceRatio: 100, goalResult: 100, goalRatio: 100, status: 'approved',
    });

    const payroll = await runPayrollForEmployee(String(period._id), employeeId);
    // Insurance is the fixed HR-entered amount (simplified payroll).
    expect(num(payroll.insurance)).toBe(577_500);
    // Employer insurance is not modelled with the fixed-amount approach.
    expect(num(payroll.employerSocialInsurance) + num(payroll.employerHealthInsurance) + num(payroll.employerUnemploymentInsurance) + num(payroll.employerOccupationalInsurance)).toBe(0);
    expect(num(payroll.unionFee)).toBe(55_000); // 1% × 5.5M (policy-based, unchanged)
    expect(num(payroll.tax)).toBe(0); // tax disabled
    // net = gross − insurance − union fee (tax 0)
    expect(num(payroll.netSalary)).toBe(num(payroll.grossSalary) - 577_500 - 55_000);
  });

  it('probation: 85% pay, no insurance, no union fee', async () => {
    await seedCompanyPolicy();
    const criteria = await seedCriteria();
    const employee = await Employee.create({
      employeeCode: 'EMP-PROB', departmentId: oid(), positionId: oid(),
      hireDate: utc('2024-01-01'), employeeType: 'full_time', status: 'active', salaryZone: 'zone1',
    });
    const employeeId = String(employee._id);
    await EmployeeContractModel.create({
      employeeId, contractType: 'fixed_term', employmentStatus: 'probation', contractNumber: 'HD-PROB',
      startDate: utc('2024-01-01'), baseSalary: dec(20_000_000), status: 'active',
    });
    await EmployeeTaxProfile.create({ employeeId, isResident: true, dependentsCount: 0, effectiveDate: utc('2024-01-01') });
    const period = await PayrollPeriod.create({
      name: '2026-09', startDate: utc('2026-09-01'), endDate: utc('2026-09-30'),
      payDate: utc('2026-09-30'), standardWorkDays: 22, attendanceLockedAt: new Date(), status: 'open',
    });
    for (let d = 1; d <= 22; d += 1) {
      await Attendance.create({ employeeId, date: utc(`2026-09-${String(d).padStart(2, '0')}`), session: 'full_day', status: 'present', workHours: 8 });
    }
    await MonthlyEvaluation.create({
      employeeId, payrollPeriodId: period._id,
      criteriaScores: criteria.map((criterionId) => ({ criterionId, score: 100 })),
      performanceRatio: 100, goalResult: 100, goalRatio: 100, status: 'approved',
    });

    const payroll = await runPayrollForEmployee(String(period._id), employeeId);
    // 85% of 20M, full ratios → proRated 17,000,000; no insurance / union fee.
    expect(num(payroll.proRatedBaseSalary)).toBe(17_000_000);
    expect(num(payroll.insurance)).toBe(0);
    expect(num(payroll.unionFee)).toBe(0);
  });

  it('intern: fixed policy pay, attendance-prorated only, no insurance, no union fee', async () => {
    await seedCompanyPolicy();
    const criteria = await seedCriteria();
    const employee = await Employee.create({
      employeeCode: 'EMP-INTERN', departmentId: oid(), positionId: oid(),
      hireDate: utc('2024-01-01'), employeeType: 'intern', status: 'active', salaryZone: 'zone1',
    });
    const employeeId = String(employee._id);
    await EmployeeContractModel.create({
      employeeId, contractType: 'fixed_term', employmentStatus: 'internship', contractNumber: 'HD-INTERN',
      startDate: utc('2024-01-01'), baseSalary: dec(20_000_000), status: 'active',
    });
    await EmployeeTaxProfile.create({ employeeId, isResident: true, dependentsCount: 0, effectiveDate: utc('2024-01-01') });
    const period = await PayrollPeriod.create({
      name: '2026-09', startDate: utc('2026-09-01'), endDate: utc('2026-09-30'),
      payDate: utc('2026-09-30'), standardWorkDays: 22, attendanceLockedAt: new Date(), status: 'open',
    });
    for (let d = 1; d <= 22; d += 1) {
      await Attendance.create({ employeeId, date: utc(`2026-09-${String(d).padStart(2, '0')}`), session: 'full_day', status: 'present', workHours: 8 });
    }
    await MonthlyEvaluation.create({
      employeeId, payrollPeriodId: period._id,
      criteriaScores: criteria.map((criterionId) => ({ criterionId, score: 100 })),
      performanceRatio: 100, goalResult: 100, goalRatio: 100, status: 'approved',
    });

    const payroll = await runPayrollForEmployee(String(period._id), employeeId);
    // Intern pay follows the configured salary policy, not the 20M contract salary.
    // Full attendance → default intern stipend 1,500,000 (no perf/goal/insurance/union fee).
    expect(num(payroll.proRatedBaseSalary)).toBe(1_500_000);
    expect(num(payroll.grossSalary)).toBe(1_500_000);
    expect(num(payroll.insurance)).toBe(0);
    expect(num(payroll.unionFee)).toBe(0);
  });

  it('refuses to run when the evaluation is not approved', async () => {
    await seedPolicy();
    await seedCriteria();
    const employee = await Employee.create({
      employeeCode: 'EMP-NOEVAL',
      departmentId: oid(),
      positionId: oid(),
      hireDate: utc('2024-01-01'),
      employeeType: 'full_time',
      status: 'active',
      salaryZone: 'zone1',
    });
    await EmployeeContractModel.create({
      employeeId: employee._id,
      contractType: 'indefinite',
      contractNumber: 'HD-NOEVAL',
      startDate: utc('2024-01-01'),
      baseSalary: dec(20_000_000),
      status: 'active',
    });
    const period = await PayrollPeriod.create({
      name: '2026-06',
      startDate: utc('2026-06-01'),
      endDate: utc('2026-06-30'),
      payDate: utc('2026-06-30'),
      standardWorkDays: 22, attendanceLockedAt: new Date(),
      status: 'open',
    });

    await expect(runPayrollForEmployee(String(period._id), String(employee._id))).rejects.toMatchObject({
      code: 'PAY_EVAL_REQUIRED',
    });
  });
});
