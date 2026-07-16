/// <reference types="jest" />
/**
 * E2E COVERAGE DRIVER — drives every module over the real HTTP stack
 * (authenticate → guards → validate → controller → service → Mongo replica set).
 * Continue-on-error: each use-case is recorded ✓/✗ and the run prints a
 * checklist at the end. Not a gate — a report of what works as-built.
 */
import mongoose from 'mongoose';
import { api, bearer, tokenFor, startDb, stopDb, clearDb, seedRoles } from '@shared/testing/http';
import { hashPassword } from '@shared/utils/hash.util';
import { User } from '@shared/models/user.model';
import { UserRole } from '@shared/models/user-role.model';
import { Role } from '@shared/models/role.model';
import { Employee } from '@shared/models/employee.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { EmployeeTaxProfile } from '@shared/models/employee-tax-profile.model';
import { Attendance } from '@shared/models/attendance.model';
import { MonthlyEvaluation } from '@shared/models/monthly-evaluation.model';

jest.setTimeout(180_000);

beforeAll(startDb);
afterAll(stopDb);

type Row = { id: string; name: string; ok: boolean; note: string };
const rows: Row[] = [];

async function check(id: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    rows.push({ id, name, ok: true, note: '' });
  } catch (e) {
    rows.push({ id, name, ok: false, note: (e as Error).message.slice(0, 120) });
  }
}

/** Assert helper that throws on failure (captured by check). */
function want(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));
const oid = () => new mongoose.Types.ObjectId();
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);

