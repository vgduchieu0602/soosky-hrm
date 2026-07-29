import EmployeeContactRepo from "@modules/employee/core/app/ports/EmployeeContactRepo";
import EmployeeContact from "@modules/employee/core/domain/entities/EmployeeContact";

export interface ListEmployeeContactsInput {
    employeeId: string;
}

/** Liệt kê người liên hệ của một nhân viên. */
export default class ListEmployeeContactsUseCase {
    public constructor(
        private readonly _contactRepo: EmployeeContactRepo,
    ) {}

    public async execute(input: ListEmployeeContactsInput): Promise<EmployeeContact[]> {
        return this._contactRepo.listByEmployeeId(input.employeeId);
    }
}
