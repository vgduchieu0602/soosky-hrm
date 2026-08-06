import ActiveContractNotFoundError from "@modules/payroll/core/app/errors/ActiveContractNotFoundError";
import AttendanceNotLockedError from "@modules/payroll/core/app/errors/AttendanceNotLockedError";
import EvaluationNotLockedError from "@modules/payroll/core/app/errors/EvaluationNotLockedError";
import EvaluationIncompleteError from "@modules/payroll/core/app/errors/EvaluationIncompleteError";
import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PayslipAlreadyFinalizedError from "@modules/payroll/core/app/errors/PayslipAlreadyFinalizedError";
import SalaryPolicyNotFoundError from "@modules/payroll/core/app/errors/SalaryPolicyNotFoundError";
import AllowanceRepo from "@modules/payroll/core/app/ports/AllowanceRepo";
import AttendanceDirectory from "@modules/payroll/core/app/ports/AttendanceDirectory";
import BonusRepo from "@modules/payroll/core/app/ports/BonusRepo";
import DeductionRepo from "@modules/payroll/core/app/ports/DeductionRepo";
import EmployeeDirectory from "@modules/payroll/core/app/ports/EmployeeDirectory";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import RetroAdjustmentRepo from "@modules/payroll/core/app/ports/RetroAdjustmentRepo";
import SalaryPolicyRepo from "@modules/payroll/core/app/ports/SalaryPolicyRepo";
import TaxProfileRepo from "@modules/payroll/core/app/ports/TaxProfileRepo";
import UnitOfWork from "@modules/payroll/core/app/ports/UnitOfWork";
import Allowance from "@modules/payroll/core/domain/entities/Allowance";
import Payslip from "@modules/payroll/core/domain/entities/Payslip";
import { EmployeeContractSegment } from "@modules/payroll/core/app/ports/EmployeeDirectory";
import { PayslipSegment } from "@modules/payroll/core/domain/entities/Payslip";
import { computeAttendanceRatio, computePayroll, EffectiveBaseSegmentInput, PAYROLL_ENGINE_VERSION, PayrollEngineVersion } from "@modules/payroll/core/domain/services/salary-calc";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "payroll:prepare";

/** Điểm hiệu suất/mục tiêu mặc định (thang 0-100) khi kỳ chưa có bản ghi đánh giá. */
const DEFAULT_EVALUATION_SCORE = 100;

export interface RunPayrollForEmployeeInput {
    periodId:    string;
    employeeId:  string;
    actorUserId: string;
    /** Bỏ trống = phiên bản đang dùng. Chỉ định để chạy song song đối soát. */
    engineVersion?: PayrollEngineVersion;
    /**
     * `true` = tính rồi TRẢ VỀ, không ghi gì (không lưu phiếu, không ghi người
     * lập). Dùng cho đối soát song song: chạy engine cũ trên cùng đầu vào để so
     * số, mà không được phép chạm vào bảng lương thật.
     */
    dryRun?: boolean;
}

/**
 * Tỷ trọng ngày lịch của [segFrom, segTo] trong [periodStart, periodEnd].
 *
 * Cộng cả hai đầu (inclusive) để hai đoạn liền kề nửa tháng cho ra tổng đúng 1:
 * 1–15 và 16–30 của tháng 30 ngày = 15/30 + 15/30.
 */
function calendarDayShare(segFrom: Date, segTo: Date, periodStart: Date, periodEnd: Date): number {
    const DAY = 86_400_000;
    const periodDays  = Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY) + 1;
    const segmentDays = Math.round((segTo.getTime() - segFrom.getTime()) / DAY) + 1;

    if (periodDays <= 0) return 0;
    return Math.min(1, Math.max(0, segmentDays / periodDays));
}

function sumAllowances(rows: Allowance[], contractBaseSalary: number): { taxable: number; nonTaxable: number; insuranceBase: number } {
    let taxable = 0;
    let nonTaxable = 0;
    let insuranceBase = 0;
    for (const a of rows) {
        const value = a.type === "percentage" ? (contractBaseSalary * a.amount) / 100 : a.amount;
        if (a.isTaxable) taxable += value; else nonTaxable += value;
        if (a.isInsuranceBase) insuranceBase += value;
    }
    return { taxable: Math.round(taxable), nonTaxable: Math.round(nonTaxable), insuranceBase: Math.round(insuranceBase) };
}

