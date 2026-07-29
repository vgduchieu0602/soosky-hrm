import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeeHistoryRepo from "@modules/employee/core/app/ports/EmployeeHistoryRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "employee:manage";

export interface TerminateEmployeeInput {
    employeeId:      string;
    terminationDate: Date;
    note?: string | undefined;
    actorUserId:     string;
}

/**
 * Nghỉ việc nhân viên — soft update: không xoá bản ghi, chỉ đổi trạng thái
 * sang `terminated` và ghi `terminationDate`. Tự động ghi một bản ghi
 * {@link EmployeeHistory} ("terminated").
 *
 * @throws {AccessDeniedError}    Actor không có quyền `employee:manage`.
 * @throws {EmployeeNotFoundError} Nhân viên không tồn tại.
 */
export default class TerminateEmployeeUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _employeeRepo: EmployeeRepo,
        private readonly _historyRepo:  EmployeeHistoryRepo,
    ) {}

    public async execute(input: TerminateEmployeeInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();

        const previousStatus = employee.status.value;

        employee.terminate(input.terminationDate);

        await this._employeeRepo.save(employee);

        await this._historyRepo.save(EmployeeHistory.create({
            id:              UUIDv7(),
            employeeId:      employee.id,
            eventType:       "terminated",
            fromValue:       { status: previousStatus },
            toValue:         { status: employee.status.value, terminationDate: input.terminationDate },
            effectiveDate:   input.terminationDate,
            note:            input.note ?? null,
            createdByUserId: input.actorUserId,
        }));
    }
}
