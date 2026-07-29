import EmployeeHistoryRepo from "@modules/employee/core/app/ports/EmployeeHistoryRepo";
import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";

export interface ListEmployeeHistoryInput {
    employeeId: string;
}

/** Liệt kê lịch sử biến động của một nhân viên (append-only). */
export default class ListEmployeeHistoryUseCase {
    public constructor(
        private readonly _historyRepo: EmployeeHistoryRepo,
    ) {}

    public async execute(input: ListEmployeeHistoryInput): Promise<EmployeeHistory[]> {
        return this._historyRepo.listByEmployeeId(input.employeeId);
    }
}
