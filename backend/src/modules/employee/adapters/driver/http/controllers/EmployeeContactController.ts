import EmployeeContactPresenter from "@modules/employee/adapters/driver/http/presenters/EmployeeContactPresenter";
import CreateEmployeeContactUseCase from "@modules/employee/core/app/use-cases/contact/CreateEmployeeContactUseCase";
import DeleteEmployeeContactUseCase from "@modules/employee/core/app/use-cases/contact/DeleteEmployeeContactUseCase";
import ListEmployeeContactsUseCase from "@modules/employee/core/app/use-cases/contact/ListEmployeeContactsUseCase";
import UpdateEmployeeContactUseCase from "@modules/employee/core/app/use-cases/contact/UpdateEmployeeContactUseCase";
import { Relationship } from "@modules/employee/core/domain/entities/EmployeeContact";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface EmployeeContactControllerUseCases {
    createEmployeeContact: CreateEmployeeContactUseCase;
    updateEmployeeContact: UpdateEmployeeContactUseCase;
    deleteEmployeeContact: DeleteEmployeeContactUseCase;
    listEmployeeContacts:  ListEmployeeContactsUseCase;
}

const bodySchemaCreateContact = bodySchema({
    name:         field.string,
    relationship: field.string,
    phone:        field.optionalString,
    email:        field.optionalString,
    address:      field.optionalString,
});

const bodySchemaUpdateContact = bodySchema({
    name:         field.optionalString,
    relationship: field.optionalString,
    phone:        field.optionalString,
    email:        field.optionalString,
    address:      field.optionalString,
});

/** Controller nhóm endpoint người liên hệ khẩn cấp của nhân viên. */
export default class EmployeeContactController {
    public constructor(
        private readonly _useCases: EmployeeContactControllerUseCases,
    ) {}

    public createEmployeeContact = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaCreateContact.parse(req.body);
        const output = await this._useCases.createEmployeeContact.execute({
            ...body,
            relationship: body.relationship as Relationship,
            employeeId:   req.params.employeeId,
            actorUserId:  ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listEmployeeContacts = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const contacts = await this._useCases.listEmployeeContacts.execute({ employeeId: req.params.employeeId });
        res.status(200).json({ contacts: contacts.map(EmployeeContactPresenter.toDTO) });
    };

    public updateEmployeeContact = async (req: Request<{ contactId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaUpdateContact.parse(req.body);
        await this._useCases.updateEmployeeContact.execute({
            ...body,
            relationship: body.relationship as Relationship | undefined,
            contactId:    req.params.contactId,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteEmployeeContact = async (req: Request<{ contactId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteEmployeeContact.execute({
            contactId:   req.params.contactId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };
}
