/**
 * Recurring allowances, one-off bonuses and post-tax deductions.
 *
 * These have to exist BEFORE the payroll run: the engine pulls whatever is in
 * effect at compute time into gross/net, so seeding them afterwards would leave
 * every payslip missing its allowance and bonus lines.
 */
import type mongoose from 'mongoose';
import { Allowance } from '@modules/hrm/adapters/persistence/mongoose/models/allowance.model';
import { Bonus } from '@modules/hrm/adapters/persistence/mongoose/models/bonus.model';
import { Deduction } from '@modules/hrm/adapters/persistence/mongoose/models/deduction.model';
import { BONUSES, DEDUCTIONS, POSITIONS } from './dataset';
import { dec, line } from './common';
import type { SeededEmployee } from './employee.seed';
import type { SeededPeriod } from './period.seed';

type Id = mongoose.Types.ObjectId;

const LEVEL_BY_POSITION = new Map(POSITIONS.map((p) => [p.code, p.level]));

interface AllowanceRow {
  name: string;
  category: string;
  amount: number;
  isTaxable: boolean;
  isInsuranceBase: boolean;
}

/**
 * Which allowances a role carries. Kept as a rule over the position level rather
 * than a 40-row table — the shape stays obvious and adding an employee to the
 * dataset needs no matching allowance entry.
 */
function allowancesFor(employee: SeededEmployee): AllowanceRow[] {
  const level = LEVEL_BY_POSITION.get(employee.seed.position) ?? 1;
  const rows: AllowanceRow[] = [
    // Meal allowance up to 730k/month is tax-exempt under Vietnamese rules.
    { name: 'Phụ cấp ăn trưa', category: 'meal', amount: 730_000, isTaxable: false, isInsuranceBase: false },
  ];
  if (employee.isOfficial) {
    rows.push({ name: 'Phụ cấp đi lại', category: 'transport', amount: 500_000, isTaxable: true, isInsuranceBase: false });
  }
  if (level >= 6) {
    rows.push({ name: 'Phụ cấp trách nhiệm', category: 'responsibility', amount: 3_000_000, isTaxable: true, isInsuranceBase: true });
    rows.push({ name: 'Phụ cấp điện thoại', category: 'phone', amount: 300_000, isTaxable: false, isInsuranceBase: false });
  }
  return rows;
}

export async function seedCompensation(
  employees: SeededEmployee[],
  periods: SeededPeriod[],
): Promise<{ allowances: number; bonuses: number; deductions: number }> {
  const byCode = new Map(employees.map((e) => [e.code, e]));
  const periodByOffset = new Map(periods.map((p) => [p.offset, p]));

  let allowances = 0;
  for (const employee of employees) {
    for (const row of allowancesFor(employee)) {
      await Allowance.findOneAndUpdate(
        { employeeId: employee.id, name: row.name },
        {
          $set: {
            category: row.category,
            type: 'fixed',
            amount: dec(row.amount),
            isTaxable: row.isTaxable,
            isInsuranceBase: row.isInsuranceBase,
            effectiveDate: employee.hireDate,
            endDate: employee.terminationDate,
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
      allowances += 1;
    }
  }
  line('Allowances', allowances);

  let bonuses = 0;
  for (const b of BONUSES) {
    const employee = byCode.get(b.employee);
    const period = periodByOffset.get(b.offset);
    if (!employee || !period) continue;
    await Bonus.findOneAndUpdate(
      { employeeId: employee.id, payrollPeriodId: period.id, name: b.name },
      { $set: { amount: dec(b.amount), isTaxable: b.isTaxable, reason: b.reason } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    bonuses += 1;
  }
  line('Bonuses', bonuses);

  let deductions = 0;
  for (const d of DEDUCTIONS) {
    const employee = byCode.get(d.employee);
    if (!employee) continue;
    const periodId: Id | null = d.offset === null ? null : (periodByOffset.get(d.offset)?.id ?? null);
    if (d.offset !== null && !periodId) continue;
    await Deduction.findOneAndUpdate(
      { employeeId: employee.id, name: d.name, payrollPeriodId: periodId },
      {
        $set: {
          type: 'fixed',
          amount: dec(d.amount),
          reason: d.reason,
          effectiveDate: employee.hireDate,
          endDate: null,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    deductions += 1;
  }
  line('Deductions', deductions);

  return { allowances, bonuses, deductions };
}
