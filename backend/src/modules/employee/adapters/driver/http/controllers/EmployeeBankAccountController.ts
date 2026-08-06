import EmployeeBankAccountPresenter from "@modules/employee/adapters/driver/http/presenters/EmployeeBankAccountPresenter";
import CreateEmployeeBankAccountUseCase from "@modules/employee/core/app/use-cases/bank-account/CreateEmployeeBankAccountUseCase";
import DeleteEmployeeBankAccountUseCase from "@modules/employee/core/app/use-cases/bank-account/DeleteEmployeeBankAccountUseCase";
import ListEmployeeBankAccountsUseCase from "@modules/employee/core/app/use-cases/bank-account/ListEmployeeBankAccountsUseCase";
import UpdateEmployeeBankAccountUseCase from "@modules/employee/core/app/use-cases/bank-account/UpdateEmployeeBankAccountUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface EmployeeBankAccountControllerUseCases {
    createEmployeeBankAccount: CreateEmployeeBankAccountUseCase;
    updateEmployeeBankAccount: UpdateEmployeeBankAccountUseCase;
    deleteEmployeeBankAccount: DeleteEmployeeBankAccountUseCase;
    listEmployeeBankAccounts:  ListEmployeeBankAccountsUseCase;
}

const bodySchemaCreateBankAccount = bodySchema({
    bankName:      field.string,
    branch:        field.optionalString,
    accountNumber: field.string,
    accountHolder: field.string,
    isPrimary:     field.optionalBoolean,
});

const bodySchemaUpdateBankAccount = bodySchema({
    bankName:      field.optionalString,
    branch:        field.optionalString,
    accountNumber: field.optionalString,
    accountHolder: field.optionalString,
    isPrimary:     field.optionalBoolean,
});

/** Controller nhóm endpoint tài khoản ngân hàng của nhân viên. */
export default class EmployeeBankAccountController {
    public constructor(
        private readonly _useCases: EmployeeBankAccountControllerUseCases,
    ) {}

    public createEmployeeBankAccount = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const output = await this._useCases.createEmployeeBankAccount.execute({
            ...bodySchemaCreateBankAccount.parse(req.body),
            employeeId:  req.params.employeeId,
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listEmployeeBankAccounts = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const accounts = await this._useCases.listEmployeeBankAccounts.execute({ employeeId: req.params.employeeId, actorUserId: ActorContext.get(res) });
        res.status(200).json({ bankAccounts: accounts.map(EmployeeBankAccountPresenter.toDTO) });
    };

    public updateEmployeeBankAccount = async (req: Request<{ bankAccountId: string }>, res: Response): Promise<void> => {
        await this._useCases.updateEmployeeBankAccount.execute({
            ...bodySchemaUpdateBankAccount.parse(req.body),
            bankAccountId: req.params.bankAccountId,
            actorUserId:   ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteEmployeeBankAccount = async (req: Request<{ bankAccountId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteEmployeeBankAccount.execute({
            bankAccountId: req.params.bankAccountId,
            actorUserId:   ActorContext.get(res),
        });
        res.status(200).end();
    };
}
