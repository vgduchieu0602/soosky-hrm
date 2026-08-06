import AuditTrail from "@modules/employee/core/app/ports/AuditTrail";
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
        private readonly _auditTrail:   AuditTrail,
    ) {}

    public async execute(input: DeleteEmployeeDocumentInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        // Doc truoc khi xoa de nhat ky giu duoc giay to nao da bi go khoi ho so.
        const document = await this._documentRepo.getById(input.documentId);

        await this._documentRepo.deleteById(input.documentId);

        if (document == undefined) return;

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "employee_document",
            action:      "delete",
            resourceId:  document.id,
            changes:     {
                employeeId:     document.employeeId,
                documentType:   document.documentType,
                documentNumber: document.documentNumber,
            },
        });
    }
}
