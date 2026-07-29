import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";

export interface ListLeaveRequestsInput {
    employeeId?: string;
}

/** Liệt kê đơn xin nghỉ — của một nhân viên, hoặc toàn bộ (view HR). */
export default class ListLeaveRequestsUseCase {
    public constructor(
        private readonly _leaveRequestRepo: LeaveRequestRepo,
    ) {}

    public async execute(input: ListLeaveRequestsInput = {}): Promise<LeaveRequest[]> {
        return input.employeeId != undefined
            ? this._leaveRequestRepo.listByEmployee(input.employeeId)
            : this._leaveRequestRepo.listAll();
    }
}
