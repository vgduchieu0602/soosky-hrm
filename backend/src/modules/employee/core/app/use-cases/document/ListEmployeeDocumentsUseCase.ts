import EmployeeDocumentRepo from "@modules/employee/core/app/ports/EmployeeDocumentRepo";
import EmployeeDocument from "@modules/employee/core/domain/entities/EmployeeDocument";

export interface ListEmployeeDocumentsInput {
    employeeId: string;
}

/** Liệt kê giấy tờ của một nhân viên. */
export default class ListEmployeeDocumentsUseCase {
    public constructor(
        private readonly _documentRepo: EmployeeDocumentRepo,
    ) {}

    public async execute(input: ListEmployeeDocumentsInput): Promise<EmployeeDocument[]> {
        return this._documentRepo.listByEmployeeId(input.employeeId);
    }
}
