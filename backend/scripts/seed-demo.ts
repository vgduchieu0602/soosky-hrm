/* eslint-disable no-console */
/**
 * Demo data seed — full realistic dataset for the whole app so the dashboard and
 * every module show REAL data (not the FE mock fallback).
 *
 * Creates: 6 departments, ~12 positions, 1 admin shift, ~50 employees (with
 * profile / official|probation contract / leave balances), attendance for
 * months 1–6 of SEED_YEAR (weekdays, realistic present/late/leave/absent mix),
 * pending + upcoming leave requests, monthly evaluations (top performers), a
 * payroll period with per-employee payrolls.
 *
 * Idempotent by natural keys (dept code / position code / employeeCode /
 * contractNumber / period name); attendance for the seeded window is wiped and
 * regenerated so re-runs don't duplicate.
 *
 * Run AFTER `pnpm seed` (roles/permissions/users/policy/criteria/company-config).
 *   pnpm seed:demo
 *
 * Tunables via env: SEED_EMP_COUNT (default 50), SEED_YEAR (default 2026).
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '@infra/db/mongoose';
import { Department } from '@shared/models/department.model';
import { Position } from '@shared/models/position.model';
import { Shift } from '@shared/models/shift.model';
import { Employee } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { LeaveBalance } from '@shared/models/leave-balance.model';
import { LeaveRequest } from '@shared/models/leave-request.model';
import { Attendance } from '@shared/models/attendance.model';
import { MonthlyEvaluation } from '@shared/models/monthly-evaluation.model';
import { PayrollPeriod } from '@shared/models/payroll-period.model';
import { Payroll } from '@shared/models/payroll.model';
import { User } from '@shared/models/user.model';

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(Math.round(n)));
const YEAR = Number(process.env.SEED_YEAR ?? 2026);
const EMP_COUNT = Number(process.env.SEED_EMP_COUNT ?? 50);
const MONTHS = [1, 2, 3, 4, 5, 6];

// deterministic RNG so re-runs are stable
let _s = 12345;
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const randInt = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

const DEPARTMENTS = [
  { code: 'ENG', name: 'Kỹ thuật' },
  { code: 'SALES', name: 'Kinh doanh' },
  { code: 'MKT', name: 'Marketing' },
  { code: 'HR', name: 'Nhân sự' },
  { code: 'FIN', name: 'Tài chính' },
  { code: 'OPS', name: 'Vận hành' },
] as const;

const POSITIONS = [
  { code: 'ENG-LEAD', title: 'Trưởng nhóm kỹ thuật', dept: 'ENG', level: 6, salary: 40_000_000 },
  { code: 'ENG-SR', title: 'Kỹ sư cao cấp', dept: 'ENG', level: 5, salary: 32_000_000 },
  { code: 'ENG-DEV', title: 'Lập trình viên', dept: 'ENG', level: 3, salary: 20_000_000 },
  { code: 'SALES-MGR', title: 'Trưởng phòng kinh doanh', dept: 'SALES', level: 6, salary: 35_000_000 },
  { code: 'SALES-EXEC', title: 'Nhân viên kinh doanh', dept: 'SALES', level: 2, salary: 14_000_000 },
  { code: 'MKT-MGR', title: 'Trưởng phòng marketing', dept: 'MKT', level: 6, salary: 33_000_000 },
  { code: 'MKT-SPEC', title: 'Chuyên viên marketing', dept: 'MKT', level: 3, salary: 16_000_000 },
  { code: 'HR-MGR', title: 'Trưởng phòng nhân sự', dept: 'HR', level: 6, salary: 30_000_000 },
  { code: 'HR-SPEC', title: 'Chuyên viên nhân sự', dept: 'HR', level: 3, salary: 16_000_000 },
  { code: 'FIN-ACC', title: 'Kế toán', dept: 'FIN', level: 3, salary: 18_000_000 },
  { code: 'FIN-MGR', title: 'Kế toán trưởng', dept: 'FIN', level: 6, salary: 32_000_000 },
  { code: 'OPS-STAFF', title: 'Nhân viên vận hành', dept: 'OPS', level: 2, salary: 13_000_000 },
] as const;

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const DEM = ['Văn', 'Thị', 'Hữu', 'Đức', 'Minh', 'Thanh', 'Quang', 'Ngọc', 'Gia', 'Khánh', 'Hải', 'Thu'];
const TEN = ['An', 'Bình', 'Cường', 'Dung', 'Giang', 'Hà', 'Hùng', 'Khoa', 'Lan', 'Mai', 'Nam', 'Oanh', 'Phúc', 'Quân', 'Sơn', 'Tâm', 'Trang', 'Uyên', 'Việt', 'Yến', 'Long', 'Linh', 'Đạt', 'Hương'];

const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
// VN wall-clock HH:mm on a given day → UTC instant (VN = UTC+7).
const vnInstant = (y: number, m: number, d: number, hh: number, mm = 0) => new Date(Date.UTC(y, m - 1, d, hh - 7, mm));
const isWeekend = (dt: Date) => dt.getUTCDay() === 0 || dt.getUTCDay() === 6;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// Seed against an already-open connection (caller manages connect/disconnect).
export async function runDemoSeed() {
  console.log(`Seeding demo data — ${EMP_COUNT} employees, attendance months ${MONTHS[0]}–${MONTHS.at(-1)}/${YEAR}…`);
  {
    // --- Departments ---
    const deptId = new Map<string, mongoose.Types.ObjectId>();
    for (const d of DEPARTMENTS) {
      const doc = await Department.findOneAndUpdate(
        { code: d.code }, { $set: { name: d.name, status: 'active' } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      deptId.set(d.code, doc!._id as mongoose.Types.ObjectId);
    }
    console.log(`  Departments: ${DEPARTMENTS.length}`);

    // --- Positions ---
    const posId = new Map<string, mongoose.Types.ObjectId>();
    for (const p of POSITIONS) {
      const doc = await Position.findOneAndUpdate(
        { code: p.code }, { $set: { title: p.title, departmentId: deptId.get(p.dept), level: p.level } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      posId.set(p.code, doc!._id as mongoose.Types.ObjectId);
    }
    console.log(`  Positions: ${POSITIONS.length}`);

    // --- Admin shift (needed for attendance) ---
    const shift = await Shift.findOneAndUpdate(
      { name: 'Hành chính' },
      { $set: { type: 'full_day', startTime: '08:00', endTime: '17:00', breakMinutes: 60, status: 'active' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const shiftId = shift!._id as mongoose.Types.ObjectId;

    // --- Employees ---
    interface Seeded { id: mongoose.Types.ObjectId; code: string; salary: number; hire: Date; official: boolean; }
    const employees: Seeded[] = [];
    for (let i = 1; i <= EMP_COUNT; i++) {
      const code = `NV${String(i).padStart(3, '0')}`;
      const pos = POSITIONS[i % POSITIONS.length]!;
      // ~15% hired this year → probation; rest hired 2022–2025 → official
      const probation = rnd() < 0.15;
      const hireYear = probation ? YEAR : randInt(YEAR - 4, YEAR - 1);
      const hire = utcDay(hireYear, randInt(1, probation ? 5 : 12), randInt(1, 28));
      const official = !probation;
      const type = rnd() < 0.1 ? 'part_time' : 'full_time';
      const salary = pos.salary * (0.9 + rnd() * 0.25);

      const emp = await Employee.findOneAndUpdate(
        { employeeCode: code },
        { $set: {
          departmentId: deptId.get(pos.dept), positionId: posId.get(pos.code), shiftId,
          hireDate: hire, employeeType: type, status: 'active', salaryZone: 'zone1',
        } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      const id = emp!._id as mongoose.Types.ObjectId;

      await EmployeeProfile.findOneAndUpdate(
        { employeeId: id },
        { $set: {
          firstName: pick(TEN), middleName: pick(DEM), lastName: pick(HO),
          email: `${code.toLowerCase()}@example.com`, gender: rnd() < 0.5 ? 'male' : 'female', nationality: 'VN',
        } },
        { upsert: true, setDefaultsOnInsert: true },
      );

      await EmployeeContractModel.findOneAndUpdate(
        { contractNumber: `HD-${code}` },
        { $set: {
          employeeId: id, contractType: official ? 'indefinite' : 'fixed_term',
          employmentStatus: official ? 'official' : 'probation',
          startDate: hire, baseSalary: dec(salary), currency: 'VND', status: 'active',
        } },
        { upsert: true, setDefaultsOnInsert: true },
      );

      const quotas: [string, number][] = [['annual', official ? 12 : 0], ['sick', 30], ['personal', 3]];
      for (const [t, entitled] of quotas) {
        await LeaveBalance.updateOne(
          { employeeId: id, leaveType: t, year: YEAR },
          { $set: { entitled }, $setOnInsert: { used: 0 } },
          { upsert: true },
        );
      }
      employees.push({ id, code, salary, hire, official });
    }
    console.log(`  Employees: ${employees.length} (profile + contract + leave balances)`);

    // Link demo login account to NV001 for account-flow testing
    const loginUser = await User.findOne({ email: 'employee@soosky.local' });
    if (loginUser && !loginUser.employeeId) {
      await Employee.updateOne({ _id: employees[0]!.id }, { userId: loginUser._id });
      await User.updateOne({ _id: loginUser._id }, { employeeId: employees[0]!.id });
      console.log('  Linked employee@soosky.local → NV001');
    }

    // --- Attendance months 1–6 (wipe seeded window first) ---
    const winStart = utcDay(YEAR, 1, 1);
    const winEnd = utcDay(YEAR, 6, daysInMonth(YEAR, 6));
    await Attendance.deleteMany({ employeeId: { $in: employees.map((e) => e.id) }, date: { $gte: winStart, $lte: winEnd } });

    const usedLeave = new Map<string, number>();
    const attDocs: Record<string, unknown>[] = [];
    for (const e of employees) {
      const hireKey = utcDay(e.hire.getUTCFullYear(), e.hire.getUTCMonth() + 1, e.hire.getUTCDate());
      for (const m of MONTHS) {
        for (let d = 1; d <= daysInMonth(YEAR, m); d++) {
          const date = utcDay(YEAR, m, d);
          if (isWeekend(date) || date < hireKey) continue;
          const roll = rnd();
          if (roll < 0.9) {
            attDocs.push({ employeeId: e.id, date, session: 'full_day', shiftId, status: 'present',
              checkIn: vnInstant(YEAR, m, d, 8, randInt(0, 4)), checkOut: vnInstant(YEAR, m, d, 17, randInt(0, 20)),
              workHours: 8, lateMinutes: 0, earlyMinutes: 0, source: 'manual' });
          } else if (roll < 0.95) {
            const late = randInt(10, 40);
            attDocs.push({ employeeId: e.id, date, session: 'full_day', shiftId, status: 'late',
              checkIn: vnInstant(YEAR, m, d, 8, late), checkOut: vnInstant(YEAR, m, d, 17, 0),
              workHours: 8, lateMinutes: late, earlyMinutes: 0, source: 'manual' });
          } else if (roll < 0.98) {
            attDocs.push({ employeeId: e.id, date, session: 'full_day', shiftId, status: 'leave_paid',
              checkIn: null, checkOut: null, workHours: 0, lateMinutes: 0, earlyMinutes: 0, source: 'leave' });
            usedLeave.set(e.code, (usedLeave.get(e.code) ?? 0) + 1);
          } else {
            attDocs.push({ employeeId: e.id, date, session: 'full_day', shiftId, status: 'absent',
              checkIn: null, checkOut: null, workHours: 0, lateMinutes: 0, earlyMinutes: 0, source: 'manual' });
          }
        }
      }
    }
    await Attendance.insertMany(attDocs, { ordered: false });
    console.log(`  Attendance: ${attDocs.length} records (${MONTHS[0]}–${MONTHS.at(-1)}/${YEAR})`);

    // reflect used annual leave into balances (official only)
    for (const e of employees) {
      const used = usedLeave.get(e.code);
      if (used && e.official) {
        await LeaveBalance.updateOne({ employeeId: e.id, leaveType: 'annual', year: YEAR }, { $set: { used: Math.min(used, 12) } });
      }
    }

    // --- Leave requests: pending + upcoming approved (drives dashboard panels) ---
    await LeaveRequest.deleteMany({ reason: 'seed-demo' });
    const reqMonth = 7; // requests live in the month after the attendance window
    const pendingCount = 6, upcomingCount = 4;
    for (let i = 0; i < pendingCount; i++) {
      const e = employees[randInt(0, employees.length - 1)]!;
      const day = randInt(15, 25);
      await LeaveRequest.create({ employeeId: e.id, leaveType: 'annual',
        startDate: utcDay(YEAR, reqMonth, day), endDate: utcDay(YEAR, reqMonth, day + 1), days: 2,
        status: 'pending', reason: 'seed-demo' });
    }
    for (let i = 0; i < upcomingCount; i++) {
      const e = employees[randInt(0, employees.length - 1)]!;
      const day = 10 + i;
      await LeaveRequest.create({ employeeId: e.id, leaveType: 'annual',
        startDate: utcDay(YEAR, reqMonth, day), endDate: utcDay(YEAR, reqMonth, day + 2), days: 3,
        status: 'approved', approvedAt: new Date(), reason: 'seed-demo' });
    }
    console.log(`  Leave requests: ${pendingCount} pending + ${upcomingCount} upcoming`);

    // --- Payroll period + payrolls (drives dashboard payroll + headcount) ---
    const pName = `${YEAR}-06`;
    const period = await PayrollPeriod.findOneAndUpdate(
      { name: pName },
      { $set: { startDate: utcDay(YEAR, 6, 1), endDate: utcDay(YEAR, 6, 30), payDate: utcDay(YEAR, 7, 5), standardWorkDays: 22, status: 'processing' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const periodId = period!._id as mongoose.Types.ObjectId;
    await Payroll.deleteMany({ payrollPeriodId: periodId });
    const payDocs = employees.map((e, i) => ({
      payrollPeriodId: periodId, employeeId: e.id,
      grossSalary: dec(e.salary), netSalary: dec(e.salary * 0.895),
      standardWorkDays: 22, actualWorkDays: 21, workDays: 21,
      status: i % 10 === 0 ? 'draft' : 'approved', computedAt: new Date(),
    }));
    await Payroll.insertMany(payDocs, { ordered: false });
    console.log(`  Payroll: period ${pName} + ${payDocs.length} payrolls`);

    // --- Monthly evaluations (top performers) ---
    await MonthlyEvaluation.deleteMany({ payrollPeriodId: periodId });
    const evalN = Math.min(15, employees.length);
    for (let i = 0; i < evalN; i++) {
      const e = employees[i]!;
      await MonthlyEvaluation.create({
        employeeId: e.id, payrollPeriodId: periodId,
        performanceRatio: randInt(50, 60), goalRatio: randInt(15, 20),
        status: 'approved', approvedAt: new Date(),
      });
    }
    console.log(`  Evaluations: ${evalN} approved`);

    console.log('\nDemo seed complete. Dashboard now shows real data.');
  }
}

async function main() {
  await connectDB();
  try {
    await runDemoSeed();
  } finally {
    await disconnectDB();
  }
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/seed-demo.ts');
if (invokedDirectly) {
  main().catch((err) => {
    console.error('Demo seed failed:', err);
    process.exit(1);
  });
}
