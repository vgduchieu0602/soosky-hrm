import mongoose from 'mongoose';
import { NotFoundError } from '@shared/errors/not-found.error';
import { ForbiddenError } from '@shared/errors/forbidden.error';
import { Employee } from '@shared/models/employee.model';
import { Payroll } from '@shared/models/payroll.model';
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

  /** Export one period's payrolls (all employees) as a styled .xlsx for accounting. */
  async exportPeriodXlsx(payrollPeriodId: string): Promise<Buffer> {
    const period = await PayrollPeriod.findById(payrollPeriodId).lean();
    const rows = await Payroll.aggregate([
      { $match: { payrollPeriodId: new mongoose.Types.ObjectId(payrollPeriodId) } },
      { $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'emp' } },
      { $unwind: { path: '$emp', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'employeeProfiles', localField: 'employeeId', foreignField: 'employeeId', as: 'profile' } },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'departments', localField: 'emp.departmentId', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      { $sort: { 'emp.employeeCode': 1 } },
    ]);

    const STATUS_LABEL: Record<string, string> = { draft: 'Nháp', approved: 'Đã duyệt', paid: 'Đã chi' };
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Soosky HRM';
    const ws = wb.addWorksheet(`Bảng lương ${period?.name ?? ''}`.trim(), { views: [{ state: 'frozen', ySplit: 1 }] });
    const money = '#,##0';
    ws.columns = [
      { header: 'Mã NV', key: 'code', width: 14 },
      { header: 'Họ và tên', key: 'name', width: 24 },
      { header: 'Phòng ban', key: 'dept', width: 20 },
      { header: 'Ngày công', key: 'days', width: 12 },
      { header: 'Lương cơ bản', key: 'base', width: 15, style: { numFmt: money } },
      { header: 'Lương theo công', key: 'prorated', width: 16, style: { numFmt: money } },
      { header: 'Phụ cấp', key: 'allow', width: 14, style: { numFmt: money } },
      { header: 'Thưởng', key: 'bonus', width: 14, style: { numFmt: money } },
      { header: 'Tổng thu nhập (Gross)', key: 'gross', width: 18, style: { numFmt: money } },
      { header: 'BHXH (NLĐ)', key: 'insurance', width: 14, style: { numFmt: money } },
      { header: 'Thuế TNCN', key: 'tax', width: 14, style: { numFmt: money } },
      { header: 'Đoàn phí', key: 'union', width: 12, style: { numFmt: money } },
      { header: 'Khấu trừ khác', key: 'other', width: 15, style: { numFmt: money } },
      { header: 'Thực nhận (Net)', key: 'net', width: 16, style: { numFmt: money } },
      { header: 'Trạng thái', key: 'status', width: 12 },
    ];
    for (const r of rows as Record<string, any>[]) {
      const fullName = [r.profile?.lastName, r.profile?.middleName, r.profile?.firstName].filter(Boolean).join(' ');
      ws.addRow({
        code: r.emp?.employeeCode ?? '',
        name: fullName || r.emp?.employeeCode || '',
        dept: r.dept?.name ?? '',
        days: `${r.actualWorkDays ?? 0}/${r.standardWorkDays ?? 0}`,
        base: toNum(r.baseSalary), prorated: toNum(r.proRatedBaseSalary),
        allow: toNum(r.totalAllowances), bonus: toNum(r.totalBonuses),
        gross: toNum(r.grossSalary), insurance: toNum(r.insurance), tax: toNum(r.tax),
        union: toNum(r.unionFee), other: toNum(r.otherDeductions), net: toNum(r.netSalary),
        status: STATUS_LABEL[r.status] ?? r.status,
      });
    }
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A74' } };
    header.alignment = { vertical: 'middle', wrapText: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 15 } };
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  },

  /**
   * Fetch one payroll. Defense-in-depth: a non-HR caller may only read their own
   * payslip (in addition to the route's hrOrAdmin gate), so a leaked/relaxed
   * route can never expose another employee's salary.
   */
  async get(id: string, viewer?: { userId: string; isHrOrAdmin: boolean }) {
    const payroll = await payrollRepository.findById(id);
    if (!payroll) throw new NotFoundError('Payroll');
    if (viewer && !viewer.isHrOrAdmin) {
      const me = await Employee.findOne({ userId: viewer.userId }).select('_id').lean();
      if (!me || String(me._id) !== String(payroll.employeeId)) throw new ForbiddenError();
    }
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
