import AppraisalCyclePresenter from "@modules/performance/adapters/driver/http/presenters/AppraisalCyclePresenter";
import ActivateAppraisalCycleUseCase from "@modules/performance/core/app/use-cases/cycle/ActivateAppraisalCycleUseCase";
import CloseAppraisalCycleUseCase from "@modules/performance/core/app/use-cases/cycle/CloseAppraisalCycleUseCase";
import CreateAppraisalCycleUseCase from "@modules/performance/core/app/use-cases/cycle/CreateAppraisalCycleUseCase";
import GetCycleReadinessUseCase from "@modules/performance/core/app/use-cases/cycle/GetCycleReadinessUseCase";
import ListAppraisalCyclesUseCase from "@modules/performance/core/app/use-cases/cycle/ListAppraisalCyclesUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface AppraisalCycleControllerUseCases {
    createAppraisalCycle:   CreateAppraisalCycleUseCase;
    activateAppraisalCycle: ActivateAppraisalCycleUseCase;
    closeAppraisalCycle:    CloseAppraisalCycleUseCase;
    getCycleReadiness:      GetCycleReadinessUseCase;
    listAppraisalCycles:    ListAppraisalCyclesUseCase;
}

const bodySchemaCreateCycle = bodySchema({
    name:            field.string,
    payrollPeriodId: field.string,
    criteriaSetId:   field.string,
    criteriaVersion: field.optionalNumber,
});

const bodySchemaActivateCycle = bodySchema({
    fallbackReviewerUserId: field.optionalString,
});

/** Controller nhóm endpoint chu kỳ đánh giá. */
export default class AppraisalCycleController {
    public constructor(
        private readonly _useCases: AppraisalCycleControllerUseCases,
    ) {}

    public createCycle = async (req: Request, res: Response): Promise<void> => {
        const output = await this._useCases.createAppraisalCycle.execute({
            ...bodySchemaCreateCycle.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listCycles = async (_req: Request, res: Response): Promise<void> => {
        const cycles = await this._useCases.listAppraisalCycles.execute({ actorUserId: ActorContext.get(res) });
        res.status(200).json({ cycles: cycles.map(AppraisalCyclePresenter.toDTO) });
    };

    public activateCycle = async (req: Request<{ cycleId: string }>, res: Response): Promise<void> => {
        const body   = bodySchemaActivateCycle.parse(req.body ?? {});
        const output = await this._useCases.activateAppraisalCycle.execute({
            cycleId: req.params.cycleId,
            ...(body.fallbackReviewerUserId != undefined ? { fallbackReviewerUserId: body.fallbackReviewerUserId } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json(output);
    };

    public getReadiness = async (req: Request<{ cycleId: string }>, res: Response): Promise<void> => {
        const output = await this._useCases.getCycleReadiness.execute({
            cycleId:     req.params.cycleId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json(output);
    };

    public closeCycle = async (req: Request<{ cycleId: string }>, res: Response): Promise<void> => {
        await this._useCases.closeAppraisalCycle.execute({
            cycleId:     req.params.cycleId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };
}
