import EmployeeCodeConflictError from "@modules/employee/core/app/errors/EmployeeCodeConflictError";
import EmployeeDepartmentNotFoundError from "@modules/employee/core/app/errors/EmployeeDepartmentNotFoundError";
import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeePositionNotFoundError from "@modules/employee/core/app/errors/EmployeePositionNotFoundError";
import ManagerNotFoundError from "@modules/employee/core/app/errors/ManagerNotFoundError";
import EmployeeHistoryRepo from "@modules/employee/core/app/ports/EmployeeHistoryRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import OrgDirectory from "@modules/employee/core/app/ports/OrgDirectory";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";
import EmployeeCode from "@modules/employee/core/domain/value-objects/EmployeeCode";
import EmployeeType from "@modules/employee/core/domain/value-objects/EmployeeType";
import PersonName from "@modules/employee/core/domain/value-objects/PersonName";
import ManagerChain from "@modules/employee/core/app/services/ManagerChain";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "employee:manage";

export interface UpdateEmployeeInput {
    employeeId:   string;
    code?: string | undefined;
    name?: string | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    dob?: Date | null | undefined;
    gender?: string | null | undefined;
    departmentId?: string | undefined;
    positionId?: string | undefined;
    managerId?: string | null | undefined;
    employeeType?: string | undefined;
    actorUserId:  string;
}

/**
 * Cập nhật thông tin nhân viên. Ghi tự động một bản ghi {@link EmployeeHistory}
 * ("transfer") khi phòng ban thay đổi.
 *
 * @throws {AccessDeniedError}              Actor không có quyền `employee:manage`.
 * @throws {EmployeeNotFoundError}           Nhân viên không tồn tại.
 * @throws {EmployeeCodeConflictError}       Mã mới trùng nhân viên khác.
 * @throws {EmployeeDepartmentNotFoundError} Phòng ban mới không tồn tại.
 * @throws {EmployeePositionNotFoundError}   Vị trí mới không tồn tại.
 * @throws {ManagerNotFoundError}            Quản lý mới không tồn tại.
 * @throws {ManagerCycleError}               Gán quản lý này tạo vòng trong chuỗi báo cáo.
 */
export default class UpdateEmployeeUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _employeeRepo: EmployeeRepo,
        private readonly _historyRepo:  EmployeeHistoryRepo,
        private readonly _orgDirectory: OrgDirectory,
        private readonly _managerChain: ManagerChain,
    ) {}

    public async execute(input: UpdateEmployeeInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();

        if (input.code != undefined) {
            const code   = EmployeeCode.create(input.code);
            const holder = await this._employeeRepo.getByCode(code.value);
            if (holder != undefined && holder.id !== employee.id) {
                throw new EmployeeCodeConflictError();
            }
            employee.changeCode(code);
        }
        if (input.name != undefined) {
            employee.rename(PersonName.create(input.name));
        }
        if (input.email !== undefined || input.phone !== undefined) {
            employee.updateContactInfo(
                input.email !== undefined ? input.email : employee.email,
                input.phone !== undefined ? input.phone : employee.phone,
            );
        }

        const previousDepartmentId = employee.departmentId;

        if (input.departmentId != undefined && input.departmentId !== employee.departmentId) {
            if (!await this._orgDirectory.departmentExists(input.departmentId)) {
                throw new EmployeeDepartmentNotFoundError();
            }
            employee.transferDepartment(input.departmentId);
        }
        if (input.positionId != undefined && input.positionId !== employee.positionId) {
            if (!await this._orgDirectory.positionExists(input.positionId)) {
                throw new EmployeePositionNotFoundError();
            }
            employee.transferPosition(input.positionId);
        }
        if (input.managerId !== undefined) {
            if (input.managerId != undefined) {
                const manager = await this._employeeRepo.getById(input.managerId);
                if (manager == undefined) throw new ManagerNotFoundError();
                await this._managerChain.assertNoCycle(employee.id, input.managerId);
            }
            employee.assignManager(input.managerId);
        }
        if (input.employeeType != undefined) {
            employee.changeEmployeeType(EmployeeType.create(input.employeeType));
        }

        await this._employeeRepo.save(employee);

        if (previousDepartmentId !== employee.departmentId) {
            await this._historyRepo.save(EmployeeHistory.create({
                id:              createUuidV7(),
                employeeId:      employee.id,
                eventType:       "transfer",
                fromValue:       { departmentId: previousDepartmentId },
                toValue:         { departmentId: employee.departmentId },
                effectiveDate:   new Date(),
                note:            null,
                createdByUserId: input.actorUserId,
            }));
        }
    }
}
