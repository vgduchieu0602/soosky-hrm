/// <reference types="jest" />
/**
 * TIER 2 — HTTP integration: attendance → evaluation → payroll, through the
 * full middleware chain. Focus on the HTTP-level state machine guards and
 * access control (which the service-level chain-e2e does NOT exercise):
 *   • self check-in/out
 *   • period lifecycle 409s (run needs attendance lock, recompute approved,
 *     close/mark-paid with drafts, reopen paid)
 *   • payslip access control (own approved/paid only)
 *   • evaluation reopen blocked once payroll is approved (PERF-1)
 */
import mongoose from 'mongoose';
import { api, bearer, tokenFor, startDb, stopDb, clearDb, seedRoles } from '@shared/testing/http';
import { Employee } from '@shared/models/employee.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { EmployeeTaxProfile } from '@shared/models/employee-tax-profile.model';
import { SalaryPolicyConfig } from '@shared/models/salary-policy-config.model';
import { PerformanceCriterion } from '@shared/models/performance-criterion.model';
import { Attendance } from '@shared/models/attendance.model';
import { Shift } from '@shared/models/shift.model';

jest.setTimeout(90_000);

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));
const oid = () => new mongoose.Types.ObjectId();
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

const hr = () => bearer(tokenFor(['hr_manager']).token);
const adminTok = () => bearer(tokenFor(['admin']).token);

async function seedPolicy() {
  await SalaryPolicyConfig.create({
    country: 'VN', year: 2026, effectiveFrom: utc('2026-01-01'),
    baseSalary: dec(2_340_000), regionalMinWage: { zone1: 4_960_000 }, insuranceCeilingMultiplier: 20,
    personalDeduction: dec(11_000_000), dependentDeduction: dec(4_400_000), nonResidentTaxRate: 20,
    taxBrackets: [
      { upTo: 5_000_000, rate: 5 }, { upTo: 10_000_000, rate: 10 }, { upTo: 18_000_000, rate: 15 },
      { upTo: 32_000_000, rate: 20 }, { upTo: 52_000_000, rate: 25 }, { upTo: 80_000_000, rate: 30 }, { upTo: null, rate: 35 },
    ],
    insuranceRates: { employee: { social: 8, health: 1.5, unemployment: 1 }, employer: { social: 17.5, health: 3, unemployment: 1 } },
    unionFeeEnabled: false, salaryComponentWeights: { attendance: 20, performance: 60, goal: 20 },
  });
}

/** One active official employee with contract + tax profile + 22 present days. */
async function seedEmployee(code: string, periodMonth = '2026-05') {
  const empUser = oid();
  const emp = await Employee.create({
    employeeCode: code, userId: empUser, departmentId: oid(), positionId: oid(),
    hireDate: utc('2024-01-01'), employeeType: 'full_time', status: 'active', salaryZone: 'zone1',
  });
  const employeeId = String(emp._id);
  await EmployeeContractModel.create({
    employeeId, contractType: 'indefinite', contractNumber: `HD-${code}`,
    startDate: utc('2024-01-01'), baseSalary: dec(30_000_000), status: 'active', employmentStatus: 'official',
  });
  await EmployeeTaxProfile.create({ employeeId, taxCode: `TX-${code}`, isResident: true, dependentsCount: 0, effectiveDate: utc('2024-01-01') });
  for (let d = 1; d <= 22; d += 1) {
    await Attendance.create({
      employeeId, date: utc(`${periodMonth}-${String(d).padStart(2, '0')}`),
      session: 'full_day', status: 'present', workHours: 8, lateMinutes: 0, earlyMinutes: 0,
    });
  }
  return { employeeId, empUser: String(empUser) };
}

/** Create a period over HTTP and lock its attendance. */
async function createLockedPeriod(month = '2026-05') {
  const create = await api.post('/api/v1/payroll/periods').set(hr()).send({
    name: month, startDate: utc(`${month}-01`), endDate: utc(`${month}-28`),
    payDate: utc(`${month}-28`), standardWorkDays: 22,
  });
  const periodId = create.body.data._id ?? create.body.data.id;
  await api.post(`/api/v1/payroll/periods/${periodId}/lock-attendance`).set(hr());
  return periodId;
}

describe('Self check-in / check-out (HTTP)', () => {
  it('check-in then check-out records the day', async () => {
    const empUser = oid();
    await Employee.create({
      employeeCode: 'PUNCH1', userId: empUser, departmentId: oid(), positionId: oid(),
      hireDate: utc('2024-01-01'), employeeType: 'full_time', status: 'active', salaryZone: 'zone1',
    });
    await Shift.create({ name: 'HC', type: 'full_day', startTime: '09:00', endTime: '18:00', breakMinutes: 60, workingDays: [1, 2, 3, 4, 5], status: 'active' });
    const tok = bearer(tokenFor(['employee'], { userId: String(empUser) }).token);

    const cin = await api.post('/api/v1/attendances/check-in').set(tok);
    expect([200, 201]).toContain(cin.status);
    expect(cin.body.data.checkIn).toBeTruthy();

    const cout = await api.post('/api/v1/attendances/check-out').set(tok);
    expect([200, 201]).toContain(cout.status);
    expect(cout.body.data.checkOut).toBeTruthy();
  });

  it('check-out before check-in is rejected (409)', async () => {
    const empUser = oid();
    await Employee.create({
      employeeCode: 'PUNCH2', userId: empUser, departmentId: oid(), positionId: oid(),
      hireDate: utc('2024-01-01'), employeeType: 'full_time', status: 'active', salaryZone: 'zone1',
    });
    await Shift.create({ name: 'HC', type: 'full_day', startTime: '09:00', endTime: '18:00', breakMinutes: 60, workingDays: [1, 2, 3, 4, 5], status: 'active' });
    const tok = bearer(tokenFor(['employee'], { userId: String(empUser) }).token);
    const res = await api.post('/api/v1/attendances/check-out').set(tok);
    expect(res.status).toBe(409);
  });
});

