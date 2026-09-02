import { NotFoundError } from '@shared/errors/not-found.error';
import { ForbiddenError } from '@shared/errors/forbidden.error';
import {
  buildContractSegments,
  describeGap,
  describeOverlap,
  effectivePayrollRange,
} from '@features/payroll/domain/contract-segment';
import {
  grossUpFromNet,
  type TaxBracket,
  type InsuranceRates,
  type GrossUpResult,
} from '@shared/utils/salary.util';
import type {
  PayrollRepository,
  SalaryPolicyGateway,
  EmployeeGateway,
  ContractGateway,
  EvaluationGateway,
  AttendanceGateway,
  TaxProfileRepository,
  EmployeeProfileGateway,
  ListPayrollFilter,
  Id,
  Clock,
} from '@features/payroll/domain/ports';
import type { PeriodReader, PeriodLifecycle } from '@features/period/domain/ports';
import type { GrossUpDto } from '@features/payroll/dto/gross-up.dto';

type Decimalish = { toString(): string } | number | null | undefined;
const toNum = (d: Decimalish): number => (d == null ? 0 : Number(d.toString()));

/**
 * One row of `PayrollRepository.exportRows` as the spreadsheet needs it. The
 * port returns plain documents, so the shape is spelled out here — only the
 * fields this export actually reads.
 */
interface PayrollExportRow {
  emp?: { employeeCode?: string };
  profile?: { firstName?: string; middleName?: string; lastName?: string };
  dept?: { name?: string };
  actualWorkDays?: number;
  standardWorkDays?: number;
  baseSalary?: Decimalish;
  proRatedBaseSalary?: Decimalish;
  totalAllowances?: Decimalish;
  totalBonuses?: Decimalish;
  grossSalary?: Decimalish;
  insurance?: Decimalish;
  tax?: Decimalish;
  unionFee?: Decimalish;
  otherDeductions?: Decimalish;
  netSalary?: Decimalish;
  status?: string;
}

export class PayrollUseCases {
  constructor(
    private readonly payrolls: PayrollRepository,
    private readonly periodReader: PeriodReader,
  private readonly periodLifecycle: PeriodLifecycle,
    private readonly policies: SalaryPolicyGateway,
    private readonly employees: EmployeeGateway,
    private readonly contracts: ContractGateway,
    private readonly evaluations: EvaluationGateway,
    private readonly attendance: AttendanceGateway,
    private readonly taxProfiles: TaxProfileRepository,
    private readonly profiles: EmployeeProfileGateway,
    private readonly clock: Clock,
  ) {}

  /**
   * NET → GROSS gross-up using the salary policy effective at `payDate`.
   * Reuses the same insurance/tax engine as payroll so results are consistent.
   */
  async grossUp(input: GrossUpDto): Promise<GrossUpResult> {
    const payDate = input.payDate ?? new Date();
    const policy = await this.policies.effectiveAt(payDate);
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
  }

  async paginate(filter: ListPayrollFilter, page: number, limit: number) {
    return this.payrolls.paginate(filter, page, limit);
  }

