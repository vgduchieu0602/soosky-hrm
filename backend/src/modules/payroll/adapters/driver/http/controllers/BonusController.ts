import BonusPresenter from "@modules/payroll/adapters/driver/http/presenters/BonusPresenter";
import CreateBonusUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateBonusUseCase";
import DeleteBonusUseCase from "@modules/payroll/core/app/use-cases/compensation/DeleteBonusUseCase";
import ListBonusesByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListBonusesByEmployeeUseCase";
import UpdateBonusUseCase from "@modules/payroll/core/app/use-cases/compensation/UpdateBonusUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface BonusControllerUseCases {
    createBonus: CreateBonusUseCase;
    updateBonus: UpdateBonusUseCase;
    deleteBonus: DeleteBonusUseCase;
    listBonusesByEmployee: ListBonusesByEmployeeUseCase;
}

function parseOptionalBoolean(raw: unknown): boolean | undefined {
    return typeof raw === "boolean" ? raw : undefined;
}

const bodySchemaCreate = bodySchema({
    employeeId:      field.string,
    payrollPeriodId: field.string,
    name:            field.string,
    amount:          field.number,
});

const bodySchemaUpdate = bodySchema({
    name:   field.optionalString,
    amount: field.optionalNumber,
});

/** Controller nhóm endpoint Bonus (thưởng). */
export default class BonusController {
    public constructor(
        private readonly _useCases: BonusControllerUseCases,
    ) {}

    public createBonus = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaCreate.parse(req.body);
        const raw = req.body as Record<string, unknown>;
        const isTaxable = parseOptionalBoolean(raw.isTaxable);
        const reason = typeof raw.reason === "string" ? raw.reason : undefined;
        const bonus = await this._useCases.createBonus.execute({
            ...body,
            ...(isTaxable != undefined ? { isTaxable } : {}),
            ...(reason != undefined ? { reason } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(BonusPresenter.toDTO(bonus));
    };

    public updateBonus = async (req: Request<{ bonusId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaUpdate.parse(req.body);
        const raw = req.body as Record<string, unknown>;
        const isTaxable = parseOptionalBoolean(raw.isTaxable);
        const reason = typeof raw.reason === "string" ? raw.reason : undefined;
        await this._useCases.updateBonus.execute({
            ...body,
            bonusId: req.params.bonusId,
            ...(isTaxable != undefined ? { isTaxable } : {}),
            ...(reason != undefined ? { reason } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteBonus = async (req: Request<{ bonusId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteBonus.execute({ bonusId: req.params.bonusId, actorUserId: ActorContext.get(res) });
        res.status(200).end();
    };

    public listBonusesByEmployee = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const bonuses = await this._useCases.listBonusesByEmployee.execute({ employeeId: req.params.employeeId });
        res.status(200).json({ bonuses: bonuses.map(BonusPresenter.toDTO) });
    };
}
