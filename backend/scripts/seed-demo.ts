/* eslint-disable no-console */
/**
 * Demo data seed — sample organisation, employees, leave balances, a contract,
 * a payroll period, and one linked login account (for testing the account flow).
 *
 * Idempotent: re-running upserts by natural keys (department code, position code,
 * employeeCode) so it won't create duplicates. Run AFTER `pnpm seed` (which seeds
 * roles/permissions/users/policy/criteria).
 *
 *   pnpm seed:demo
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '@core/database/mongoose';
import { Department } from '@shared/models/department.model';
import { Position } from '@shared/models/position.model';
import { Employee } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { LeaveBalance } from '@shared/models/leave-balance.model';
import { PayrollPeriod } from '@shared/models/payroll-period.model';
import { User } from '@shared/models/user.model';

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));
const YEAR = new Date().getFullYear();

const DEPARTMENTS = [
  { code: 'ENG', name: 'Kỹ thuật' },
  { code: 'HR', name: 'Nhân sự' },
  { code: 'SALES', name: 'Kinh doanh' },
];

const POSITIONS = [
  { code: 'ENG-DEV', title: 'Lập trình viên', dept: 'ENG', level: 3 },
  { code: 'ENG-LEAD', title: 'Trưởng nhóm kỹ thuật', dept: 'ENG', level: 5 },
  { code: 'HR-SPEC', title: 'Chuyên viên nhân sự', dept: 'HR', level: 3 },
  { code: 'SALES-EXEC', title: 'Nhân viên kinh doanh', dept: 'SALES', level: 2 },
];

const EMPLOYEES = [
  { code: 'NV001', first: 'An', last: 'Nguyễn Văn', dept: 'ENG', pos: 'ENG-LEAD', type: 'full_time', salary: 35_000_000, email: 'an.nguyen@example.com' },
  { code: 'NV002', first: 'Bình', last: 'Trần Thị', dept: 'ENG', pos: 'ENG-DEV', type: 'full_time', salary: 22_000_000, email: 'binh.tran@example.com' },
  { code: 'NV003', first: 'Cường', last: 'Lê Văn', dept: 'ENG', pos: 'ENG-DEV', type: 'full_time', salary: 20_000_000, email: 'cuong.le@example.com' },
  { code: 'NV004', first: 'Dung', last: 'Phạm Thị', dept: 'HR', pos: 'HR-SPEC', type: 'full_time', salary: 18_000_000, email: 'dung.pham@example.com' },
  { code: 'NV005', first: 'Em', last: 'Hoàng Văn', dept: 'SALES', pos: 'SALES-EXEC', type: 'full_time', salary: 15_000_000, email: 'em.hoang@example.com' },
  { code: 'NV006', first: 'Giang', last: 'Vũ Thị', dept: 'SALES', pos: 'SALES-EXEC', type: 'part_time', salary: 12_000_000, email: 'giang.vu@example.com' },
] as const;

const LEAVE_QUOTAS: { type: 'annual' | 'sick' | 'personal'; entitled: number }[] = [
  { type: 'annual', entitled: 12 },
  { type: 'sick', entitled: 30 },
  { type: 'personal', entitled: 3 },
];

async function main() {
  console.log('Seeding demo data…');
  await connectDB();
  try {
    // Departments
    const deptId = new Map<string, mongoose.Types.ObjectId>();
    for (const d of DEPARTMENTS) {
      const doc = await Department.findOneAndUpdate(
        { code: d.code },
        { $set: { name: d.name, status: 'active' } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      deptId.set(d.code, doc!._id as mongoose.Types.ObjectId);
    }
    console.log(`  Departments: ${DEPARTMENTS.length}`);

    // Positions
    const posId = new Map<string, mongoose.Types.ObjectId>();
    for (const p of POSITIONS) {
      const doc = await Position.findOneAndUpdate(
        { code: p.code },
        { $set: { title: p.title, departmentId: deptId.get(p.dept), level: p.level } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      posId.set(p.code, doc!._id as mongoose.Types.ObjectId);
    }
    console.log(`  Positions: ${POSITIONS.length}`);

    // Employees + profile + leave balances + an active contract
    let linked = 0;
    for (const e of EMPLOYEES) {
      const emp = await Employee.findOneAndUpdate(
        { employeeCode: e.code },
        {
          $set: {
            departmentId: deptId.get(e.dept),
            positionId: posId.get(e.pos),
            hireDate: new Date(`${YEAR}-01-01`),
            employeeType: e.type,
            status: 'active',
            salaryZone: 'zone1',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      const empId = emp!._id as mongoose.Types.ObjectId;

      await EmployeeProfile.findOneAndUpdate(
        { employeeId: empId },
        { $set: { firstName: e.first, lastName: e.last, email: e.email, gender: 'undisclosed', nationality: 'VN' } },
        { upsert: true, setDefaultsOnInsert: true },
      );

      await EmployeeContractModel.findOneAndUpdate(
        { contractNumber: `HD-${e.code}` },
        {
          $set: {
            employeeId: empId,
            contractType: 'indefinite',
            startDate: new Date(`${YEAR}-01-01`),
            baseSalary: dec(e.salary),
            currency: 'VND',
            status: 'active',
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );

      for (const q of LEAVE_QUOTAS) {
        await LeaveBalance.updateOne(
          { employeeId: empId, leaveType: q.type, year: YEAR },
          { $setOnInsert: { entitled: q.entitled, used: 0 } },
          { upsert: true },
        );
      }

      // Link the first demo employee to the seeded `employee` login account so
      // the Account tab / login flow is testable end-to-end.
      if (e.code === 'NV001' && !emp!.userId) {
        const user = await User.findOne({ email: 'employee@soosky.local' });
        if (user && !user.employeeId) {
          await Employee.updateOne({ _id: empId }, { userId: user._id });
          await User.updateOne({ _id: user._id }, { employeeId: empId });
          linked = 1;
        }
      }
    }
    console.log(`  Employees: ${EMPLOYEES.length} (with profile, contract, leave balances)`);
    if (linked) console.log('  Linked employee@soosky.local → NV001');

    // Payroll period for the current month (name YYYY-MM)
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const pay = new Date(now.getFullYear(), now.getMonth() + 1, 5);
    await PayrollPeriod.findOneAndUpdate(
      { name: ym },
      { $setOnInsert: { startDate: start, endDate: end, payDate: pay, standardWorkDays: 22, status: 'open' } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    console.log(`  PayrollPeriod: ${ym}`);

    console.log('\nDemo seed complete.');
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
