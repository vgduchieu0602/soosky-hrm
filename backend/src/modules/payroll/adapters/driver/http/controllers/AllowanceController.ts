import AllowancePresenter from "@modules/payroll/adapters/driver/http/presenters/AllowancePresenter";
import { ALLOWANCE_TYPES, AllowanceType } from "@modules/payroll/core/domain/entities/Allowance";
import CreateAllowanceUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateAllowanceUseCase";
import DeleteAllowanceUseCase from "@modules/payroll/core/app/use-cases/compensation/DeleteAllowanceUseCase";
import ListAllowancesByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListAllowancesByEmployeeUseCase";
import UpdateAllowanceUseCase from "@modules/payroll/core/app/use-cases/compensation/UpdateAllowanceUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import BadRequestError from "@shared/adapters/driver/http/errors/BadRequestError";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface AllowanceControllerUseCases {
    createAllowance: CreateAllowanceUseCase;
    updateAllowance: UpdateAllowanceUseCase;
    deleteAllowance: DeleteAllowanceUseCase;
    listAllowancesByEmployee: ListAllowancesByEmployeeUseCase;
}

function parseType(raw: unknown): AllowanceType {
    if (typeof raw === "string" && (ALLOWANCE_TYPES as readonly string[]).includes(raw)) return raw as AllowanceType;
    throw new BadRequestError(`'type' must be one of: ${ALLOWANCE_TYPES.join(", ")}`);
}

function parseOptionalType(raw: unknown): AllowanceType | undefined {
    return raw == undefined ? undefined : parseType(raw);
}

function parseOptionalBoolean(raw: unknown): boolean | undefined {
    return typeof raw === "boolean" ? raw : undefined;
}

const bodySchemaCreate = bodySchema({
    employeeId:    field.string,
    name:          field.string,
    amount:        field.number,
    effectiveDate: field.date,
    endDate:       field.optionalDate,
});

const bodySchemaUpdate = bodySchema({
    name:          field.optionalString,
    amount:        field.optionalNumber,
    effectiveDate: field.optionalDate,
    endDate:       field.optionalDate,
});

/** Controller nhóm endpoint Allowance (phụ cấp). */
export default class AllowanceController {
    public constructor(
        private readonly _useCases: AllowanceControllerUseCases,
    ) {}

    public createAllowance = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaCreate.parse(req.body);
        const raw = req.body as Record<string, unknown>;
        const isTaxable = parseOptionalBoolean(raw.isTaxable);
        const isInsuranceBase = parseOptionalBoolean(raw.isInsuranceBase);
        const allowance = await this._useCases.createAllowance.execute({
            ...body,
            type: parseType(raw.type),
            ...(isTaxable != undefined ? { isTaxable } : {}),
            ...(isInsuranceBase != undefined ? { isInsuranceBase } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(AllowancePresenter.toDTO(allowance));
    };

    public updateAllowance = async (req: Request<{ allowanceId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaUpdate.parse(req.body);
        const raw = req.body as Record<string, unknown>;
        const type = parseOptionalType(raw.type);
        const isTaxable = parseOptionalBoolean(raw.isTaxable);
        const isInsuranceBase = parseOptionalBoolean(raw.isInsuranceBase);
        await this._useCases.updateAllowance.execute({
            ...body,
            allowanceId: req.params.allowanceId,
            ...(type != undefined ? { type } : {}),
            ...(isTaxable != undefined ? { isTaxable } : {}),
            ...(isInsuranceBase != undefined ? { isInsuranceBase } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteAllowance = async (req: Request<{ allowanceId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteAllowance.execute({ allowanceId: req.params.allowanceId, actorUserId: ActorContext.get(res) });
        res.status(200).end();
    };

    public listAllowancesByEmployee = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const allowances = await this._useCases.listAllowancesByEmployee.execute({ employeeId: req.params.employeeId });
        res.status(200).json({ allowances: allowances.map(AllowancePresenter.toDTO) });
    };
}
