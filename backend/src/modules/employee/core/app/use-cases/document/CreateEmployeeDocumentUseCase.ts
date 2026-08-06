import AuditTrail from "@modules/employee/core/app/ports/AuditTrail";
import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeeDocumentRepo from "@modules/employee/core/app/ports/EmployeeDocumentRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeDocument, { DocumentType } from "@modules/employee/core/domain/entities/EmployeeDocument";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "employee:manage";

export interface CreateEmployeeDocumentInput {
    employeeId:     string;
    documentType:   DocumentType;
    documentNumber: string;
    fileUrl?: string | undefined;
    issuedDate?: Date | undefined;
    expiryDate?: Date | undefined;
    issuedBy?: string | undefined;
    actorUserId:    string;
}

export interface CreateEmployeeDocumentOutput {
    documentId: string;
}

/**
 * Thêm giấy tờ (CMND/hộ chiếu/bằng cấp/...) cho nhân viên. `fileUrl` chỉ lưu
 * chuỗi tham chiếu — việc upload file nằm ngoài phạm vi module.
 *
 * @throws {AccessDeniedError}     Actor không có quyền `employee:manage`.
 * @throws {EmployeeNotFoundError} Nhân viên không tồn tại.
 */
export default class CreateEmployeeDocumentUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _employeeRepo: EmployeeRepo,
        private readonly _documentRepo: EmployeeDocumentRepo,
        private readonly _auditTrail:   AuditTrail,
    ) {}

    public async execute(input: CreateEmployeeDocumentInput): Promise<CreateEmployeeDocumentOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();

        const document = EmployeeDocument.create({
            id:             createUuidV7(),
            employeeId:     input.employeeId,
            documentType:   input.documentType,
            documentNumber: input.documentNumber,
            fileUrl:        input.fileUrl ?? null,
            issuedDate:     input.issuedDate ?? null,
            expiryDate:     input.expiryDate ?? null,
            issuedBy:       input.issuedBy ?? null,
        });

        await this._documentRepo.save(document);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "employee_document",
            action:      "create",
            resourceId:  document.id,
            changes:     {
                employeeId:     document.employeeId,
                documentType:   document.documentType,
                documentNumber: document.documentNumber,
                issuedDate:     document.issuedDate,
                expiryDate:     document.expiryDate,
                issuedBy:       document.issuedBy,
            },
        });

        return { documentId: document.id };
    }
}
