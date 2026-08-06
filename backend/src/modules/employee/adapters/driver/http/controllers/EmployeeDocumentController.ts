import EmployeeDocumentPresenter from "@modules/employee/adapters/driver/http/presenters/EmployeeDocumentPresenter";
import CreateEmployeeDocumentUseCase from "@modules/employee/core/app/use-cases/document/CreateEmployeeDocumentUseCase";
import DeleteEmployeeDocumentUseCase from "@modules/employee/core/app/use-cases/document/DeleteEmployeeDocumentUseCase";
import ListEmployeeDocumentsUseCase from "@modules/employee/core/app/use-cases/document/ListEmployeeDocumentsUseCase";
import UpdateEmployeeDocumentUseCase from "@modules/employee/core/app/use-cases/document/UpdateEmployeeDocumentUseCase";
import { DocumentType } from "@modules/employee/core/domain/entities/EmployeeDocument";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface EmployeeDocumentControllerUseCases {
    createEmployeeDocument: CreateEmployeeDocumentUseCase;
    updateEmployeeDocument: UpdateEmployeeDocumentUseCase;
    deleteEmployeeDocument: DeleteEmployeeDocumentUseCase;
    listEmployeeDocuments:  ListEmployeeDocumentsUseCase;
}

const bodySchemaCreateDocument = bodySchema({
    documentType:   field.string,
    documentNumber: field.string,
    fileUrl:        field.optionalString,
    issuedDate:     field.optionalDate,
    expiryDate:     field.optionalDate,
    issuedBy:       field.optionalString,
});

const bodySchemaUpdateDocument = bodySchema({
    documentType:   field.optionalString,
    documentNumber: field.optionalString,
    fileUrl:        field.optionalString,
    issuedDate:     field.optionalDate,
    expiryDate:     field.optionalDate,
    issuedBy:       field.optionalString,
});

/** Controller nhóm endpoint giấy tờ của nhân viên. `fileUrl` chỉ lưu chuỗi tham chiếu. */
export default class EmployeeDocumentController {
    public constructor(
        private readonly _useCases: EmployeeDocumentControllerUseCases,
    ) {}

    public createEmployeeDocument = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaCreateDocument.parse(req.body);
        const output = await this._useCases.createEmployeeDocument.execute({
            ...body,
            documentType: body.documentType as DocumentType,
            employeeId:   req.params.employeeId,
            actorUserId:  ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listEmployeeDocuments = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const documents = await this._useCases.listEmployeeDocuments.execute({ employeeId: req.params.employeeId, actorUserId: ActorContext.get(res) });
        res.status(200).json({ documents: documents.map(EmployeeDocumentPresenter.toDTO) });
    };

    public updateEmployeeDocument = async (req: Request<{ documentId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaUpdateDocument.parse(req.body);
        await this._useCases.updateEmployeeDocument.execute({
            ...body,
            documentType: body.documentType as DocumentType | undefined,
            documentId:   req.params.documentId,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteEmployeeDocument = async (req: Request<{ documentId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteEmployeeDocument.execute({
            documentId:  req.params.documentId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };
}
