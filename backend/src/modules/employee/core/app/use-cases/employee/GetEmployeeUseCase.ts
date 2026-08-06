import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import Employee from "@modules/employee/core/domain/entities/Employee";

export interface GetEmployeeInput {
    employeeId:  string;
    actorUserId: string;
}

/**
 * Lấy thông tin một nhân viên theo id, trong phạm vi actor được phép đọc:
 * HR/Admin xem mọi người, Manager xem cấp dưới, Employee chỉ xem chính mình.
 *
 * @throws {AccessDeniedError}     Actor không được đọc hồ sơ này.
 * @throws {EmployeeNotFoundError} Nhân viên không tồn tại.
 */
export default class GetEmployeeUseCase {
    public constructor(
        private readonly _accessScope: EmployeeAccessScope,
        private readonly _employeeRepo: EmployeeRepo,
    ) {}

    public async execute(input: GetEmployeeInput): Promise<Employee> {
        await this._accessScope.assertCanRead(input.actorUserId, input.employeeId);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();
        return employee;
    }
}
