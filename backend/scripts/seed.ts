import mongoose, { Types } from 'mongoose';
import { connectDB, disconnectDB } from '@infra/db/mongoose';
import { hashPassword } from '@shared/crypto/hash.util';
import { Permission } from '@modules/iam/adapters/persistence/models/permission.model';
import { Role } from '@modules/iam/adapters/persistence/models/role.model';
import { RolePermission } from '@modules/iam/adapters/persistence/models/role-permission.model';
import { User } from '@modules/iam/adapters/persistence/models/user.model';
import { UserRole } from '@modules/iam/adapters/persistence/models/user-role.model';
import { SalaryPolicyConfig } from '@modules/hrm/adapters/persistence/mongoose/models/salary-policy-config.model';
import { PerformanceCriterion } from '@modules/hrm/adapters/persistence/mongoose/models/performance-criterion.model';
import { CompanyConfig } from '@modules/hrm/adapters/persistence/mongoose/models/company-config.model';
import { Shift } from '@modules/hrm/adapters/persistence/mongoose/models/shift.model';
import { Holiday } from '@modules/hrm/adapters/persistence/mongoose/models/holiday.model';
import { AttendanceSymbol } from '@modules/hrm/adapters/persistence/mongoose/models/attendance-symbol.model';
import { Bank } from '@modules/hrm/adapters/persistence/mongoose/models/bank.model';

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));
const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** Vietnamese statutory payroll policy (2024–2026 figures). */
async function seedSalaryPolicy() {
  await SalaryPolicyConfig.findOneAndUpdate(
    { country: 'VN', year: 2026, effectiveFrom: new Date('2026-01-01') },
    {
      $set: {
        baseSalary: dec(2_340_000), // lương cơ sở (trần BHXH/BHYT = ×20)
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
          employee: { social: 8, health: 1.5, unemployment: 1 }, // 10.5%
          employer: { social: 17.5, health: 3, unemployment: 1 }, // 21.5%
        },
        // Fixed company-wide salary the insurance is contributed on (mức đóng BHXH).
        socialInsuranceSalary: dec(5_500_000),
        unionFeeRate: 1, // 1% of socialInsuranceSalary
        unionFeeEnabled: true,
        salaryComponentWeights: { attendance: 20, performance: 60, goal: 20 },
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  console.log('  SalaryPolicyConfig: VN 2026 ensured');
}

/**
 * Default performance + goal sub-indicators.
 *
 * `weight` is REQUIRED, not cosmetic: `EvaluationUseCases.directEvaluate` refuses
 * to finalize an evaluation unless each group's weights total exactly 100
 * (`EVAL_INVALID_CRITERIA_WEIGHTS`). Equal weights inside a group reproduce the
 * simple average the ratios were designed around: 4 × 25 and 2 × 50.
 */
async function seedPerformanceCriteria() {
  const criteria = [
    // Performance sub-indicators (→ 60%) — 4 × 25 = 100
    { key: 'quality', label: 'Chất lượng công việc', type: 'performance', weight: 25, order: 1 },
    { key: 'productivity', label: 'Năng suất & khối lượng', type: 'performance', weight: 25, order: 2 },
    { key: 'teamwork', label: 'Phối hợp & tinh thần đồng đội', type: 'performance', weight: 25, order: 3 },
    { key: 'discipline', label: 'Kỷ luật & tuân thủ', type: 'performance', weight: 25, order: 4 },
    // Goal sub-indicators (→ 20%) — 2 × 50 = 100
    { key: 'goal_individual', label: 'Mục tiêu cá nhân', type: 'goal', weight: 50, order: 1 },
    { key: 'goal_team', label: 'Mục tiêu nhóm/phòng ban', type: 'goal', weight: 50, order: 2 },
  ];
  for (const c of criteria) {
    await PerformanceCriterion.findOneAndUpdate(
      { key: c.key },
      { $set: { label: c.label, type: c.type, weight: c.weight, order: c.order, status: 'active' } },
      { upsert: true },
    );
  }
  console.log(`  PerformanceCriteria: ${criteria.length} ensured (perf 4×25 + goal 2×50)`);
}

/** Work shifts — attendance cannot be recorded without at least one. */
async function seedShifts() {
  const shifts = [
    { name: 'Hành chính', type: 'full_day', startTime: '08:00', endTime: '17:00', breakMinutes: 60, workingDays: [1, 2, 3, 4, 5] },
    // Mon–Fri like the office shift: `workingDays` is the denominator payroll
    // uses for `standardWorkDays`, so adding Saturday here would permanently
    // hold this shift's attendance ratio below 1.
    { name: 'Ca sáng', type: 'morning', startTime: '08:00', endTime: '12:00', breakMinutes: 0, workingDays: [1, 2, 3, 4, 5] },
  ];
  for (const s of shifts) {
    await Shift.findOneAndUpdate(
      { name: s.name },
      { $set: { ...s, status: 'active' } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  console.log(`  Shifts: ${shifts.length} ensured`);
}

/**
 * Vietnamese statutory holidays for the current year. They are excluded from
 * `standardWorkDays`, so a missing holiday silently understates every payroll
 * attendance ratio for the month containing it.
 *
 * Lunar-calendar dates (Tết, Giỗ Tổ) move every year → stored as fixed dates for
 * the seeded year only. Solar-calendar ones are marked `isRecurring`.
 */
async function seedHolidays() {
  const year = new Date().getUTCFullYear();
  const holidays: { name: string; date: Date; isRecurring: boolean }[] = [
    { name: 'Tết Dương lịch', date: utcDay(year, 1, 1), isRecurring: true },
    { name: 'Ngày Giải phóng miền Nam', date: utcDay(year, 4, 30), isRecurring: true },
    { name: 'Ngày Quốc tế Lao động', date: utcDay(year, 5, 1), isRecurring: true },
    { name: 'Quốc khánh', date: utcDay(year, 9, 2), isRecurring: true },
    { name: 'Quốc khánh (nghỉ liền kề)', date: utcDay(year, 9, 1), isRecurring: true },
  ];
  // Lunar dates — only correct for the year they are listed under.
  if (year === 2026) {
    for (let d = 16; d <= 20; d++) {
      holidays.push({ name: `Tết Nguyên Đán (ngày ${d - 15})`, date: utcDay(2026, 2, d), isRecurring: false });
    }
    holidays.push({ name: 'Giỗ Tổ Hùng Vương', date: utcDay(2026, 4, 26), isRecurring: false });
  }
  for (const h of holidays) {
    await Holiday.findOneAndUpdate(
      { name: h.name, date: h.date },
      { $set: { isRecurring: h.isRecurring, country: 'VN' } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  console.log(`  Holidays: ${holidays.length} ensured (${year})`);
}

/** Legend the attendance grid renders — one symbol per attendance status. */
async function seedAttendanceSymbols() {
  const symbols = [
    { code: 'X', label: 'Đi làm đủ', paidStatus: 'paid', affectsPayroll: false, appliesTo: 'present', color: '#16a34a' },
    { code: 'M', label: 'Đi muộn', paidStatus: 'paid', affectsPayroll: false, appliesTo: 'late', color: '#f59e0b' },
    { code: 'S', label: 'Về sớm', paidStatus: 'paid', affectsPayroll: false, appliesTo: 'early_leave', color: '#f97316' },
    { code: '?', label: 'Thiếu giờ ra', paidStatus: 'neutral', affectsPayroll: true, appliesTo: 'incomplete', color: '#a855f7' },
    { code: 'P', label: 'Nghỉ có lương', paidStatus: 'paid', affectsPayroll: true, appliesTo: 'leave_paid', leaveType: 'annual', color: '#0ea5e9' },
    { code: 'KL', label: 'Nghỉ không lương', paidStatus: 'unpaid', affectsPayroll: true, appliesTo: 'leave_unpaid', leaveType: 'unpaid', color: '#64748b' },
    { code: 'V', label: 'Vắng không phép', paidStatus: 'unpaid', affectsPayroll: true, appliesTo: 'absent', color: '#dc2626' },
    { code: 'L', label: 'Nghỉ lễ', paidStatus: 'paid', affectsPayroll: false, appliesTo: 'holiday', color: '#6366f1' },
  ];
  for (const s of symbols) {
    await AttendanceSymbol.findOneAndUpdate({ code: s.code }, { $set: s }, { upsert: true, setDefaultsOnInsert: true });
  }
  console.log(`  AttendanceSymbols: ${symbols.length} ensured`);
}

/** Bank catalog for employee bank accounts. */
async function seedBanks() {
  const banks = [
    { name: 'Vietcombank', code: 'VCB' },
    { name: 'Techcombank', code: 'TCB' },
    { name: 'BIDV', code: 'BIDV' },
    { name: 'VietinBank', code: 'CTG' },
    { name: 'MB Bank', code: 'MBB' },
    { name: 'ACB', code: 'ACB' },
    { name: 'VPBank', code: 'VPB' },
    { name: 'TPBank', code: 'TPB' },
    { name: 'Agribank', code: 'VBA' },
    { name: 'Sacombank', code: 'STB' },
  ];
  for (const b of banks) {
    await Bank.findOneAndUpdate({ name: b.name }, { $set: { code: b.code, status: 'active' } }, { upsert: true, setDefaultsOnInsert: true });
  }
  console.log(`  Banks: ${banks.length} ensured`);
}

/**
 * Singleton company config (work days, grace, policy toggles).
 *
 * `$setOnInsert` only — re-running the seed must never overwrite values HR has
 * changed in Settings.
 */
async function seedCompanyConfig() {
  await CompanyConfig.findOneAndUpdate(
    { key: 'global' },
    {
      $setOnInsert: {
        key: 'global',
        standardWorkDays: 22,
        overtimeEnabled: false,
        lateAffectsPay: false,
        // Read by PolicyGateway.annualQuota() when granting annual leave.
        leaveQuotas: { annual: 12, sick: 30, personal: 3 },
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  console.log('  CompanyConfig: global ensured');
}

type PermissionSeed = {
  key: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'approve';
  description?: string;
};

const PERMISSIONS: PermissionSeed[] = [
  // IAM
  { key: 'iam:user:read', resource: 'user', action: 'read' },
  { key: 'iam:user:create', resource: 'user', action: 'create' },
  { key: 'iam:user:update', resource: 'user', action: 'update' },
  { key: 'iam:user:delete', resource: 'user', action: 'delete' },
  { key: 'iam:role:read', resource: 'role', action: 'read' },
  { key: 'iam:role:update', resource: 'role', action: 'update' },

  // Employee
  { key: 'employee:read', resource: 'employee', action: 'read' },
  { key: 'employee:create', resource: 'employee', action: 'create' },
  { key: 'employee:update', resource: 'employee', action: 'update' },
  { key: 'employee:delete', resource: 'employee', action: 'delete' },
  { key: 'employee:grant-login', resource: 'employee', action: 'approve' },

  // Organization
  { key: 'organization:department:read', resource: 'department', action: 'read' },
  { key: 'organization:department:create', resource: 'department', action: 'create' },
  { key: 'organization:department:update', resource: 'department', action: 'update' },
  { key: 'organization:department:delete', resource: 'department', action: 'delete' },
  { key: 'organization:position:read', resource: 'position', action: 'read' },
  { key: 'organization:position:create', resource: 'position', action: 'create' },
  { key: 'organization:position:update', resource: 'position', action: 'update' },
  { key: 'organization:position:delete', resource: 'position', action: 'delete' },

  // Attendance & Leave
  { key: 'attendance:read', resource: 'attendance', action: 'read' },
  { key: 'attendance:create', resource: 'attendance', action: 'create' },
  { key: 'attendance:update', resource: 'attendance', action: 'update' },
  { key: 'leave:read', resource: 'leave', action: 'read' },
  { key: 'leave:create', resource: 'leave', action: 'create' },
  { key: 'leave:approve', resource: 'leave', action: 'approve' },

  // Payroll
  { key: 'payroll:read', resource: 'payroll', action: 'read' },
  { key: 'payroll:compute', resource: 'payroll', action: 'create' },
  { key: 'payroll:approve', resource: 'payroll', action: 'approve' },
  { key: 'payslip:read', resource: 'payslip', action: 'read' },

  // Performance
  { key: 'performance:read', resource: 'performance', action: 'read' },
  { key: 'performance:review', resource: 'performance', action: 'update' },

  // Self
  { key: 'self:read', resource: 'self', action: 'read' },
];

const ROLE_MATRIX = {
  admin: PERMISSIONS.map((p) => p.key),
  hr_manager: PERMISSIONS.filter((p) => p.key !== 'iam:role:update').map((p) => p.key),
  employee: [
    'self:read',
    'attendance:read',
    'leave:read',
    'leave:create',
    'payslip:read',
    'performance:read',
  ],
} as const;

const ROLES: Array<{ name: keyof typeof ROLE_MATRIX; description: string }> = [
  { name: 'admin', description: 'System administrator — full access' },
  { name: 'hr_manager', description: 'HR manager — manage employees, payroll, attendance' },
  { name: 'employee', description: 'Regular employee — self-service' },
];

const USERS: Array<{
  username: string;
  email: string;
  password: string;
  roleName: keyof typeof ROLE_MATRIX;
}> = [
  { username: 'admin', email: 'admin@soosky.local', password: 'Admin@12345', roleName: 'admin' },
  { username: 'hr', email: 'hr@soosky.local', password: 'Hr@12345', roleName: 'hr_manager' },
  { username: 'employee', email: 'employee@soosky.local', password: 'Employee@12345', roleName: 'employee' },
];

async function seedPermissions(): Promise<Map<string, Types.ObjectId>> {
  const map = new Map<string, Types.ObjectId>();
  for (const p of PERMISSIONS) {
    const doc = await Permission.findOneAndUpdate(
      { key: p.key },
      { $setOnInsert: { resource: p.resource, action: p.action, description: p.description ?? '' } },
      { upsert: true, returnDocument: 'after' },
    );
    map.set(p.key, doc._id);
  }
  console.log(`  Permissions: ${map.size} upserted`);
  return map;
}

async function seedRoles(): Promise<Map<string, Types.ObjectId>> {
  const map = new Map<string, Types.ObjectId>();
  for (const r of ROLES) {
    const doc = await Role.findOneAndUpdate(
      { name: r.name },
      { $set: { description: r.description, isSystem: true } },
      { upsert: true, returnDocument: 'after' },
    );
    map.set(r.name, doc._id);
  }
  console.log(`  Roles: ${map.size} upserted`);
  return map;
}

async function seedRolePermissions(
  roleIds: Map<string, Types.ObjectId>,
  permIds: Map<string, Types.ObjectId>,
) {
  let count = 0;
  for (const [roleName, keys] of Object.entries(ROLE_MATRIX)) {
    const roleId = roleIds.get(roleName);
    if (!roleId) continue;
    for (const key of keys) {
      const permId = permIds.get(key);
      if (!permId) {
        console.warn(`  WARN: missing permission "${key}" for role "${roleName}"`);
        continue;
      }
      await RolePermission.updateOne(
        { roleId, permissionId: permId },
        { $setOnInsert: { roleId, permissionId: permId } },
        { upsert: true },
      );
      count++;
    }
  }
  console.log(`  RolePermissions: ${count} ensured`);
}

/**
 * Demo accounts. Passwords are hashed with the project's own `hashPassword`;
 * the plaintext never reaches the database.
 *
 * `mustChangePassword: false` is deliberate — the web client's
 * `MustChangePasswordRoute` redirects every route to /auth/change-password while
 * that flag is set, which would make the documented demo credentials unusable.
 * Existing rows are re-normalised on every run so a locked-out or rate-limited
 * demo account heals itself instead of needing manual DB surgery.
 */
async function seedUsers(roleIds: Map<string, Types.ObjectId>) {
  for (const u of USERS) {
    const existing = await User.findOne({ email: u.email });
    let userDoc;
    if (existing) {
      userDoc = existing;
      await User.updateOne(
        { _id: existing._id },
        { $set: { status: 'active', failedLoginAttempts: 0, mustChangePassword: false } },
      );
    } else {
      const hashedPassword = await hashPassword(u.password);
      userDoc = await User.create({
        username: u.username,
        email: u.email,
        password: hashedPassword,
        status: 'active',
        failedLoginAttempts: 0,
        mustChangePassword: false,
      });
      console.log(`  User created: ${u.email}`);
    }

    const roleId = roleIds.get(u.roleName);
    if (!roleId) {
      console.warn(`  WARN: role "${u.roleName}" not found for ${u.email}`);
      continue;
    }
    await UserRole.updateOne(
      { userId: userDoc._id, roleId },
      { $setOnInsert: { userId: userDoc._id, roleId, assignedAt: new Date() } },
      { upsert: true },
    );
  }
  console.log(`  Users: ${USERS.length} ensured`);
}

async function runSeed() {
  console.log('IAM');
  const permIds = await seedPermissions();
  const roleIds = await seedRoles();
  await seedRolePermissions(roleIds, permIds);
  await seedUsers(roleIds);

  console.log('\nSettings');
  await seedCompanyConfig();
  await seedSalaryPolicy();
  await seedPerformanceCriteria();

  console.log('\nCatalogs');
  await seedShifts();
  await seedHolidays();
  await seedAttendanceSymbols();
  await seedBanks();

  console.log('\nSeed complete. Demo credentials:');
  for (const u of USERS) {
    console.log(`  ${u.email}  /  ${u.password}  (${u.roleName})`);
  }
  console.log('\nNext: pnpm seed:demo');
}

async function main() {
  console.log('Seeding Soosky HRM system data...\n');
  await connectDB();
  try {
    await runSeed();
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
