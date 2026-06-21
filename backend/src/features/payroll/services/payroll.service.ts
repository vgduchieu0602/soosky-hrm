import mongoose from 'mongoose';
import { NotFoundError } from '@shared/errors/not-found.error';
import { Employee } from '@shared/models/employee.model';
import { PayrollPeriod } from '@shared/models/payroll-period.model';
import { SalaryPolicyConfig } from '@shared/models/salary-policy-config.model';
import {
  grossUpFromNet,
  type TaxBracket,
  type InsuranceRates,
  type GrossUpResult,
} from '@shared/utils/salary.util';
import { payrollRepository, type ListPayrollFilter } from '@features/payroll/repositories/payroll.repository';
import type { GrossUpDto } from '@features/payroll/dto/gross-up.dto';

const toNum = (d: mongoose.Types.Decimal128 | number | null | undefined): number =>
  d == null ? 0 : Number(d.toString());

export const payrollService = {
  /**
   * NET → GROSS gross-up using the salary policy effective at `payDate`.
   * Reuses the same insurance/tax engine as payroll so results are consistent.
   */
  async grossUp(input: GrossUpDto): Promise<GrossUpResult> {
    const payDate = input.payDate ?? new Date();
    const policy = await SalaryPolicyConfig.findOne({ effectiveFrom: { $lte: payDate } })
      .sort({ effectiveFrom: -1 })
      .lean();
    if (!policy) throw new NotFoundError('Salary policy config');

    const multiplier = policy.insuranceCeilingMultiplier ?? 20;
    const zone = input.salaryZone ?? 'zone1';
    const zoneWage = Number((policy.regionalMinWage as Record<string, unknown> | undefined)?.[zone] ?? 0);

    // Insurance is contributed on the fixed company salary (mức đóng BHXH).
    // The NET→GROSS conversion intentionally EXCLUDES union fee — gross↔net is
    // defined by BHXH + PIT only (union fee is collected separately).
    const insuranceBaseSalary = toNum(policy.socialInsuranceSalary);

    return grossUpFromNet(input.net, {
      socialHealthCeiling: toNum(policy.baseSalary) * multiplier,
      unemploymentCeiling: zoneWage * multiplier,
      personalDeduction: toNum(policy.personalDeduction),
      dependentDeduction: toNum(policy.dependentDeduction),
      dependentsCount: input.dependentsCount ?? 0,
      isResident: input.isResident ?? true,
      nonResidentTaxRate: policy.nonResidentTaxRate,
      taxBrackets: policy.taxBrackets as TaxBracket[] | undefined,
      insuranceRates: policy.insuranceRates as InsuranceRates | undefined,
      insuranceBaseSalary: insuranceBaseSalary || undefined,
    });
  },

  async paginate(filter: ListPayrollFilter, page: number, limit: number) {
    return payrollRepository.paginate(filter, page, limit);
  },

  async get(id: string) {
    const payroll = await payrollRepository.findById(id);
    if (!payroll) throw new NotFoundError('Payroll');
    return payroll;
  },

  /** Self-service: finalized payslips for the employee linked to this user. */
  async listMine(authUserId: string) {
    const employee = await Employee.findOne({ userId: authUserId }).select('_id').lean();
    if (!employee) return [];
    const { items } = await payrollRepository.paginate(
      { employeeId: String(employee._id) },
      1,
      120,
    );
    // Hide drafts — employees only see approved/paid payslips.
    const visible = items.filter((p) => p.status !== 'draft');

    // Attach the period label so the portal can show "Tháng …" without a
    // separate (role-gated) periods call.
    const periodIds = [...new Set(visible.map((p) => String(p.payrollPeriodId)))];
    const periods = await PayrollPeriod.find({ _id: { $in: periodIds } })
      .select('name')
      .lean();
    const nameById = new Map(periods.map((p) => [String(p._id), p.name]));
    return visible.map((p) => ({ ...p, periodName: nameById.get(String(p.payrollPeriodId)) ?? '' }));
  },

  /** Aggregated gross/net totals per status — for the period fund view. */
  totals(payrollPeriodId: string) {
    return payrollRepository.totalsForPeriod(payrollPeriodId);
  },
};
