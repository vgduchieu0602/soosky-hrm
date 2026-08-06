import EmployeeNotFoundError from "@modules/attendance/core/app/errors/EmployeeNotFoundError";
import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import LeaveBalance from "@modules/attendance/core/domain/entities/LeaveBalance";
import LeaveType from "@modules/attendance/core/domain/value-objects/LeaveType";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "attendance:manage";

export interface AdjustLeaveBalanceInput {
    employeeId:  string;
    leaveType:   string;
    year:        number;
    entitled:    number;
    actorUserId: string;
}

/**
 * HR thiết lập/điều chỉnh hạn mức phép (`entitled`) của một nhân viên cho một
 * năm — `used` được giữ nguyên (port từ `leave.usecases.ts::upsertBalance`).
 * Tạo mới nếu chưa có dòng số dư cho năm đó.
 *
 * @throws {AccessDeniedError}     Actor không có quyền `attendance:manage`.
 * @throws {EmployeeNotFoundError} Nhân viên không tồn tại.
 */
export default class AdjustLeaveBalanceUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _leaveBalanceRepo: LeaveBalanceRepo,
        private readonly _employeeDirectory: EmployeeDirectory,
    ) {}

    public async execute(input: AdjustLeaveBalanceInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const exists = await this._employeeDirectory.employeeExists(input.employeeId);
        if (!exists) throw new EmployeeNotFoundError();

        const leaveType = LeaveType.create(input.leaveType);
        let balance = await this._leaveBalanceRepo.getOne(input.employeeId, leaveType.value, input.year);

        if (balance == undefined) {
            balance = LeaveBalance.create({
                id:         createUuidV7(),
                employeeId: input.employeeId,
                leaveType,
                year:       input.year,
                entitled:   input.entitled,
            });
        } else {
            balance.setEntitled(input.entitled);
        }

        await this._leaveBalanceRepo.save(balance);
    }
}
