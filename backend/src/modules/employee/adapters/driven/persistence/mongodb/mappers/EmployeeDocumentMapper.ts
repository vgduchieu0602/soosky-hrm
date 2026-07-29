import EmployeeDocumentMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeDocumentMongoDoc";
import EmployeeDocument, { DocumentType } from "@modules/employee/core/domain/entities/EmployeeDocument";

const EmployeeDocumentMapper = {
    toDocument(document: EmployeeDocument): EmployeeDocumentMongoDoc {
        return {
            _id:            document.id,
            employeeId:     document.employeeId,
            documentType:   document.documentType,
            documentNumber: document.documentNumber,
            fileUrl:        document.fileUrl,
            issuedDate:     document.issuedDate,
            expiryDate:     document.expiryDate,
            issuedBy:       document.issuedBy,
            createdAt:      document.createdAt,
        };
    },

    toDomain(document: EmployeeDocumentMongoDoc): EmployeeDocument {
        return EmployeeDocument.rehydrate({
            id:             document._id,
            employeeId:     document.employeeId,
            documentType:   document.documentType as DocumentType,
            documentNumber: document.documentNumber,
            fileUrl:        document.fileUrl,
            issuedDate:     document.issuedDate,
            expiryDate:     document.expiryDate,
            issuedBy:       document.issuedBy,
            createdAt:      document.createdAt,
        });
    },
};

export default EmployeeDocumentMapper;
