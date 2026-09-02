/* eslint-disable no-console */
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

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));

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
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  console.log('  SalaryPolicyConfig: VN 2026 ensured');
}

/** Default performance + goal sub-indicators (equally weighted → simple average). */
async function seedPerformanceCriteria() {
  const criteria = [
    // Performance sub-indicators (→ 60%)
    { key: 'quality', label: 'Chất lượng công việc', type: 'performance', order: 1 },
    { key: 'productivity', label: 'Năng suất & khối lượng', type: 'performance', order: 2 },
    { key: 'teamwork', label: 'Phối hợp & tinh thần đồng đội', type: 'performance', order: 3 },
    { key: 'discipline', label: 'Kỷ luật & tuân thủ', type: 'performance', order: 4 },
    // Goal sub-indicators (→ 20%)
    { key: 'goal_individual', label: 'Mục tiêu cá nhân', type: 'goal', order: 1 },
    { key: 'goal_team', label: 'Mục tiêu nhóm/phòng ban', type: 'goal', order: 2 },
  ];
  for (const c of criteria) {
    await PerformanceCriterion.findOneAndUpdate(
      { key: c.key },
      { $set: { label: c.label, type: c.type, order: c.order, status: 'active' } },
      { upsert: true },
    );
  }
  console.log(`  PerformanceCriteria: ${criteria.length} ensured (perf + goal)`);
}

/** Singleton company config (work days, grace, policy toggles). */
async function seedCompanyConfig() {
  await CompanyConfig.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global', standardWorkDays: 22, overtimeEnabled: false, lateAffectsPay: false } },
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
      { upsert: true, new: true },
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
      { upsert: true, new: true },
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

async function seedUsers(roleIds: Map<string, Types.ObjectId>) {
  for (const u of USERS) {
    const existing = await User.findOne({ email: u.email });
    let userDoc;
    if (existing) {
      userDoc = existing;
    } else {
      const hashedPassword = await hashPassword(u.password);
      userDoc = await User.create({
        username: u.username,
        email: u.email,
        password: hashedPassword,
        status: 'active',
        mustChangePassword: true,
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

// Seed against an already-open connection (caller manages connect/disconnect).
export async function runSeed() {
  const permIds = await seedPermissions();
  const roleIds = await seedRoles();
  await seedRolePermissions(roleIds, permIds);
  await seedUsers(roleIds);
  await seedCompanyConfig();
  await seedSalaryPolicy();
  await seedPerformanceCriteria();
  console.log('\nSeed complete. Demo credentials:');
  for (const u of USERS) {
    console.log(`  ${u.email}  /  ${u.password}  (${u.roleName})`);
  }
}

async function main() {
  console.log('Seeding Soosky HRM IAM...');
  await connectDB();
  try {
    await runSeed();
  } finally {
    await disconnectDB();
  }
}

// Only self-run when invoked directly (not when imported by dev-local).
const invokedDirectly = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/seed.ts');
if (invokedDirectly) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