  /**
   * Pre-run check: for each active employee, flag what would BLOCK payroll
   * (no active contract / no approved evaluation) and what would silently use
   * defaults (no tax profile). Also flags a policy-level config gap.
   */
  async preflight(periodId: Id) {
    const period = await this.periodReader.findById(periodId);
    if (!period) throw new NotFoundError('Payroll period');
    const policy = await this.policies.effectiveAt(period.payDate);

    const employees = await this.employees.listNonTerminatedWithCode();
    const ids = employees.map((e) => String(e._id));

    const [contractIds, evalIds, taxIds, profiles, contractsByEmployee] = await Promise.all([
      this.contracts.activeEmployeeIds(ids),
      this.evaluations.finalizedEmployeeIds(periodId),
      this.taxProfiles.employeeIdsEffective(ids, period.payDate),
      this.profiles.namesFor(ids),
      // Một truy vấn cho toàn bộ nhân viên — phát hiện hợp đồng chồng/thủng
      // TRƯỚC khi HR bấm tính lương, thay vì để cả mẻ chạy rồi mới báo lỗi.
      this.contracts.findOverlappingForMany(ids, period.startDate, period.endDate),
    ]);
    const hasContract = new Set(contractIds);
    const hasEval = new Set(evalIds);
    const hasTax = new Set(taxIds);
    const nameOf = new Map(
      profiles.map((p) => [String(p.employeeId), [p.lastName, p.middleName, p.firstName].filter(Boolean).join(' ')]),
    );

    const items = employees.map((e) => {
      const id = String(e._id);
      const blockers: string[] = [];
      const blockerCodes: { code: string; message: string }[] = [];
      const warnings: string[] = [];

      const addBlocker = (code: string, message: string) => {
        blockers.push(message);
        blockerCodes.push({ code, message });
      };

      // Chỉ soi phần kỳ mà người này thực sự là nhân viên — giống hệt engine, nên
      // preflight không thể lệch kết luận so với lúc chạy thật.
      const scope = effectivePayrollRange(period, {
        from: e.hireDate,
        to: e.terminationDate ?? null,
      });

      // Không thuộc kỳ (vào làm sau kỳ / đã nghỉ trước kỳ) thì không có gì để
      // cảnh báo — người này sẽ không có dòng lương nào cả.
      if (!scope) {
        return {
          employeeId: id,
          employeeCode: e.employeeCode,
          fullName: nameOf.get(id) || e.employeeCode,
          inPeriod: false,
          blockers,
          blockerCodes,
          warnings,
        };
      }

      const contracts = contractsByEmployee.get(id) ?? [];
      // Xét hợp đồng phủ PHẠM VI của kỳ, không xét `status` hiện tại: người đã
      // nghỉ vẫn có hợp đồng hợp lệ cho kỳ quá khứ.
      if (contracts.length === 0 && !hasContract.has(id)) {
        addBlocker('PAY_CONTRACT_MISSING', 'Chưa có hợp đồng phủ kỳ này');
      }
      if (!hasEval.has(id)) addBlocker('PAY_EVAL_REQUIRED', 'Chưa có đánh giá được duyệt cho kỳ này');

      const { overlaps, gaps } = buildContractSegments(
        contracts.map((c) => ({
          contractId: String((c as { _id: unknown })._id),
          startDate: c.startDate,
          endDate: c.endDate ?? null,
          employmentStatus: c.employmentStatus,
          baseSalary: 0,
        })),
        scope,
      );
      for (const overlap of overlaps) {
        addBlocker('PAY_CONTRACT_OVERLAP', describeOverlap(overlap));
      }
      // Preflight không tra lịch làm việc từng người (sẽ thành N+1); khoảng trống
      // giữa hai hợp đồng báo ở mức CẢNH BÁO, engine mới là nơi chặn thật sau khi
      // đã kiểm tra khoảng đó có ngày công hay không.
      for (const gap of gaps) {
        warnings.push(`${describeGap(gap)} — sẽ bị chặn nếu khoảng này có ngày công`);
      }

      if (!hasTax.has(id)) warnings.push('Chưa có hồ sơ thuế (dùng mặc định: 0 phụ thuộc, cư trú)');
      return {
        employeeId: id,
        employeeCode: e.employeeCode,
        fullName: nameOf.get(id) || e.employeeCode,
        inPeriod: true,
        blockers,
        blockerCodes,
        warnings,
      };
    });

    // Người không thuộc kỳ không được tính vào tổng "sẵn sàng / bị chặn".
    const inPeriod = items.filter((i) => i.inPeriod);
    const blocked = inPeriod.filter((i) => i.blockers.length > 0);
    const inPeriodIds = new Set(inPeriod.map((item) => item.employeeId));
    const attendanceRows = await this.attendance.listStatusesInRange(period.startDate, period.endDate);
    const attendanceEmployeeIds = new Set(
      attendanceRows.filter((row) => inPeriodIds.has(String(row.employeeId))).map((row) => String(row.employeeId)),
    );
    const attendanceMissing = inPeriod.filter((item) => !attendanceEmployeeIds.has(item.employeeId)).length;
    const attendanceIncomplete = attendanceRows.filter(
      (row) => inPeriodIds.has(String(row.employeeId)) && row.status === 'incomplete',
    ).length;
    const attendanceReady = attendanceMissing === 0 && attendanceIncomplete === 0;
    const performancePending = inPeriod.filter((item) =>
      item.blockerCodes.some((blocker) => blocker.code === 'PAY_EVAL_REQUIRED'),
    ).length;
    const performanceReady = performancePending === 0;
    const closingBlockers = [
      ...(!period.attendanceLockedAt ? [{ code: 'PAY_ATTENDANCE_NOT_LOCKED', message: 'Chưa chốt chấm công' }] : []),
      ...(!period.performanceLockedAt ? [{ code: 'PAY_PERFORMANCE_NOT_LOCKED', message: 'Chưa chốt đánh giá' }] : []),
      ...(!attendanceReady ? [{ code: 'PAY_ATTENDANCE_NOT_READY', message: 'Chấm công chưa sẵn sàng' }] : []),
      ...(!performanceReady ? [{ code: 'PAY_PERFORMANCE_NOT_READY', message: 'Đánh giá chưa sẵn sàng' }] : []),
    ];
    const policyWarnings: string[] = [];
    if (!policy) policyWarnings.push('Chưa có chính sách lương hiệu lực — không thể tính lương.');
    else if (!policy.socialInsuranceSalary) policyWarnings.push('Chưa đặt "Mức lương đóng BHXH" — nền BH sẽ lấy theo lương hợp đồng.');

    return {
      total: inPeriod.length,
      ready: inPeriod.length - blocked.length,
      blockedCount: blocked.length,
      policyWarnings,
      items: items.filter((i) => i.blockers.length || i.warnings.length),
      attendance: { locked: !!period.attendanceLockedAt, ready: attendanceReady },
      performance: { locked: !!period.performanceLockedAt, ready: performanceReady },
      payroll: { canRun: closingBlockers.length === 0 && blocked.length === 0 },
      blockers: closingBlockers,
    };
  }

