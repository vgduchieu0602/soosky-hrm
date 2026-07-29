import { PayrollRunResult } from "@modules/payroll/core/app/ports/PayrollRunPort";
import EmployeeDirectory from "@modules/payroll/core/app/ports/EmployeeDirectory";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import RunPayrollForEmployeeUseCase from "@modules/payroll/core/app/use-cases/payroll/RunPayrollForEmployeeUseCase";

const PERMISSION_KEY = "payroll:manage";

/**
 * Chạy lương cho TOÀN BỘ nhân viên đang hoạt động trong một kỳ. Lỗi của từng
 * nhân viên được gom lại trong kết quả, không chặn cả kỳ (một người thiếu hợp
 * đồng/chính sách không cản người khác được tính).
 *
 * @throws {AccessDeniedError} Actor không có quyền `payroll:manage`.
 */
export default class RunPayrollForPeriodUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _employees: EmployeeDirectory,
        private readonly _runForEmployee: RunPayrollForEmployeeUseCase,
    ) {}

    public async execute(input: { periodId: string; actorUserId: string }): Promise<PayrollRunResult> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employeeIds = await this._employees.listActiveEmployeeIds();
        const result: PayrollRunResult = { computed: 0, errors: [] };

        for (const employeeId of employeeIds) {
            try {
                await this._runForEmployee.execute({ periodId: input.periodId, employeeId, actorUserId: input.actorUserId });
                result.computed += 1;
            } catch (err) {
                result.errors.push({ employeeId, reason: (err as Error).message });
            }
        }

        return result;
    }
}
