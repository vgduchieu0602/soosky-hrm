import ActiveContractNotFoundError from "@modules/payroll/core/app/errors/ActiveContractNotFoundError";
import AttendanceNotLockedError from "@modules/payroll/core/app/errors/AttendanceNotLockedError";
import EvaluationNotLockedError from "@modules/payroll/core/app/errors/EvaluationNotLockedError";
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
import SalaryPolicyRepo from "@modules/payroll/core/app/ports/SalaryPolicyRepo";
import TaxProfileRepo from "@modules/payroll/core/app/ports/TaxProfileRepo";
import UnitOfWork from "@modules/payroll/core/app/ports/UnitOfWork";
import Allowance from "@modules/payroll/core/domain/entities/Allowance";
import Payslip from "@modules/payroll/core/domain/entities/Payslip";
import { computeAttendanceRatio, computePayroll } from "@modules/payroll/core/domain/services/salary-calc";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "payroll:manage";

export interface RunPayrollForEmployeeInput {
    periodId:    string;
    employeeId:  string;
    actorUserId: string;
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
 * Giản lược có chủ đích (xem payroll-report.md):
 *  - MỘT hợp đồng active cho cả kỳ (không tách dòng khi đổi hợp đồng giữa tháng);
 *  - `performanceRatio`/`goalRatio` = 100/100 cố định (chưa có module Đánh giá);
 *  - làm thêm giờ (OT) luôn = 0 (công ty tắt OT, không có nguồn giờ OT);
 *  - BHXH lấy đúng theo `taxProfile.insuranceAmount` (số cố định HR nhập, mặc
 *    định 0 nếu chưa tạo hồ sơ thuế) — PORT Y NGUYÊN quy tắc `payroll-run.usecases.ts`
 *    cũ: `fixedInsuranceAmount` luôn được truyền (không bao giờ `undefined`)
 *    nên nhánh %-theo-lương của `computeInsurance` không chạy trên đường tính
 *    lương thật (chỉ dùng trong gross-up và unit test thuần của `salary-calc`).
 *
 * @throws {AccessDeniedError}             Actor không có quyền `payroll:manage`.
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
    ) {}

    public async execute(input: RunPayrollForEmployeeInput): Promise<Payslip> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        return this._uow.run(async (ctx) => {
            const period = await ctx.periodRepo.getById(input.periodId);
            if (period == undefined) throw new PayrollPeriodNotFoundError();
            if (period.status === "closed" || period.status === "paid") {
                throw new PayrollPeriodLockedError(`Period ${period.name.value} is ${period.status}`);
            }
            if (period.attendanceLockedAt == null) throw new AttendanceNotLockedError(period.name.value);
            if (period.evaluationLockedAt == null) throw new EvaluationNotLockedError(period.name.value);

            const existing = await ctx.payslipRepo.findOne(input.periodId, input.employeeId);
            if (existing != undefined && existing.status !== "draft") {
                throw new PayslipAlreadyFinalizedError(existing.status);
            }

            const contract = await this._employees.contractBasis(input.employeeId, period.payDate);
            if (contract == undefined) throw new ActiveContractNotFoundError(input.employeeId);

            const policy = await this._policies.findEffectiveAt(period.payDate);
            if (policy == undefined) throw new SalaryPolicyNotFoundError();

            const summary = await this._attendance.getWorkdaySummary(input.employeeId, { from: period.startDate, to: period.endDate });
            const attendanceRatio = Math.min(1, computeAttendanceRatio(summary.actualWorkDays, period.standardWorkDays));

            // Chưa có module Đánh giá (Performance) trong codebase mới — dùng đủ
            // điểm 100/100 cho mọi nhân viên (xem payroll-report.md). Công thức
            // 20/60/20 vẫn chạy nguyên vẹn; chỉ nguồn điểm là placeholder.
            const performanceRatio = 100;
            const goalRatio = 100;

            const isProbation = contract.employmentStatus === "probation";
            const isExempt = isProbation || contract.employmentStatus === "internship";
            const effectiveBase = isProbation
                ? Math.round(contract.baseSalary * (policy.probationPayRate / 100))
                : contract.baseSalary;

            const allowanceRows = (await this._allowances.listByEmployeeId(input.employeeId))
                .filter(a => a.isActiveAt(period.payDate));
            const allowances = sumAllowances(allowanceRows, contract.baseSalary);

            const bonusRows = await this._bonuses.listForPeriod(input.employeeId, input.periodId);
            const totalBonuses = Math.round(bonusRows.reduce((s, b) => s + b.amount, 0));
            const totalNonTaxableBonuses = Math.round(bonusRows.filter(b => !b.isTaxable).reduce((s, b) => s + b.amount, 0));

            const deductionRows = await this._deductions.listApplicableForPeriod(
                input.employeeId, input.periodId, period.startDate, period.endDate,
            );
            const deductions = deductionRows.map(d => ({ type: d.type, amount: d.amount }));

            const taxProfile = await this._taxProfiles.findEffectiveAt(input.employeeId, period.payDate);

            const fixedInsuranceSalary = policy.socialInsuranceSalary || contract.baseSalary;
            const unionFee = !isExempt && policy.unionFeeEnabled
                ? Math.round((fixedInsuranceSalary * policy.unionFeeRate) / 100)
                : 0;

            const breakdown = computePayroll({
                baseSalary: effectiveBase,
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
                socialHealthCeiling: policy.socialHealthCeiling,
                unemploymentCeiling: policy.unemploymentCeiling,
                personalDeduction: policy.personalDeduction,
                dependentDeduction: policy.dependentDeduction,
                dependentsCount: taxProfile?.dependentsCount ?? 0,
                taxBrackets: policy.taxBrackets,
                isResident: taxProfile?.isResident ?? true,
                nonResidentTaxRate: policy.nonResidentTaxRate,
                insuranceRates: policy.insuranceRates,
            });

            const workdays = {
                standardWorkDays: period.standardWorkDays,
                actualWorkDays: summary.actualWorkDays,
                unpaidDays: summary.unpaidDays,
            };

            let payslip: Payslip;
            if (existing != undefined) {
                existing.recompute({ workdays, attendanceRatio, performanceRatio, goalRatio, breakdown });
                payslip = existing;
            } else {
                payslip = Payslip.compute({
                    id: UUIDv7(),
                    payrollPeriodId: input.periodId,
                    employeeId: input.employeeId,
                    workdays, attendanceRatio, performanceRatio, goalRatio, breakdown,
                });
            }

            await ctx.payslipRepo.save(payslip);
            return payslip;
        });
    }
}
