import VarianceNotFoundError from "@modules/payroll/core/app/errors/VarianceNotFoundError";
import PayrollVarianceRepo from "@modules/payroll/core/app/ports/PayrollVarianceRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayrollVariance from "@modules/payroll/core/domain/entities/PayrollVariance";
import AuditTrail from "@modules/payroll/core/app/ports/AuditTrail";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

const PREPARE_KEY = "payroll:prepare";
const APPROVE_KEY = "payroll:approve";

export interface SignPayrollVarianceInput {
    periodId:    string;
    employeeId:  string;
    explanation: string;
    actorUserId: string;
}

/**
 * Ký xác nhận một chênh lệch kèm lời giải thích.
 *
 * Nhận CẢ HAI khoá lương (`prepare` của HR và `approve` của người duyệt): yêu cầu
 * nghiệp vụ là "HR/Admin ký", và người giải thích được con số thường chính là
 * người lập. Bốn mắt vẫn còn nguyên ở bước duyệt kỳ, không nằm ở đây.
 *
 * @throws {AccessDeniedError}            Actor không có khoá lương nào.
 * @throws {VarianceNotFoundError}        Kỳ/nhân viên này không có chênh lệch nào được ghi.
 * @throws {VarianceSignoffInvalidError}  Đã ký trước đó, hoặc giải thích quá ngắn.
 */
export default class SignPayrollVarianceUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _variances: PayrollVarianceRepo,
        private readonly _audit: AuditTrail,
    ) {}

    public async execute(input: SignPayrollVarianceInput): Promise<PayrollVariance> {
        const canPrepare = await this._permissions.hasPermission(input.actorUserId, PREPARE_KEY);
        const canApprove = await this._permissions.hasPermission(input.actorUserId, APPROVE_KEY);
        if (!canPrepare && !canApprove) throw new AccessDeniedError();

        const variance = await this._variances.findOne(input.periodId, input.employeeId);
        if (variance == undefined) throw new VarianceNotFoundError();

        variance.sign(input.actorUserId, input.explanation);
        await this._variances.save(variance);

        await this._audit.record({
            actorUserId: input.actorUserId,
            resource:    "payroll_variance",
            action:      "sign",
            resourceId:  variance.id,
            changes: {
                payrollPeriodId: input.periodId,
                employeeId:      input.employeeId,
                baselineNet:     variance.baselineNet,
                targetNet:       variance.targetNet,
                diff:            variance.diff,
                explanation:     variance.explanation,
            },
        });

        return variance;
    }
}