describe('Payroll period lifecycle — HTTP state machine', () => {
  it('run on a period whose attendance is NOT locked yields per-employee errors', async () => {
    await seedPolicy();
    await seedEmployee('NOLOCK');
    const create = await api.post('/api/v1/payroll/periods').set(hr()).send({
      name: '2026-05', startDate: utc('2026-05-01'), endDate: utc('2026-05-28'), payDate: utc('2026-05-28'), standardWorkDays: 22,
    });
    const periodId = create.body.data._id ?? create.body.data.id;
    const run = await api.post(`/api/v1/payroll/periods/${periodId}/run`).set(hr()).send({ requireApprovedEvaluation: false });
    expect(run.status).toBe(200);
    expect(run.body.data.computed).toBe(0);
    expect(run.body.data.errors.length).toBeGreaterThan(0);
  });

  it('full guard sequence: run → draft → close/mark-paid blocked → approve → mark-paid → reopen blocked', async () => {
    await seedPolicy();
    const { employeeId } = await seedEmployee('LIFE');
    const periodId = await createLockedPeriod();

    // Run (skip eval requirement) → one draft row.
    const run = await api.post(`/api/v1/payroll/periods/${periodId}/run`).set(hr()).send({ requireApprovedEvaluation: false });
    expect(run.body.data.computed).toBe(1);

    // Recompute a still-draft row is allowed; but once we try to close with a
    // draft remaining it must be refused.
    const closeWithDraft = await api.post(`/api/v1/payroll/periods/${periodId}/close`).set(hr());
    expect(closeWithDraft.status).toBe(409);

    const payWithDraft = await api.post(`/api/v1/payroll/periods/${periodId}/mark-paid`).set(adminTok());
    expect(payWithDraft.status).toBe(409);

    // Approve the row.
    const approve = await api.post(`/api/v1/payroll/periods/${periodId}/approve`).set(hr()).send({});
    expect(approve.status).toBe(200);

    // Recompute an APPROVED row is refused.
    const recompute = await api.post(`/api/v1/payroll/periods/${periodId}/run/${employeeId}`).set(hr());
    expect(recompute.status).toBe(409);

    // Pay, then reopening a paid period is refused.
    const pay = await api.post(`/api/v1/payroll/periods/${periodId}/mark-paid`).set(adminTok());
    expect(pay.status).toBe(200);

    const reopen = await api.post(`/api/v1/payroll/periods/${periodId}/reopen`).set(adminTok());
    expect(reopen.status).toBe(409);
  });
});

describe('Payslip access control (HTTP)', () => {
  it('employee sees own payslip only after approval; never others', async () => {
    await seedPolicy();
    const me = await seedEmployee('PS-ME');
    const other = await seedEmployee('PS-OTHER', '2026-05');
    const periodId = await createLockedPeriod();
    await api.post(`/api/v1/payroll/periods/${periodId}/run`).set(hr()).send({ requireApprovedEvaluation: false });

    const myTok = bearer(tokenFor(['employee'], { userId: me.empUser }).token);

    // Draft is hidden from the employee.
    const before = await api.get('/api/v1/payroll/payrolls/me').set(myTok);
    expect(before.status).toBe(200);
    expect(before.body.data.length).toBe(0);

    // Approve only my row.
    await api.post(`/api/v1/payroll/periods/${periodId}/approve`).set(hr()).send({ employeeId: me.employeeId });

    const after = await api.get('/api/v1/payroll/payrolls/me').set(myTok);
    expect(after.body.data.length).toBe(1);
    expect(String(after.body.data[0].employeeId)).toBe(me.employeeId);

    // The other employee (no approved row) sees nothing of mine.
    const otherTok = bearer(tokenFor(['employee'], { userId: other.empUser }).token);
    const otherView = await api.get('/api/v1/payroll/payrolls/me').set(otherTok);
    expect(otherView.body.data.length).toBe(0);
  });
});

describe('Evaluation reopen blocked once payroll approved (PERF-1, HTTP)', () => {
  it('reopen returns 409 after payroll for the period+employee is approved', async () => {
    await seedPolicy();
    const { employeeId } = await seedEmployee('EVAL');
    const periodId = await createLockedPeriod();

    const perf = await PerformanceCriterion.create({ key: 'quality', label: 'quality', type: 'performance', status: 'active' });
    const goal = await PerformanceCriterion.create({ key: 'goal_x', label: 'goal_x', type: 'goal', status: 'active' });

    // Evaluate + finalize over HTTP.
    const evalRes = await api.post('/api/v1/performance/evaluations').set(hr()).send({
      employeeId, payrollPeriodId: periodId,
      criteriaScores: [{ criterionId: String(perf._id), score: 90 }, { criterionId: String(goal._id), score: 95 }],
      finalize: true,
    });
    expect(evalRes.status).toBe(201);
    const evalId = evalRes.body.data._id ?? evalRes.body.data.id;

    // Run + approve payroll (eval now satisfies the requirement).
    await api.post(`/api/v1/payroll/periods/${periodId}/run`).set(hr()).send({});
    await api.post(`/api/v1/payroll/periods/${periodId}/approve`).set(hr()).send({});

    // Reopen the evaluation must now be blocked.
    const reopen = await api.post(`/api/v1/performance/evaluations/${evalId}/reopen`).set(hr()).send({ reason: 'fix' });
    expect(reopen.status).toBe(409);
  });
});
