import EmployeeContractPresenter from "@modules/employee/adapters/driver/http/presenters/EmployeeContractPresenter";
import CreateEmployeeContractUseCase from "@modules/employee/core/app/use-cases/contract/CreateEmployeeContractUseCase";
import DeleteEmployeeContractUseCase from "@modules/employee/core/app/use-cases/contract/DeleteEmployeeContractUseCase";
import ListEmployeeContractsUseCase from "@modules/employee/core/app/use-cases/contract/ListEmployeeContractsUseCase";
import UpdateEmployeeContractUseCase from "@modules/employee/core/app/use-cases/contract/UpdateEmployeeContractUseCase";
import { ContractStatus, ContractType, EmploymentStatus } from "@modules/employee/core/domain/entities/EmployeeContract";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface EmployeeContractControllerUseCases {
    createEmployeeContract: CreateEmployeeContractUseCase;
    updateEmployeeContract: UpdateEmployeeContractUseCase;
    deleteEmployeeContract: DeleteEmployeeContractUseCase;
    listEmployeeContracts:  ListEmployeeContractsUseCase;
}

const bodySchemaCreateContract = bodySchema({
    contractType:     field.string,
    employmentStatus: field.string,
    contractNumber:   field.string,
    startDate:        field.date,
    endDate:          field.optionalDate,
    baseSalary:       field.number,
    currency:         field.optionalString,
    fileUrl:          field.optionalString,
    status:           field.optionalString,
});

const bodySchemaUpdateContract = bodySchema({
    employmentStatus: field.optionalString,
    endDate:          field.optionalDate,
    baseSalary:       field.optionalNumber,
    fileUrl:          field.optionalString,
    status:           field.optionalString,
});

/** Controller nhóm endpoint hợp đồng lao động của nhân viên. */
export default class EmployeeContractController {
    public constructor(
        private readonly _useCases: EmployeeContractControllerUseCases,
    ) {}

    public createEmployeeContract = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaCreateContract.parse(req.body);
        const output = await this._useCases.createEmployeeContract.execute({
            ...body,
            contractType:     body.contractType as ContractType,
            employmentStatus: body.employmentStatus as EmploymentStatus,
            status:           body.status as ContractStatus | undefined,
            employeeId:       req.params.employeeId,
            actorUserId:      ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listEmployeeContracts = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const contracts = await this._useCases.listEmployeeContracts.execute({ employeeId: req.params.employeeId });
        res.status(200).json({ contracts: contracts.map(EmployeeContractPresenter.toDTO) });
    };

    public updateEmployeeContract = async (req: Request<{ contractId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaUpdateContract.parse(req.body);
        await this._useCases.updateEmployeeContract.execute({
            ...body,
            employmentStatus: body.employmentStatus as EmploymentStatus | undefined,
            status:           body.status as ContractStatus | undefined,
            contractId:       req.params.contractId,
            actorUserId:      ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteEmployeeContract = async (req: Request<{ contractId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteEmployeeContract.execute({
            contractId:  req.params.contractId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };
}
