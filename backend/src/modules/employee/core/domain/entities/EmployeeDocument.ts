import EmployeeSubResourceInvalidError from "@modules/employee/core/domain/errors/EmployeeSubResourceInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const DOCUMENT_TYPES = ["id_card", "passport", "degree", "certificate", "visa", "other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface EmployeeDocumentProps {
    id:             string;
    employeeId:     string;
    documentType:   DocumentType;
    documentNumber: string;
    fileUrl:        string | null;
    issuedDate:     Date | null;
    expiryDate:     Date | null;
    issuedBy:       string | null;
    createdAt:      Date;
}

/**
 * Giấy tờ của nhân viên (CMND/passport/bằng cấp/...) — chỉ lưu `fileUrl`
 * dạng chuỗi, KHÔNG xử lý upload file (ngoài phạm vi module).
 */
export default class EmployeeDocument extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly employeeId: string,
        public readonly createdAt: Date,
        private _documentType: DocumentType,
        private _documentNumber: string,
        private _fileUrl: string | null,
        private _issuedDate: Date | null,
        private _expiryDate: Date | null,
        private _issuedBy: string | null,
    ) {
        super();
    }

    get documentType(): DocumentType { return this._documentType; }
    get documentNumber(): string { return this._documentNumber; }
    get fileUrl(): string | null { return this._fileUrl; }
    get issuedDate(): Date | null { return this._issuedDate; }
    get expiryDate(): Date | null { return this._expiryDate; }
    get issuedBy(): string | null { return this._issuedBy; }

    static create(props: Omit<EmployeeDocumentProps, "createdAt">): EmployeeDocument {
        return EmployeeDocument.rehydrate({ ...props, createdAt: new Date() });
    }

    static rehydrate(props: EmployeeDocumentProps): EmployeeDocument {
        if (!DOCUMENT_TYPES.includes(props.documentType)) {
            throw new EmployeeSubResourceInvalidError(`Invalid document type: ${props.documentType}`);
        }
        if (props.documentNumber.trim().length === 0) {
            throw new EmployeeSubResourceInvalidError("Document number must not be empty");
        }
        return new EmployeeDocument(
            props.id, props.employeeId, props.createdAt,
            props.documentType, props.documentNumber.trim(), props.fileUrl, props.issuedDate, props.expiryDate, props.issuedBy,
        );
    }

    update(patch: { documentType?: DocumentType | undefined; documentNumber?: string | undefined; fileUrl?: string | null | undefined; issuedDate?: Date | null | undefined; expiryDate?: Date | null | undefined; issuedBy?: string | null | undefined; }): void {
        if (patch.documentType != undefined) {
            if (!DOCUMENT_TYPES.includes(patch.documentType)) throw new EmployeeSubResourceInvalidError(`Invalid document type: ${patch.documentType}`);
            this._documentType = patch.documentType;
        }
        if (patch.documentNumber != undefined) {
            if (patch.documentNumber.trim().length === 0) throw new EmployeeSubResourceInvalidError("Document number must not be empty");
            this._documentNumber = patch.documentNumber.trim();
        }
        if (patch.fileUrl !== undefined)    this._fileUrl = patch.fileUrl;
        if (patch.issuedDate !== undefined) this._issuedDate = patch.issuedDate;
        if (patch.expiryDate !== undefined) this._expiryDate = patch.expiryDate;
        if (patch.issuedBy !== undefined)   this._issuedBy = patch.issuedBy;
    }
}
