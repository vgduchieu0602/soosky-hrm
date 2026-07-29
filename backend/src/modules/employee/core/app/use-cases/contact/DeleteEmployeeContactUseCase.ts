import EmployeeContactRepo from "@modules/employee/core/app/ports/EmployeeContactRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "employee:manage";

export interface DeleteEmployeeContactInput {
    contactId:   string;
    actorUserId: string;
}

/**
 * Xoá một người liên hệ. Idempotent — xoá id không tồn tại không lỗi.
 *
 * @throws {AccessDeniedError} Actor không có quyền `employee:manage`.
 */
export default class DeleteEmployeeContactUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _contactRepo: EmployeeContactRepo,
    ) {}

    public async execute(input: DeleteEmployeeContactInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);
        await this._contactRepo.deleteById(input.contactId);
    }
}
