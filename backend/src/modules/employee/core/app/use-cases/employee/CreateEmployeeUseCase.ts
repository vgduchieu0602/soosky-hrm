import EmployeeCodeConflictError from "@modules/employee/core/app/errors/EmployeeCodeConflictError";
import EmployeeDepartmentNotFoundError from "@modules/employee/core/app/errors/EmployeeDepartmentNotFoundError";
import EmployeePositionNotFoundError from "@modules/employee/core/app/errors/EmployeePositionNotFoundError";
import ManagerNotFoundError from "@modules/employee/core/app/errors/ManagerNotFoundError";
import EmployeeHistoryRepo from "@modules/employee/core/app/ports/EmployeeHistoryRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import OrgDirectory from "@modules/employee/core/app/ports/OrgDirectory";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import Employee from "@modules/employee/core/domain/entities/Employee";
import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";
import EmployeeCode from "@modules/employee/core/domain/value-objects/EmployeeCode";
import EmployeeType from "@modules/employee/core/domain/value-objects/EmployeeType";
import PersonName from "@modules/employee/core/domain/value-objects/PersonName";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "employee:manage";

export interface CreateEmployeeInput {
    code:         string;
    name:         string;
    email?: string | undefined;
    phone?: string | undefined;
    dob?: Date | undefined;
    gender?: string | undefined;
    departmentId: string;
    positionId:   string;
    managerId?: string | undefined;
    hireDate:     Date;
    employeeType: string;
    accountId?: string | undefined;
    actorUserId:  string;
}

export interface CreateEmployeeOutput {
    employeeId: string;
}

/**
 * Tạo mới nhân viên.
 *
 * @throws {AccessDeniedError}                Actor không có quyền `employee:manage`.
 * @throws {EmployeeCodeConflictError}         Mã nhân viên đã tồn tại.
 * @throws {EmployeeDepartmentNotFoundError}   Phòng ban không tồn tại (qua {@link OrgDirectory}).
 * @throws {EmployeePositionNotFoundError}     Vị trí không tồn tại (qua {@link OrgDirectory}).
 * @throws {ManagerNotFoundError}              Quản lý trực tiếp không tồn tại.
 */
export default class CreateEmployeeUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _employeeRepo: EmployeeRepo,
        private readonly _historyRepo:  EmployeeHistoryRepo,
        private readonly _orgDirectory: OrgDirectory,
    ) {}

    public async execute(input: CreateEmployeeInput): Promise<CreateEmployeeOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const code = EmployeeCode.create(input.code);

        const existing = await this._employeeRepo.getByCode(code.value);
        if (existing != undefined) throw new EmployeeCodeConflictError();

        if (!await this._orgDirectory.departmentExists(input.departmentId)) {
            throw new EmployeeDepartmentNotFoundError();
        }
        if (!await this._orgDirectory.positionExists(input.positionId)) {
            throw new EmployeePositionNotFoundError();
        }
        if (input.managerId != undefined) {
            const manager = await this._employeeRepo.getById(input.managerId);
            if (manager == undefined) throw new ManagerNotFoundError();
        }

        const employee = Employee.create({
            id:           UUIDv7(),
            code,
            name:         PersonName.create(input.name),
            email:        input.email ?? null,
            phone:        input.phone ?? null,
            dob:          input.dob ?? null,
            gender:       input.gender ?? null,
            departmentId: input.departmentId,
            positionId:   input.positionId,
            managerId:    input.managerId ?? null,
            hireDate:     input.hireDate,
            employeeType: EmployeeType.create(input.employeeType),
            accountId:    input.accountId ?? null,
        });

        await this._employeeRepo.save(employee);

        await this._historyRepo.save(EmployeeHistory.create({
            id:              UUIDv7(),
            employeeId:      employee.id,
            eventType:       "hired",
            fromValue:       null,
            toValue:         { departmentId: employee.departmentId, positionId: employee.positionId },
            effectiveDate:   employee.hireDate,
            note:            null,
            createdByUserId: input.actorUserId,
        }));

        return { employeeId: employee.id };
    }
}