/**
 * Tính (hoặc tính lại) phiếu lương của MỘT nhân viên trong MỘT kỳ — ráp toàn
 * bộ đầu vào (hợp đồng, chính sách, ngày công, phụ cấp/thưởng/khấu trừ, hồ sơ
 * thuế) rồi chạy `computePayroll`. Idempotent: chỉ ghi đè phiếu `draft`; từ
 * chối tính lại phiếu đã `approved`/`paid`.
 *
 * ĐỔI HỢP ĐỒNG GIỮA KỲ: lương theo công được tách theo từng đoạn hợp đồng, mỗi
 * đoạn dùng lương cơ bản và tỷ lệ thử việc của chính nó, prorate theo số ngày
 * công thực tế thuộc đoạn đó. Bảo hiểm và thuế vẫn tính MỘT LẦN trên tổng tháng
 * (thuế luỹ tiến và trần BH là quy tắc theo tháng — xem `computePayroll`).
 *
 * TRUY VẾT: phiếu lưu bản chụp `inputs` gồm phiên bản công thức, id chính sách
 * lương, hồ sơ thuế, phụ cấp/thưởng/khấu trừ và hợp đồng đã dùng, cùng số lần
 * tính lại. Không có bản chụp thì sau này không tái lập được phép tính.
 *
 * Giản lược có chủ đích (xem payroll-report.md):
 *  - làm thêm giờ (OT) luôn = 0 (công ty tắt OT, không có nguồn giờ OT);
 *  - BHXH lấy đúng theo `taxProfile.insuranceAmount` (số cố định HR nhập, mặc
 *    định 0 nếu chưa tạo hồ sơ thuế) — PORT Y NGUYÊN quy tắc `payroll-run.usecases.ts`
 *    cũ: `fixedInsuranceAmount` luôn được truyền (không bao giờ `undefined`)
 *    nên nhánh %-theo-lương của `computeInsurance` không chạy trên đường tính
 *    lương thật (chỉ dùng trong gross-up và unit test thuần của `salary-calc`).
 *
 * @throws {AccessDeniedError}             Actor không có quyền `payroll:prepare`.
 * @throws {PayrollPeriodNotFoundError}    Không tìm thấy kỳ lương.
 * @throws {PayrollPeriodLockedError}      Kỳ đã `closed`/`paid`.
 * @throws {AttendanceNotLockedError}      Kỳ chưa chốt chấm công.
 * @throws {EvaluationNotLockedError}      Kỳ chưa chốt đánh giá.
 * @throws {PayslipAlreadyFinalizedError}  Phiếu đã `approved`/`paid`.
 * @throws {ActiveContractNotFoundError}   Nhân viên không có hợp đồng active.
 * @throws {SalaryPolicyNotFoundError}     Không có chính sách lương hiệu lực.
 */
export default class RunPayrollForEmployeeUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _uow: UnitOfWork,
        private readonly _employees: EmployeeDirectory,
        private readonly _attendance: AttendanceDirectory,
        private readonly _policies: SalaryPolicyRepo,
        private readonly _allowances: AllowanceRepo,
        private readonly _bonuses: BonusRepo,
        private readonly _deductions: DeductionRepo,
        private readonly _taxProfiles: TaxProfileRepo,
        private readonly _retros: RetroAdjustmentRepo,
    ) {}

    public async execute(input: RunPayrollForEmployeeInput): Promise<Payslip> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        return this._uow.run(async (ctx) => {
            const period = await ctx.periodRepo.getById(input.periodId);
            if (period == undefined) throw new PayrollPeriodNotFoundError();
            if (period.status === "closed" || period.status === "paid") {
                throw new PayrollPeriodLockedError(`Period ${period.name.value} is ${period.status}`);
            }
            // Ghi người LẬP ngay đầu lần chạy: mọi con số sắp ghi ra đều thuộc
            // trách nhiệm của người này, và người duyệt phải khác họ (bốn mắt).
            const dryRun = input.dryRun === true;
            const engineVersion = input.engineVersion ?? PAYROLL_ENGINE_VERSION;

            if (!dryRun) {
                period.markPrepared(input.actorUserId);
                await ctx.periodRepo.save(period);
            }

            if (period.attendanceLockedAt == null) throw new AttendanceNotLockedError(period.name.value);
            if (period.evaluationLockedAt == null) throw new EvaluationNotLockedError(period.name.value);

            const existing = dryRun ? undefined : await ctx.payslipRepo.findOne(input.periodId, input.employeeId);
            if (existing != undefined && existing.status !== "draft") {
                throw new PayslipAlreadyFinalizedError(existing.status);
            }

            const segments = await this._employees.contractSegments(input.employeeId, period.startDate, period.endDate);
            if (segments.length === 0) throw new ActiveContractNotFoundError(input.employeeId);

            // Hợp đồng "chủ" của kỳ = đoạn cuối cùng còn hiệu lực. Dùng cho những
            // con số theo THÁNG chứ không theo đoạn: nền BHXH đăng ký, phụ cấp
            // tính theo % lương, miễn BH khi thử việc/thực tập.
            const primary = segments[segments.length - 1] as EmployeeContractSegment;

            const policy = await this._policies.findEffectiveAt(period.payDate);
            if (policy == undefined) throw new SalaryPolicyNotFoundError();

            const summary = await this._attendance.getWorkdaySummary(input.employeeId, { from: period.startDate, to: period.endDate });
            const attendanceRatio = Math.min(1, computeAttendanceRatio(summary.actualWorkDays, period.standardWorkDays));

            // Module Đánh giá (Performance) chưa tồn tại nên chưa có đường nào ghi
            // điểm vào kỳ. Khớp với `EvaluationReadinessUseCase` (mọi nhân viên coi
            // như sẵn sàng): thiếu bản ghi → mặc định 100/100. Chỉ khi bản ghi TỒN
            // TẠI mà điểm dở dang mới coi là lỗi — lúc đó ai đó đã nhập nửa chừng.
            const evaluation = period.getEvaluation(input.employeeId);
            if (evaluation != undefined && (evaluation.performanceScore == null || evaluation.goalScore == null)) {
                throw new EvaluationIncompleteError(input.employeeId);
            }
            const performanceRatio = evaluation?.performanceScore ?? DEFAULT_EVALUATION_SCORE;
            const goalRatio = evaluation?.goalScore ?? DEFAULT_EVALUATION_SCORE;

            const isExempt = primary.employmentStatus === "probation" || primary.employmentStatus === "internship";

            // Ngày công của TỪNG đoạn, lấy đúng từ chấm công trong biên đoạn đó.
            const payslipSegments: PayslipSegment[] = [];
            const calcSegments: EffectiveBaseSegmentInput[] = [];
            for (const segment of segments) {
                const segmentSummary = await this._attendance.getWorkdaySummary(
                    input.employeeId, { from: segment.from, to: segment.to },
                );
                const segmentEffectiveBase = segment.employmentStatus === "probation"
                    ? Math.round(segment.baseSalary * (policy.probationPayRate / 100))
                    : segment.baseSalary;
                const segmentRatio = Math.min(1, computeAttendanceRatio(segmentSummary.actualWorkDays, period.standardWorkDays));

                // Tỷ trọng thời gian của đoạn, tính theo NGÀY LỊCH của đoạn trên
                // ngày lịch của kỳ. Dùng ngày lịch (không phải ngày công) vì đây
                // là phần "không cắt theo chuyên cần": nửa tháng hợp đồng cũ thì
                // hưởng nửa phần hiệu suất/mục tiêu, bất kể đi làm bao nhiêu ngày.
                const segmentShare = calendarDayShare(segment.from, segment.to, period.startDate, period.endDate);

                calcSegments.push({
                    baseSalary:      segmentEffectiveBase,
                    attendanceRatio: segmentRatio,
                    periodShare:     segmentShare,
                });
                payslipSegments.push({
                    contractId:         segment.contractId,
                    contractNumber:     segment.contractNumber,
                    employmentStatus:   segment.employmentStatus,
                    from:               segment.from,
                    to:                 segment.to,
                    workDays:           segmentSummary.actualWorkDays,
                    baseSalary:         segment.baseSalary,
                    effectiveBase:      segmentEffectiveBase,
                    attendanceRatio:    segmentRatio,
                    proRatedBaseSalary: 0,   // điền lại sau khi computePayroll xong
                });
            }

            const effectiveBase = primary.employmentStatus === "probation"
                ? Math.round(primary.baseSalary * (policy.probationPayRate / 100))
                : primary.baseSalary;

            const allowanceRows = (await this._allowances.listByEmployeeId(input.employeeId))
                .filter(a => a.isActiveAt(period.payDate));
            const allowances = sumAllowances(allowanceRows, primary.baseSalary);

            const bonusRows = await this._bonuses.listForPeriod(input.employeeId, input.periodId);
            const totalBonuses = Math.round(bonusRows.reduce((s, b) => s + b.amount, 0));
            const totalNonTaxableBonuses = Math.round(bonusRows.filter(b => !b.isTaxable).reduce((s, b) => s + b.amount, 0));

            const deductionRows = await this._deductions.listApplicableForPeriod(
                input.employeeId, input.periodId, period.startDate, period.endDate,
            );
            const deductions = deductionRows.map(d => ({ type: d.type, amount: d.amount }));

            // Hồi tố: truy lĩnh cộng vào gross kỳ NÀY (thu nhập chịu thuế theo kỳ nhận
            // tiền), truy thu khấu trừ SAU thuế (kỳ gốc đã nộp thuế trên số đó).
            const retroRows = await this._retros.listActiveForPayout(input.employeeId, input.periodId);
            const claims    = retroRows.filter(row => row.kind === "claim");
            const clawbacks = retroRows.filter(row => row.kind === "clawback");
            const totalRetroClaims           = claims.reduce((sum, row) => sum + row.amount, 0);
            const totalNonTaxableRetroClaims = claims.filter(row => !row.taxable).reduce((sum, row) => sum + row.amount, 0);
            const totalRetroClawbacks        = clawbacks.reduce((sum, row) => sum + row.amount, 0);

            const taxProfile = await this._taxProfiles.findEffectiveAt(input.employeeId, period.payDate);

            const fixedInsuranceSalary = policy.socialInsuranceSalary || primary.baseSalary;
            const unionFee = !isExempt && policy.unionFeeEnabled
                ? Math.round((fixedInsuranceSalary * policy.unionFeeRate) / 100)
                : 0;

            const breakdown = computePayroll({
                baseSalary: effectiveBase,
                segments:   calcSegments,
                attendanceRatio, performanceRatio, goalRatio,
                weights: policy.salaryComponentWeights,
                prorateByAttendance: policy.prorateByAttendance,
                totalTaxableAllowances: allowances.taxable,
                totalNonTaxableAllowances: allowances.nonTaxable,
                insuranceBaseSalary: isExempt ? 0 : fixedInsuranceSalary,
                insuranceBaseAllowances: isExempt ? 0 : allowances.insuranceBase,
                fixedInsuranceAmount: isExempt ? 0 : (taxProfile?.insuranceAmount ?? 0),
                taxEnabled: policy.taxEnabled,
                unionFee,
                deductions,
                overtimePay: 0,
                overtimeNonTaxablePay: 0,
                totalBonuses,
                totalNonTaxableBonuses,
                totalRetroClaims,
                totalNonTaxableRetroClaims,
                totalRetroClawbacks,
                socialHealthCeiling: policy.socialHealthCeiling,
                unemploymentCeiling: policy.unemploymentCeiling,
                personalDeduction: policy.personalDeduction,
                dependentDeduction: policy.dependentDeduction,
                dependentsCount: taxProfile?.dependentsCount ?? 0,
                taxBrackets: policy.taxBrackets,
                isResident: taxProfile?.isResident ?? true,
                nonResidentTaxRate: policy.nonResidentTaxRate,
                insuranceRates: policy.insuranceRates,
            }, engineVersion);

            const workdays = {
                standardWorkDays: period.standardWorkDays,
                actualWorkDays: summary.actualWorkDays,
                unpaidDays: summary.unpaidDays,
            };

            // Điền phần lương theo công của từng đoạn — tính lại bằng ĐÚNG hàm mà
            // `computePayroll` dùng, nên tổng các đoạn luôn khớp `proRatedBaseSalary`
            // của phiếu, không phải con số ước lượng để hiển thị.
            for (const [index, segment] of payslipSegments.entries()) {
                const one = computePayroll({
                    baseSalary:          segment.effectiveBase,
                    attendanceRatio:     segment.attendanceRatio,
                    performanceRatio,
                    goalRatio,
                    weights:             policy.salaryComponentWeights,
                    prorateByAttendance: policy.prorateByAttendance,
                    segments:            [calcSegments[index] as EffectiveBaseSegmentInput],
                    socialHealthCeiling: policy.socialHealthCeiling,
                    unemploymentCeiling: policy.unemploymentCeiling,
                    personalDeduction:   policy.personalDeduction,
                    dependentDeduction:  policy.dependentDeduction,
                    fixedInsuranceAmount: 0,
                    taxEnabled:          false,
                }, engineVersion);
                payslipSegments[index] = { ...segment, proRatedBaseSalary: one.proRatedBaseSalary };
            }

            const inputs = {
                engineVersion,
                salaryPolicyId: policy.id,
                taxProfileId:   taxProfile?.id ?? null,
                allowanceIds:   allowanceRows.map(row => row.id),
                bonusIds:       bonusRows.map(row => row.id),
                deductionIds:   deductionRows.map(row => row.id),
                contractIds:    segments.map(segment => segment.contractId),
                retroIds:       retroRows.map(row => row.id),
                computedBy:     input.actorUserId,
                // Phiếu mới = lần tính đầu; `recompute` tự cộng dồn số cũ.
                recomputeCount: 0,
            };

            let payslip: Payslip;
            if (existing != undefined) {
                existing.recompute({
                    workdays, attendanceRatio, performanceRatio, goalRatio, breakdown,
                    segments: payslipSegments, inputs,
                });
                payslip = existing;
            } else {
                payslip = Payslip.compute({
                    id: createUuidV7(),
                    payrollPeriodId: input.periodId,
                    employeeId: input.employeeId,
                    workdays, attendanceRatio, performanceRatio, goalRatio, breakdown,
                    segments: payslipSegments, inputs,
                });
            }

            // Dry-run: phiếu chỉ là vật chứa kết quả để so sánh, không được lưu.
            if (!dryRun) await ctx.payslipRepo.save(payslip);
            return payslip;
        });
    }
}
