import EmployeeDocument from "@modules/employee/core/domain/entities/EmployeeDocument";

export interface EmployeeDocumentDTO {
    id:             string;
    employeeId:     string;
    documentType:   string;
    documentNumber: string;
    fileUrl:        string | null;
    issuedDate:     string | null;
    expiryDate:     string | null;
    issuedBy:       string | null;
    createdAt:      string;
}

const EmployeeDocumentPresenter = {
    toDTO(document: EmployeeDocument): EmployeeDocumentDTO {
        return {
            id:             document.id,
            employeeId:     document.employeeId,
            documentType:   document.documentType,
            documentNumber: document.documentNumber,
            fileUrl:        document.fileUrl,
            issuedDate:     document.issuedDate?.toISOString() ?? null,
            expiryDate:     document.expiryDate?.toISOString() ?? null,
            issuedBy:       document.issuedBy,
            createdAt:      document.createdAt.toISOString(),
        };
    },
};

export default EmployeeDocumentPresenter;