  /** Export one period's payrolls (all employees) as a styled .xlsx for accounting. */
  async exportPeriodXlsx(payrollPeriodId: Id): Promise<Buffer> {
    const period = await this.periodReader.findById(payrollPeriodId);
    const rows = await this.payrolls.exportRows(payrollPeriodId);

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
    for (const r of rows as PayrollExportRow[]) {
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
        status: STATUS_LABEL[r.status ?? ''] ?? r.status,
      });
    }
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A74' } };
    header.alignment = { vertical: 'middle', wrapText: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 15 } };
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  /**
   * Fetch one payroll. Defense-in-depth: a non-HR caller may only read their own
   * payslip (in addition to the route's hrOrAdmin gate), so a leaked/relaxed
   * route can never expose another employee's salary.
   */
  async get(id: Id, viewer?: { userId: string; isHrOrAdmin: boolean }) {
    const payroll = await this.payrolls.findById(id);
    if (!payroll) throw new NotFoundError('Payroll');
    if (viewer && !viewer.isHrOrAdmin) {
      const me = await this.employees.findByUserId(viewer.userId);
      if (!me || String(me._id) !== String(payroll.employeeId)) throw new ForbiddenError();
    }
    return payroll;
  }

  /** Self-service: finalized payslips for the employee linked to this user. */
  async listMine(authUserId: Id) {
    const employee = await this.employees.findByUserId(authUserId);
    if (!employee) return [];
    const { items } = await this.payrolls.paginate({ employeeId: String(employee._id) }, 1, 120);
    // Hide drafts — employees only see approved/paid payslips.
    const visible = items.filter((p) => p.status !== 'draft');

    // Attach the period label so the portal can show "Tháng …" without a
    // separate (role-gated) periods call.
    const periodIds = [...new Set(visible.map((p) => String(p.payrollPeriodId)))];
    const periods = await this.periodReader.namesByIds(periodIds);
    const nameById = new Map(periods.map((p) => [String(p._id), p.name]));
    return visible.map((p) => ({ ...p, periodName: nameById.get(String(p.payrollPeriodId)) ?? '' }));
  }

  /** Aggregated gross/net totals per status — for the period fund view. */
  totals(payrollPeriodId: Id) {
    return this.payrolls.totalsForPeriod(payrollPeriodId);
  }
}
