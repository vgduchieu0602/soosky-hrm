import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import LeaveBalance from "@modules/attendance/core/domain/entities/LeaveBalance";

export interface ListLeaveBalancesInput {
    employeeId: string;
    year:       number;
}

/** Liệt kê toàn bộ số dư phép (theo mọi loại nghỉ) của một nhân viên trong một năm. */
export default class ListLeaveBalancesUseCase {
    public constructor(
        private readonly _leaveBalanceRepo: LeaveBalanceRepo,
    ) {}

    public async execute(input: ListLeaveBalancesInput): Promise<LeaveBalance[]> {
        return this._leaveBalanceRepo.listByEmployeeYear(input.employeeId, input.year);
    }
}
