import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import LeaveAccessScope from "@modules/attendance/core/app/services/LeaveAccessScope";
import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";

export interface ListLeaveRequestsInput {
    employeeId?: string | undefined;
    actorUserId: string;
}

/**
 * Liệt kê đơn xin nghỉ trong PHẠM VI actor được xem: HR/Admin thấy tất cả,
 * Manager thấy của mình và cấp dưới, Employee chỉ thấy của mình.
 *
 * Lọc theo `employeeId` là thu hẹp THÊM trong phạm vi đó — truyền id ngoài
 * phạm vi thì bị từ chối, không im lặng trả rỗng, để client biết là do quyền
 * chứ không phải do không có dữ liệu.
 *
 * @throws {AccessDeniedError} Actor không có quyền xem đơn nghỉ, hoặc xem đơn
 *                             của nhân viên ngoài phạm vi.
 */
export default class ListLeaveRequestsUseCase {
    public constructor(
        private readonly _accessScope: LeaveAccessScope,
        private readonly _leaveRequestRepo: LeaveRequestRepo,
    ) {}

    public async execute(input: ListLeaveRequestsInput): Promise<LeaveRequest[]> {
        if (input.employeeId != undefined) {
            await this._accessScope.assertCanRead(input.actorUserId, input.employeeId);
            return this._leaveRequestRepo.listByEmployee(input.employeeId);
        }

        const visibleIds = await this._accessScope.visibleEmployeeIds(input.actorUserId);
        if (visibleIds == undefined) return this._leaveRequestRepo.listAll();
        if (visibleIds.length === 0) return [];

        const perEmployee = await Promise.all(visibleIds.map(id => this._leaveRequestRepo.listByEmployee(id)));
        return perEmployee.flat();
    }
}
