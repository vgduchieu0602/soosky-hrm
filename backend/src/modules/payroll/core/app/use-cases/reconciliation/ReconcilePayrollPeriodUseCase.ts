import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayrollVarianceRepo from "@modules/payroll/core/app/ports/PayrollVarianceRepo";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import RunPayrollForEmployeeUseCase from "@modules/payroll/core/app/use-cases/payroll/RunPayrollForEmployeeUseCase";
import PayrollVariance, { VarianceField } from "@modules/payroll/core/domain/entities/PayrollVariance";
import { ComputePayrollResult, PAYROLL_ENGINE_VERSION, PayrollEngineVersion } from "@modules/payroll/core/domain/services/salary-calc";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "payroll:prepare";

const BASELINE_ENGINE: PayrollEngineVersion = "v1";

/**
 * Những con số được đối soát. Cố tình KHÔNG so cả `breakdown`: một chênh lệch
 * duy nhất ở lương theo công sẽ kéo theo hàng chục ô lệch phái sinh và làm ngập
 * bảng đối soát. Sáu con số này là thứ kế toán thật sự đối chiếu.
 */
const COMPARED_FIELDS = [
    "proRatedBaseSalary", "grossSalary", "insurance", "tax", "totalDeductions", "netSalary",
] as const satisfies readonly (keyof ComputePayrollResult)[];

export interface ReconcilePayrollPeriodOutput {
    periodId:        string;
    baselineEngine:  PayrollEngineVersion;
    targetEngine:    PayrollEngineVersion;
    comparedCount:   number;
    varianceCount:   number;
    unsignedCount:   number;
    /** Nhân viên không tính được bằng engine cũ (thiếu hợp đồng, …) — nêu rõ, không bỏ im. */
    errors:          { employeeId: string; message: string }[];
}

/**
 * CHẠY SONG SONG hai phiên bản công thức trên cùng một kỳ.
 *
 * Phiếu lương thật đã tính bằng engine hiện hành (`v2`). Use-case này tính lại
 * từng nhân viên bằng engine cũ (`v1`) ở chế độ dry-run — không ghi phiếu, không
 * ghi người lập — rồi lưu mọi chênh lệch thành bản ghi cần giải thích + ký.
 *
 * Chạy lại được nhiều lần: chênh lệch đã hết thì bản ghi bị xoá; số đổi thì chữ
 * ký cũ mất hiệu lực (xem `PayrollVariance.redetect`).
 *
 * @throws {AccessDeniedError}          Actor không có quyền `payroll:prepare`.
 * @throws {PayrollPeriodNotFoundError} Không tìm thấy kỳ lương.
 */
export default class ReconcilePayrollPeriodUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _payslips: PayslipRepo,
        private readonly _variances: PayrollVarianceRepo,
        private readonly _run: RunPayrollForEmployeeUseCase,
    ) {}

    public async execute(input: { periodId: string; actorUserId: string }): Promise<ReconcilePayrollPeriodOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();

        const payslips = await this._payslips.listByPeriod(input.periodId);
        const errors: { employeeId: string; message: string }[] = [];
        let varianceCount = 0;

        for (const payslip of payslips) {
            let baseline: ComputePayrollResult;
            try {
                const shadow = await this._run.execute({
                    periodId:      input.periodId,
                    employeeId:    payslip.employeeId,
                    actorUserId:   input.actorUserId,
                    engineVersion: BASELINE_ENGINE,
                    dryRun:        true,
                });
                baseline = shadow.breakdown;
            } catch (error) {
                errors.push({ employeeId: payslip.employeeId, message: (error as Error).message });
                continue;
            }

            const fields = diffFields(baseline, payslip.breakdown);
            if (fields.length === 0) {
                // Hai engine khớp: không để lại bản ghi cũ làm cổng chặn vô cớ.
                await this._variances.deleteOne(input.periodId, payslip.employeeId);
                continue;
            }

            varianceCount += 1;
            const existing = await this._variances.findOne(input.periodId, payslip.employeeId);
            if (existing != undefined) {
                existing.redetect({
                    baselineNet: baseline.netSalary,
                    targetNet:   payslip.breakdown.netSalary,
                    fields,
                    detectedBy:  input.actorUserId,
                });
                await this._variances.save(existing);
                continue;
            }

            await this._variances.save(PayrollVariance.detect({
                id:              createUuidV7(),
                payrollPeriodId: input.periodId,
                employeeId:      payslip.employeeId,
                baselineEngine:  BASELINE_ENGINE,
                targetEngine:    PAYROLL_ENGINE_VERSION,
                baselineNet:     baseline.netSalary,
                targetNet:       payslip.breakdown.netSalary,
                fields,
                detectedBy:      input.actorUserId,
            }));
        }

        return {
            periodId:       input.periodId,
            baselineEngine: BASELINE_ENGINE,
            targetEngine:   PAYROLL_ENGINE_VERSION,
            comparedCount:  payslips.length,
            varianceCount,
            unsignedCount:  await this._variances.countUnsigned(input.periodId),
            errors,
        };
    }
}

function diffFields(baseline: ComputePayrollResult, target: ComputePayrollResult): VarianceField[] {
    const out: VarianceField[] = [];
    for (const field of COMPARED_FIELDS) {
        if (baseline[field] !== target[field]) {
            out.push({ field, baseline: baseline[field], target: target[field] });
        }
    }
    return out;
}
