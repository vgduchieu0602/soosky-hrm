import EmployeeContactRepo from "@modules/employee/core/app/ports/EmployeeContactRepo";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import EmployeeContact from "@modules/employee/core/domain/entities/EmployeeContact";

export interface ListEmployeeContactsInput {
    employeeId:  string;
    actorUserId: string;
}

/**
 * Liệt kê người liên hệ của một nhân viên, trong phạm vi actor được đọc.
 *
 * @throws {AccessDeniedError} Actor không được đọc hồ sơ của nhân viên này.
 */
export default class ListEmployeeContactsUseCase {
    public constructor(
        private readonly _accessScope: EmployeeAccessScope,
        private readonly _contactRepo: EmployeeContactRepo,
    ) {}

    public async execute(input: ListEmployeeContactsInput): Promise<EmployeeContact[]> {
        await this._accessScope.assertCanRead(input.actorUserId, input.employeeId);
        return this._contactRepo.listByEmployeeId(input.employeeId);
    }
}
