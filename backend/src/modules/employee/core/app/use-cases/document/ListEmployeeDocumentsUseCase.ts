import EmployeeDocumentRepo from "@modules/employee/core/app/ports/EmployeeDocumentRepo";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import EmployeeDocument from "@modules/employee/core/domain/entities/EmployeeDocument";

export interface ListEmployeeDocumentsInput {
    employeeId:  string;
    actorUserId: string;
}

/**
 * Liệt kê giấy tờ của một nhân viên, trong phạm vi actor được đọc.
 *
 * @throws {AccessDeniedError} Actor không được đọc hồ sơ của nhân viên này.
 */
export default class ListEmployeeDocumentsUseCase {
    public constructor(
        private readonly _accessScope: EmployeeAccessScope,
        private readonly _documentRepo: EmployeeDocumentRepo,
    ) {}

    public async execute(input: ListEmployeeDocumentsInput): Promise<EmployeeDocument[]> {
        await this._accessScope.assertCanRead(input.actorUserId, input.employeeId);
        return this._documentRepo.listByEmployeeId(input.employeeId);
    }
}