it('drives all use-cases and prints a coverage checklist', async () => {
  await seedRoles();
  const adminT = tokenFor(['admin']).token;
  const hrT = tokenFor(['hr_manager']).token;
  const admin = () => bearer(adminT);
  const hr = () => bearer(hrT);

  // ---- shared ids captured across steps ----
  let deptId = '';
  let posId = '';
  let empId = '';
  let contactId = '';
  let periodId = '';
  let criterionPerfId = '';
  let criterionGoalId = '';

  // =========================== IAM / AUTH ===========================
  const PW = 'Str0ng@Pass1';
  let loginEmail = '';
  await check('AUTH-01', 'Seed + login real user (200, token issued)', async () => {
    const role = await Role.findOne({ name: 'hr_manager' });
    loginEmail = `hr${Date.now()}@soosky.local`;
    const u = await User.create({ username: loginEmail.split('@')[0], email: loginEmail, password: await hashPassword(PW), status: 'active' } as never);
    await UserRole.create({ userId: u._id, roleId: (role as never as { _id: unknown })._id } as never);
    const res = await api.post('/api/v1/auth/login').send({ identifier: loginEmail, password: PW });
    want(res.status === 200 && !!res.body.data.accessToken, `status ${res.status}`);
  });
  await check('AUTH-02', 'Login wrong password → 401 IAM_001', async () => {
    const res = await api.post('/api/v1/auth/login').send({ identifier: loginEmail, password: 'nope' });
    want(res.status === 401 && res.body.error?.code === 'IAM_001', `status ${res.status}`);
  });
  await check('AUTH-03', 'Refresh rotation (cookie → new access token)', async () => {
    const login = await api.post('/api/v1/auth/login').send({ identifier: loginEmail, password: PW });
    const cookie = ((login.headers['set-cookie'] as unknown as string[]) ?? []).find((c) => c.startsWith('refreshToken='))!.split(';')[0];
    const r = await api.post('/api/v1/auth/refresh').set('Cookie', cookie);
    want(r.status === 200 && !!r.body.data.accessToken, `status ${r.status}`);
  });
  await check('AUTH-04', 'GET /auth/me (real logged-in token)', async () => {
    const login = await api.post('/api/v1/auth/login').send({ identifier: loginEmail, password: PW });
    const res = await api.get('/api/v1/auth/me').set(bearer(login.body.data.accessToken));
    want(res.status === 200, `status ${res.status}`);
  });
  await check('AUTH-05', 'must-change-password blocks normal API (IAM_013)', async () => {
    const t = tokenFor(['employee'], { mustChangePassword: true }).token;
    const res = await api.get('/api/v1/employees').set(bearer(t));
    want(res.status === 403 && res.body.error?.code === 'IAM_013', `status ${res.status}`);
  });
  await check('IAM-01', 'Users list (hr) allowed', async () => {
    const res = await api.get('/api/v1/users').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('IAM-02', 'Users create (employee) forbidden 403', async () => {
    const res = await api.post('/api/v1/users').set(bearer(tokenFor(['employee']).token)).send({ username: 'x', email: 'x@x.co', password: 'Passw0rd1' });
    want(res.status === 403, `status ${res.status}`);
  });
  await check('IAM-03', 'Roles list', async () => {
    const res = await api.get('/api/v1/roles').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('IAM-04', 'Permissions list', async () => {
    const res = await api.get('/api/v1/permissions').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('IAM-05', 'Audit logs (admin)', async () => {
    const res = await api.get('/api/v1/admin/audit-logs').set(admin());
    want(res.status === 200, `status ${res.status}`);
  });

  // =========================== ORGANIZATION ===========================
  await check('ORG-01', 'Create department (hr)', async () => {
    const res = await api.post('/api/v1/admin/departments').set(hr()).send({ name: 'Engineering', code: 'ENG' });
    want(res.status === 201, `status ${res.status}`);
    deptId = res.body.data._id ?? res.body.data.id;
  });
  await check('ORG-02', 'List departments', async () => {
    const res = await api.get('/api/v1/departments').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('ORG-03', 'Create position', async () => {
    const res = await api.post('/api/v1/admin/positions').set(hr()).send({ title: 'Engineer', code: 'ENG1', departmentId: deptId, level: 1 });
    want(res.status === 201, `status ${res.status}`);
    posId = res.body.data._id ?? res.body.data.id;
  });
  await check('ORG-04', 'List positions', async () => {
    const res = await api.get('/api/v1/positions').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });

  // =========================== EMPLOYEE ===========================
  await check('EMP-01', 'Create employee (onboarding)', async () => {
    const res = await api.post('/api/v1/admin/employees').set(hr()).send({
      employeeCode: `E${Date.now()}`, departmentId: deptId, positionId: posId,
      hireDate: '2026-01-01', employeeType: 'full_time', salaryZone: 'zone1',
      profile: { firstName: 'Nguyen', lastName: 'A', email: `emp${Date.now()}@personal.co` },
    });
    want(res.status === 201, `status ${res.status}`);
    empId = res.body.data._id ?? res.body.data.id;
  });
  await check('EMP-02', 'List employees (paginated)', async () => {
    const res = await api.get('/api/v1/employees?page=1&limit=10').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('EMP-03', 'Headcount stats', async () => {
    const res = await api.get('/api/v1/employees/stats').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('EMP-04', 'Get employee by id', async () => {
    const res = await api.get(`/api/v1/employees/${empId}`).set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('EMP-05', 'Update profile', async () => {
    const res = await api.patch(`/api/v1/employees/${empId}/profile`).set(hr()).send({ phone: '0900000000' });
    want(res.status === 200, `status ${res.status}`);
  });
  await check('EMP-06', 'Add + list contact', async () => {
    const add = await api.post(`/api/v1/employees/${empId}/contacts`).set(hr()).send({ name: 'Wife', relationship: 'spouse', phone: '0911111111' });
    want(add.status === 201 || add.status === 200, `add ${add.status}`);
    contactId = add.body.data?._id ?? add.body.data?.id ?? '';
    const list = await api.get(`/api/v1/employees/${empId}/contacts`).set(hr());
    want(list.status === 200, `list ${list.status}`);
  });
  await check('EMP-07', 'Add bank account', async () => {
    const res = await api.post(`/api/v1/employees/${empId}/bank-accounts`).set(hr()).send({ bankName: 'VCB', accountNumber: '0123456789', accountHolder: 'NGUYEN A' });
    want(res.status === 201 || res.status === 200, `status ${res.status}`);
  });
  await check('EMP-08', 'Add document', async () => {
    const res = await api.post(`/api/v1/employees/${empId}/documents`).set(hr()).send({ documentType: 'id_card', documentNumber: '012345678' });
    want(res.status === 201 || res.status === 200, `status ${res.status}`);
  });
  await check('EMP-09', 'Add contract', async () => {
    const res = await api.post(`/api/v1/admin/employees/${empId}/contracts`).set(hr()).send({ contractType: 'indefinite', contractNumber: `HD${Date.now()}`, startDate: '2026-01-01', baseSalary: 20_000_000 });
    want(res.status === 201 || res.status === 200, `status ${res.status}`);
  });
  await check('EMP-10', 'Assign asset', async () => {
    const res = await api.post(`/api/v1/admin/employees/${empId}/assets`).set(hr()).send({ assetName: 'Laptop', assetCode: `AS${Date.now()}`, assignedDate: '2026-01-01' });
    want(res.status === 201 || res.status === 200, `status ${res.status}`);
  });
  await check('EMP-11', 'Grant login (provision account)', async () => {
    const res = await api.post(`/api/v1/admin/employees/${empId}/grant-login`).set(hr()).send({});
    want(res.status === 200 || res.status === 201, `status ${res.status}`);
  });
  await check('EMP-12', 'IDOR: employee cannot read another employee (403)', async () => {
    const res = await api.get(`/api/v1/employees/${empId}`).set(bearer(tokenFor(['employee'], { userId: oid().toString() }).token));
    want(res.status === 403, `status ${res.status}`);
  });

  // ---- a self-service employee (linked userId) for punch/leave/payslip ----
  const selfUser = oid().toString();
  const selfEmp = await Employee.create({
    employeeCode: `SELF${Date.now()}`, departmentId: deptId || oid(), positionId: posId || oid(),
    hireDate: utc('2024-01-01'), employeeType: 'full_time', status: 'active', salaryZone: 'zone1', userId: selfUser,
  });
  const selfEmpId = String(selfEmp._id);
  const selfT = () => bearer(tokenFor(['employee'], { userId: selfUser }).token);

  // =========================== ATTENDANCE / LEAVE ===========================
  await check('ATT-01', 'Create shift', async () => {
    const res = await api.post('/api/v1/admin/shifts').set(hr()).send({ name: 'Day', type: 'full_day', startTime: '08:00', endTime: '17:00', breakMinutes: 60 });
    want(res.status === 201 || res.status === 200, `status ${res.status}`);
  });
  await check('ATT-02', 'Create holiday', async () => {
    const res = await api.post('/api/v1/admin/holidays').set(hr()).send({ name: 'Tet', date: '2026-02-17' });
    want(res.status === 201 || res.status === 200, `status ${res.status}`);
  });
  await check('ATT-03', 'Create attendance symbol', async () => {
    const res = await api.post('/api/v1/admin/attendance-symbols').set(hr()).send({ code: 'P', label: 'Present' });
    want(res.status === 201 || res.status === 200, `status ${res.status}`);
  });
  await check('ATT-04', 'Employee self check-in', async () => {
    const res = await api.post('/api/v1/attendances/check-in').set(selfT());
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });
  await check('ATT-05', 'Employee self check-out', async () => {
    const res = await api.post('/api/v1/attendances/check-out').set(selfT());
    want(res.status < 300, `status ${res.status}`);
  });
  await check('ATT-06', 'My attendance (month)', async () => {
    const res = await api.get('/api/v1/attendances/me').set(selfT());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('ATT-07', 'Admin attendance grid', async () => {
    const res = await api.get('/api/v1/admin/attendances?month=2026-05').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  let leaveReqId = '';
  await check('LV-01', 'HR sets leave balance', async () => {
    const res = await api.post('/api/v1/admin/leave-balances').set(hr()).send({ employeeId: selfEmpId, leaveType: 'sick', year: 2026, entitled: 5 });
    want(res.status < 300, `status ${res.status}`);
  });
  await check('LV-02', 'Employee submits leave', async () => {
    const res = await api.post('/api/v1/leave-requests').set(selfT()).send({ leaveType: 'sick', startDate: '2026-08-03', endDate: '2026-08-03' });
    want(res.status === 201, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
    leaveReqId = res.body.data._id ?? res.body.data.id;
  });
  await check('LV-03', 'HR approves leave', async () => {
    const res = await api.post(`/api/v1/admin/leave-requests/${leaveReqId}/approve`).set(hr());
    want(res.status < 300, `status ${res.status}`);
  });
  await check('LV-04', 'Employee views own balances', async () => {
    const res = await api.get('/api/v1/leave-balances/me').set(selfT());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('LV-05', 'HR revokes approved leave', async () => {
    const res = await api.post(`/api/v1/admin/leave-requests/${leaveReqId}/revoke`).set(hr());
    want(res.status < 300, `status ${res.status}`);
  });

  // =========================== SETTINGS ===========================
  await check('SET-01', 'Admin updates company config', async () => {
    const res = await api.patch('/api/v1/admin/settings/company').set(admin()).send({ companyName: 'Soosky', standardWorkDays: 22 });
    want(res.status === 200, `status ${res.status}`);
  });
  await check('SET-02', 'Admin creates salary policy (weights=100)', async () => {
    const res = await api.post('/api/v1/admin/settings/salary-policies').set(admin()).send({
      country: 'VN', year: 2026, effectiveFrom: '2026-01-01', baseSalary: 2_340_000,
      salaryComponentWeights: { attendance: 20, performance: 60, goal: 20 },
    });
    want([200, 201].includes(res.status), `status ${res.status}`);
  });
  await check('SET-03', 'Salary policy weights≠100 rejected (4xx)', async () => {
    const res = await api.post('/api/v1/admin/settings/salary-policies').set(admin()).send({
      country: 'VN', year: 2027, effectiveFrom: '2027-01-01', baseSalary: 1,
      salaryComponentWeights: { attendance: 50, performance: 60, goal: 20 },
    });
    want(res.status >= 400 && res.status < 500, `status ${res.status}`);
  });
  await check('SET-04', 'Bank catalog create + list', async () => {
    const c = await api.post('/api/v1/admin/settings/banks').set(hr()).send({ code: 'VCB', name: 'Vietcombank' });
    want(c.status < 300, `create ${c.status}`);
    const l = await api.get('/api/v1/settings/banks').set(hr());
    want(l.status === 200, `list ${l.status}`);
  });

  // =========================== PERFORMANCE ===========================
  await check('PERF-01', 'Create performance criterion', async () => {
    const res = await api.post('/api/v1/admin/settings/performance-criteria').set(hr()).send({ label: 'Quality', type: 'performance' });
    want(res.status === 201, `status ${res.status}`);
    criterionPerfId = res.body.data._id ?? res.body.data.id;
  });
  await check('PERF-02', 'Create goal criterion', async () => {
    const res = await api.post('/api/v1/admin/settings/performance-criteria').set(hr()).send({ label: 'Goal', type: 'goal' });
    want(res.status === 201, `status ${res.status}`);
    criterionGoalId = res.body.data._id ?? res.body.data.id;
  });
  await check('PERF-03', 'Criterion type immutable on update (4xx)', async () => {
    const res = await api.patch(`/api/v1/admin/settings/performance-criteria/${criterionPerfId}`).set(hr()).send({ type: 'goal' });
    want(res.status >= 400 && res.status < 500, `status ${res.status}`);
  });

  // =========================== PAYROLL ===========================
  await check('PAY-01', 'Create payroll period', async () => {
    const res = await api.post('/api/v1/payroll/periods').set(hr()).send({ name: '2026-05', startDate: '2026-05-01', endDate: '2026-05-31', payDate: '2026-05-31', standardWorkDays: 22 });
    want([200, 201].includes(res.status), `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
    periodId = res.body.data._id ?? res.body.data.id;
  });
  await check('PAY-02', 'List periods', async () => {
    const res = await api.get('/api/v1/payroll/periods').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('PAY-03', 'Create allowance', async () => {
    const res = await api.post('/api/v1/payroll/allowances').set(hr()).send({ employeeId: selfEmpId, name: 'Lunch', type: 'fixed', amount: 500_000, isTaxable: false, effectiveDate: '2026-01-01' });
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });
  await check('PAY-04', 'Create bonus', async () => {
    const res = await api.post('/api/v1/payroll/bonuses').set(hr()).send({ employeeId: selfEmpId, payrollPeriodId: periodId, name: 'KPI', amount: 1_000_000 });
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });
  await check('PAY-05', 'Create deduction', async () => {
    const res = await api.post('/api/v1/payroll/deductions').set(hr()).send({ employeeId: selfEmpId, name: 'Fine', type: 'fixed', amount: 100_000, effectiveDate: '2026-01-01' });
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });
  await check('PAY-06', 'Upsert tax profile', async () => {
    const res = await api.post('/api/v1/payroll/tax-profiles').set(hr()).send({ employeeId: selfEmpId, isResident: true, dependentsCount: 0, effectiveDate: '2026-01-01' });
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });

  // prerequisites for run: contract + tax profile insurance + attendance + approved eval + lock
  await EmployeeContractModel.create({ employeeId: selfEmpId, contractType: 'indefinite', contractNumber: `HDP${Date.now()}`, startDate: utc('2024-01-01'), baseSalary: dec(20_000_000), status: 'active' } as never);
  for (let d = 1; d <= 22; d += 1) {
    await Attendance.create({ employeeId: selfEmpId, date: utc(`2026-05-${String(d).padStart(2, '0')}`), session: 'full_day', status: 'present', workHours: 8 } as never);
  }
  await MonthlyEvaluation.create({ employeeId: selfEmpId, payrollPeriodId: periodId || oid(), criteriaScores: [{ criterionId: criterionPerfId || oid(), score: 100 }, { criterionId: criterionGoalId || oid(), score: 100 }], performanceRatio: 100, goalResult: 100, goalRatio: 100, status: 'approved' } as never);

  await check('PAY-07', 'Lock attendance for period', async () => {
    const res = await api.post(`/api/v1/payroll/periods/${periodId}/lock-attendance`).set(hr());
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });
  await check('PAY-07b', 'Lock evaluations for period', async () => {
    const res = await api.post(`/api/v1/payroll/periods/${periodId}/lock-evaluations`).set(hr());
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });
  await check('PAY-08', 'Run payroll for one employee', async () => {
    const res = await api.post(`/api/v1/payroll/periods/${periodId}/run/${selfEmpId}`).set(hr());
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });
  await check('PAY-09', 'List payrolls', async () => {
    const res = await api.get('/api/v1/payroll/payrolls').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('PAY-10', 'Period totals', async () => {
    const res = await api.get(`/api/v1/payroll/periods/${periodId}/totals`).set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('PAY-11', 'Approve payroll (period)', async () => {
    const res = await api.post(`/api/v1/payroll/periods/${periodId}/approve`).set(hr()).send({});
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });
  await check('PAY-12', 'Employee views own payslip', async () => {
    const res = await api.get('/api/v1/payroll/payrolls/me').set(selfT());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('PAY-13', 'Mark period paid (admin)', async () => {
    const res = await api.post(`/api/v1/payroll/periods/${periodId}/mark-paid`).set(admin());
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });

  // =========================== STORAGE / NOTIFICATION / DASHBOARD ===========================
  await check('STOR-01', 'Presign upload URL', async () => {
    const res = await api.post('/api/v1/uploads/presign').set(hr()).send({ scope: 'avatar', fileName: 'a.png', contentType: 'image/png' });
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });
  await check('NOTI-01', 'List notifications', async () => {
    const res = await api.get('/api/v1/notifications').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('NOTI-02', 'Unread count', async () => {
    const res = await api.get('/api/v1/notifications/unread-count').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });
  await check('DASH-01', 'Admin dashboard', async () => {
    const res = await api.get('/api/v1/admin/dashboard').set(hr());
    want(res.status === 200, `status ${res.status}`);
  });

  // =========================== EMPLOYEE lifecycle end ===========================
  await check('EMP-13', 'Terminate employee (soft delete + revoke)', async () => {
    const res = await api.post(`/api/v1/admin/employees/${empId}/terminate`).set(hr()).send({ terminationDate: '2026-12-31', reason: 'end' });
    want(res.status < 300, `status ${res.status} ${JSON.stringify(res.body.error ?? '')}`);
  });

  // =========================== REPORT ===========================
  const pass = rows.filter((r) => r.ok).length;
  const lines = rows.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(8)} ${r.name}${r.ok ? '' : '  << ' + r.note}`);
  // eslint-disable-next-line no-console
  console.log(`\n======== E2E COVERAGE CHECKLIST ========\n${lines.join('\n')}\n\n${pass}/${rows.length} passed\n========================================\n`);

  await clearDb();
  expect(rows.length).toBeGreaterThan(0);
});
