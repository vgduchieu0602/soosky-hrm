import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import Employee from "@modules/employee/core/domain/entities/Employee";

export interface GetEmployeeInput {
    employeeId: string;
}

/**
 * Lấy thông tin một nhân viên theo id.
 *
 * @throws {EmployeeNotFoundError} Nhân viên không tồn tại.
 */
export default class GetEmployeeUseCase {
    public constructor(
        private readonly _employeeRepo: EmployeeRepo,
    ) {}

    public async execute(input: GetEmployeeInput): Promise<Employee> {
        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();
        return employee;
    }
}
