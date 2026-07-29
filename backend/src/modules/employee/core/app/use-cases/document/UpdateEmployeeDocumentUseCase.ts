import EmployeeSubResourceNotFoundError from "@modules/employee/core/app/errors/EmployeeSubResourceNotFoundError";
import EmployeeDocumentRepo from "@modules/employee/core/app/ports/EmployeeDocumentRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import { DocumentType } from "@modules/employee/core/domain/entities/EmployeeDocument";

const PERMISSION_KEY = "employee:manage";

export interface UpdateEmployeeDocumentInput {
    documentId:      string;
    documentType?: DocumentType | undefined;
    documentNumber?: string | undefined;
    fileUrl?: string | null | undefined;
    issuedDate?: Date | null | undefined;
    expiryDate?: Date | null | undefined;
    issuedBy?: string | null | undefined;
    actorUserId:     string;
}

/**
 * Cập nhật một giấy tờ.
 *
 * @throws {AccessDeniedError}               Actor không có quyền `employee:manage`.
 * @throws {EmployeeSubResourceNotFoundError} Giấy tờ không tồn tại.
 */
export default class UpdateEmployeeDocumentUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _documentRepo: EmployeeDocumentRepo,
    ) {}

    public async execute(input: UpdateEmployeeDocumentInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const document = await this._documentRepo.getById(input.documentId);
        if (document == undefined) throw new EmployeeSubResourceNotFoundError();

        document.update({
            documentType:   input.documentType,
            documentNumber: input.documentNumber,
            fileUrl:        input.fileUrl,
            issuedDate:     input.issuedDate,
            expiryDate:     input.expiryDate,
            issuedBy:       input.issuedBy,
        });

        await this._documentRepo.save(document);
    }
}
