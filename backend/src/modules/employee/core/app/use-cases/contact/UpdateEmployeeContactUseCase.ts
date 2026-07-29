import EmployeeSubResourceNotFoundError from "@modules/employee/core/app/errors/EmployeeSubResourceNotFoundError";
import EmployeeContactRepo from "@modules/employee/core/app/ports/EmployeeContactRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import { Relationship } from "@modules/employee/core/domain/entities/EmployeeContact";

const PERMISSION_KEY = "employee:manage";

export interface UpdateEmployeeContactInput {
    contactId:     string;
    name?: string | undefined;
    relationship?: Relationship | undefined;
    phone?: string | null | undefined;
    email?: string | null | undefined;
    address?: string | null | undefined;
    isPrimary?: boolean | undefined;
    actorUserId:   string;
}

/**
 * Cập nhật một người liên hệ.
 *
 * @throws {AccessDeniedError}                 Actor không có quyền `employee:manage`.
 * @throws {EmployeeSubResourceNotFoundError}   Người liên hệ không tồn tại.
 */
export default class UpdateEmployeeContactUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _contactRepo: EmployeeContactRepo,
    ) {}

    public async execute(input: UpdateEmployeeContactInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const contact = await this._contactRepo.getById(input.contactId);
        if (contact == undefined) throw new EmployeeSubResourceNotFoundError();

        contact.update({
            name:         input.name,
            relationship: input.relationship,
            phone:        input.phone,
            email:        input.email,
            address:      input.address,
            isPrimary:    input.isPrimary,
        });

        await this._contactRepo.save(contact);
    }
}
