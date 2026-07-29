import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeeContactRepo from "@modules/employee/core/app/ports/EmployeeContactRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeContact, { Relationship } from "@modules/employee/core/domain/entities/EmployeeContact";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "employee:manage";

export interface CreateEmployeeContactInput {
    employeeId:   string;
    name:         string;
    relationship: Relationship;
    phone?: string | undefined;
    email?: string | undefined;
    address?: string | undefined;
    isPrimary?: boolean | undefined;
    actorUserId:  string;
}

export interface CreateEmployeeContactOutput {
    contactId: string;
}

/**
 * Thêm người liên hệ khẩn cấp cho nhân viên.
 *
 * @throws {AccessDeniedError}     Actor không có quyền `employee:manage`.
 * @throws {EmployeeNotFoundError} Nhân viên không tồn tại.
 */
export default class CreateEmployeeContactUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _employeeRepo: EmployeeRepo,
        private readonly _contactRepo:  EmployeeContactRepo,
    ) {}

    public async execute(input: CreateEmployeeContactInput): Promise<CreateEmployeeContactOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();

        const contact = EmployeeContact.create({
            id:           UUIDv7(),
            employeeId:   input.employeeId,
            name:         input.name,
            relationship: input.relationship,
            phone:        input.phone ?? null,
            email:        input.email ?? null,
            address:      input.address ?? null,
            isPrimary:    input.isPrimary ?? false,
        });

        await this._contactRepo.save(contact);

        return { contactId: contact.id };
    }
}
