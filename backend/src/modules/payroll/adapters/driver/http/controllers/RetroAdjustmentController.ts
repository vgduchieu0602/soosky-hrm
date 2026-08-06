import RetroAdjustmentPresenter from "@modules/payroll/adapters/driver/http/presenters/RetroAdjustmentPresenter";
import CancelRetroAdjustmentUseCase from "@modules/payroll/core/app/use-cases/retro/CancelRetroAdjustmentUseCase";
import CreateRetroAdjustmentUseCase from "@modules/payroll/core/app/use-cases/retro/CreateRetroAdjustmentUseCase";
import ListRetroAdjustmentsUseCase from "@modules/payroll/core/app/use-cases/retro/ListRetroAdjustmentsUseCase";
import { RETRO_KINDS, RetroKind } from "@modules/payroll/core/domain/entities/RetroAdjustment";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import BadRequestError from "@shared/adapters/driver/http/errors/BadRequestError";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface RetroAdjustmentControllerUseCases {
    createRetroAdjustment: CreateRetroAdjustmentUseCase;
    listRetroAdjustments:  ListRetroAdjustmentsUseCase;
    cancelRetroAdjustment: CancelRetroAdjustmentUseCase;
}

const bodySchemaCreate = bodySchema({
    employeeId:     field.string,
    kind:           field.string,
    amount:         field.number,
    originPeriodId: field.string,
    payoutPeriodId: field.string,
    reason:         field.string,
});

const bodySchemaCancel = bodySchema({
    reason: field.string,
});

function parseKind(raw: string): RetroKind {
    if (!(RETRO_KINDS as readonly string[]).includes(raw)) {
        throw new BadRequestError(`kind must be one of: ${RETRO_KINDS.join(", ")}`);
    }
    return raw as RetroKind;
}

/** Controller nhóm endpoint điều chỉnh hồi tố (truy lĩnh/truy thu). */
export default class RetroAdjustmentController {
    public constructor(
        private readonly _useCases: RetroAdjustmentControllerUseCases,
    ) {}

    public createRetroAdjustment = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaCreate.parse(req.body);
        const raw = req.body as Record<string, unknown>;
        const taxable = typeof raw.taxable === "boolean" ? raw.taxable : undefined;

        const adjustment = await this._useCases.createRetroAdjustment.execute({
            ...body,
            kind: parseKind(body.kind),
            ...(taxable != undefined ? { taxable } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(RetroAdjustmentPresenter.toDTO(adjustment));
    };

    public listRetroAdjustments = async (req: Request, res: Response): Promise<void> => {
        const query = req.query as Record<string, unknown>;
        const adjustments = await this._useCases.listRetroAdjustments.execute({
            employeeId:     typeof query.employeeId === "string" ? query.employeeId : undefined,
            payoutPeriodId: typeof query.payoutPeriodId === "string" ? query.payoutPeriodId : undefined,
            originPeriodId: typeof query.originPeriodId === "string" ? query.originPeriodId : undefined,
        });
        res.status(200).json({ retroAdjustments: adjustments.map(RetroAdjustmentPresenter.toDTO) });
    };

    public cancelRetroAdjustment = async (req: Request<{ adjustmentId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaCancel.parse(req.body);
        await this._useCases.cancelRetroAdjustment.execute({
            adjustmentId: req.params.adjustmentId,
            reason:       body.reason,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).end();
    };
}
