import EmployeeHistoryRepo from "@modules/employee/core/app/ports/EmployeeHistoryRepo";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";

export interface ListEmployeeHistoryInput {
    employeeId:  string;
    actorUserId: string;
}

/**
 * Liệt kê lịch sử biến động của một nhân viên (append-only), trong phạm vi
 * actor được đọc.
 *
 * @throws {AccessDeniedError} Actor không được đọc hồ sơ của nhân viên này.
 */
export default class ListEmployeeHistoryUseCase {
    public constructor(
        private readonly _accessScope: EmployeeAccessScope,
        private readonly _historyRepo: EmployeeHistoryRepo,
    ) {}

    public async execute(input: ListEmployeeHistoryInput): Promise<EmployeeHistory[]> {
        await this._accessScope.assertCanRead(input.actorUserId, input.employeeId);
        return this._historyRepo.listByEmployeeId(input.employeeId);
    }
}
