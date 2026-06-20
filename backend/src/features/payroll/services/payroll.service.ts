import { NotFoundError } from '@shared/errors/not-found.error';
import { Employee } from '@shared/models/employee.model';
import { PayrollPeriod } from '@shared/models/payroll-period.model';
import { payrollRepository, type ListPayrollFilter } from '@features/payroll/repositories/payroll.repository';

export const payrollService = {
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
