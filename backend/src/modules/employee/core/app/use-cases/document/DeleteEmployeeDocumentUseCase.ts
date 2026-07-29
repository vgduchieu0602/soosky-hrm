import EmployeeDocumentRepo from "@modules/employee/core/app/ports/EmployeeDocumentRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "employee:manage";

export interface DeleteEmployeeDocumentInput {
    documentId:  string;
    actorUserId: string;
}

/**
 * Xoá một giấy tờ. Idempotent — xoá id không tồn tại không lỗi.
 *
 * @throws {AccessDeniedError} Actor không có quyền `employee:manage`.
 */
export default class DeleteEmployeeDocumentUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _documentRepo: EmployeeDocumentRepo,
    ) {}

    public async execute(input: DeleteEmployeeDocumentInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);
        await this._documentRepo.deleteById(input.documentId);
    }
}
