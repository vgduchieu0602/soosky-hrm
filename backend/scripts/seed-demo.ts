/**
 * Demo data seed — a full, realistic dataset so every HRM module has something
 * to show without falling back to the frontend's mock data.
 *
 * Run AFTER `pnpm seed`, which provides the roles, permissions, demo accounts,
 * company config, salary policy, performance criteria and catalogs this builds
 * on top of.
 *
 *   pnpm seed:clear -- --yes
 *   pnpm seed
 *   pnpm seed:demo
 *
 * ── Two rules this script is built around ─────────────────────────────────────
 *
 * 1. Derived data comes from the real use-cases. Leave approval, evaluations and
 *    payroll all go through the application layer, so attendance rows, ratios,
 *    insurance, tax and the payroll snapshot are produced by the same code the
 *    API runs. The seed only supplies inputs.
 *
 * 2. No external side effects. Domain event listeners (credential emails,
 *    notification fan-out) are registered by `server.ts` and by nothing else —
 *    so `eventBus.emit` here has no subscribers and nothing is delivered.
 *    NEVER import `src/server.ts` or call `registerAccountEmailListeners` /
 *    `registerNotificationListeners` from a seed: SMTP is configured in `.env`,
 *    and doing so would send real email to every seeded address.
 */
import { connectDB, disconnectDB } from '@infra/db/mongoose';
import { assertNotProduction, section } from './seed/common';
import { seedOrganization, backfillDepartmentManagers } from './seed/organization.seed';
import { seedEmployees } from './seed/employee.seed';
import { seedPeriods } from './seed/period.seed';
import { seedCompensation } from './seed/compensation.seed';
import { resetAttendanceAndLeave, seedLeave } from './seed/leave.seed';
import { seedAttendance, countLeaveAttendance } from './seed/attendance.seed';
import { seedPerformance } from './seed/performance.seed';
import { seedPayroll } from './seed/payroll.seed';
import { seedNotifications } from './seed/notification.seed';
import { DEPARTMENTS, POSITIONS } from './seed/dataset';

const CREDENTIALS = [
  'admin@soosky.local / Admin@12345',
  'hr@soosky.local / Hr@12345',
  'employee@soosky.local / Employee@12345',
];

async function runDemoSeed(): Promise<void> {
  section('Organization');
  const org = await seedOrganization();

  section('Employees');
  const employees = await seedEmployees(org);
  await backfillDepartmentManagers(org.deptId, new Map(employees.map((e) => [e.code, e.id])));

  section('Periods');
  const periods = await seedPeriods();

  section('Compensation');
  const compensation = await seedCompensation(employees, periods);

  section('Leave');
  await resetAttendanceAndLeave(employees, periods);
  const leave = await seedLeave(employees, periods);

  section('Attendance');
  const attendance = await seedAttendance(employees, periods);
  const leaveRows = await countLeaveAttendance(employees.map((e) => e.id));

  section('Performance');
  const performance = await seedPerformance(employees, periods);

  section('Payroll');
  const payroll = await seedPayroll(periods);

  section('Notification');
  const notifications = await seedNotifications();

  // ---- summary ----
  console.log('\n────────────────────────────────────────');
  console.log('Seed demo complete\n');
  console.log('IAM');
  console.log('  Users: 3');
  console.log('  Roles: 3');
  console.log('\nOrganization');
  console.log(`  Departments: ${DEPARTMENTS.length}`);
  console.log(`  Positions: ${POSITIONS.length}`);
  console.log('\nEmployees');
  console.log(`  Employees: ${employees.length}`);
  console.log(`  Allowances: ${compensation.allowances}`);
  console.log('\nPeriods');
  for (const p of periods) console.log(`  ${p.name}: ${p.standardWorkDays} standard work days`);
  console.log('\nAttendance');
  console.log(`  Records: ${attendance.inserted + leaveRows} (${attendance.inserted} punched, ${leaveRows} from leave)`);
  console.log('\nLeave');
  console.log(`  Balances: ${leave.balances}`);
  console.log(`  Requests: ${leave.approved + leave.pending + leave.rejected + leave.cancelled}`);
  console.log('\nPerformance');
  console.log(`  Reviews: ${performance.finalized + performance.drafts}`);
  console.log('\nPayroll');
  console.log(`  Records: ${Object.values(payroll.byStatus).reduce((a, b) => a + b, 0)}`);
  console.log(`  Bonuses: ${compensation.bonuses}   Deductions: ${compensation.deductions}`);
  console.log('\nNotification');
  console.log(`  Notifications: ${notifications}`);

  const problems = [...leave.skipped, ...performance.errors, ...payroll.errors];
  if (problems.length > 0) {
    console.log(`\n${problems.length} step(s) reported a problem — see the WARN lines above.`);
  }

  console.log('\nDemo credentials:\n');
  for (const c of CREDENTIALS) console.log(`  ${c}`);
  console.log('');
}

async function main() {
  assertNotProduction('seed:demo');
  console.log('Seeding Soosky HRM demo data...');
  await connectDB();
  try {
    await runDemoSeed();
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
