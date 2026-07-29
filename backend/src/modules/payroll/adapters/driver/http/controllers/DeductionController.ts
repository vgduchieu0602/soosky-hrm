import DeductionPresenter from "@modules/payroll/adapters/driver/http/presenters/DeductionPresenter";
import { DEDUCTION_TYPES, DeductionType } from "@modules/payroll/core/domain/entities/Deduction";
import CreateDeductionUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateDeductionUseCase";
import DeleteDeductionUseCase from "@modules/payroll/core/app/use-cases/compensation/DeleteDeductionUseCase";
import ListDeductionsByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListDeductionsByEmployeeUseCase";
import UpdateDeductionUseCase from "@modules/payroll/core/app/use-cases/compensation/UpdateDeductionUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import BadRequestError from "@shared/adapters/driver/http/errors/BadRequestError";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface DeductionControllerUseCases {
    createDeduction: CreateDeductionUseCase;
    updateDeduction: UpdateDeductionUseCase;
    deleteDeduction: DeleteDeductionUseCase;
    listDeductionsByEmployee: ListDeductionsByEmployeeUseCase;
}

function parseType(raw: unknown): DeductionType {
    if (typeof raw === "string" && (DEDUCTION_TYPES as readonly string[]).includes(raw)) return raw as DeductionType;
    throw new BadRequestError(`'type' must be one of: ${DEDUCTION_TYPES.join(", ")}`);
}

function parseOptionalType(raw: unknown): DeductionType | undefined {
    return raw == undefined ? undefined : parseType(raw);
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

/** Controller nhóm endpoint Deduction (khấu trừ). */
export default class DeductionController {
    public constructor(
        private readonly _useCases: DeductionControllerUseCases,
    ) {}

    public createDeduction = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaCreate.parse(req.body);
        const raw = req.body as Record<string, unknown>;
        const payrollPeriodId = typeof raw.payrollPeriodId === "string" ? raw.payrollPeriodId : undefined;
        const reason = typeof raw.reason === "string" ? raw.reason : undefined;
        const deduction = await this._useCases.createDeduction.execute({
            ...body,
            type: parseType(raw.type),
            ...(payrollPeriodId != undefined ? { payrollPeriodId } : {}),
            ...(reason != undefined ? { reason } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(DeductionPresenter.toDTO(deduction));
    };

    public updateDeduction = async (req: Request<{ deductionId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaUpdate.parse(req.body);
        const raw = req.body as Record<string, unknown>;
        const type = parseOptionalType(raw.type);
        const payrollPeriodId = typeof raw.payrollPeriodId === "string" ? raw.payrollPeriodId : undefined;
        const reason = typeof raw.reason === "string" ? raw.reason : undefined;
        await this._useCases.updateDeduction.execute({
            ...body,
            deductionId: req.params.deductionId,
            ...(type != undefined ? { type } : {}),
            ...(payrollPeriodId != undefined ? { payrollPeriodId } : {}),
            ...(reason != undefined ? { reason } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteDeduction = async (req: Request<{ deductionId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteDeduction.execute({ deductionId: req.params.deductionId, actorUserId: ActorContext.get(res) });
        res.status(200).end();
    };

    public listDeductionsByEmployee = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const deductions = await this._useCases.listDeductionsByEmployee.execute({ employeeId: req.params.employeeId });
        res.status(200).json({ deductions: deductions.map(DeductionPresenter.toDTO) });
    };
}
