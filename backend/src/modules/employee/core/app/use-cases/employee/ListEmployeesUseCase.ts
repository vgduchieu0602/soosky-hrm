import EmployeeRepo, { EmployeeListFilter } from "@modules/employee/core/app/ports/EmployeeRepo";
import Employee from "@modules/employee/core/domain/entities/Employee";

/** Liệt kê nhân viên, có thể lọc theo phòng ban/trạng thái. */
export default class ListEmployeesUseCase {
    public constructor(
        private readonly _employeeRepo: EmployeeRepo,
    ) {}

    public async execute(filter: EmployeeListFilter): Promise<Employee[]> {
        return this._employeeRepo.list(filter);
    }
}
