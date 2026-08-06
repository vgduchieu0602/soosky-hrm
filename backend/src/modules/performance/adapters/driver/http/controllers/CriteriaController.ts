import CriteriaSetPresenter from "@modules/performance/adapters/driver/http/presenters/CriteriaSetPresenter";
import CreateCriteriaSetUseCase from "@modules/performance/core/app/use-cases/criteria/CreateCriteriaSetUseCase";
import ListCriteriaSetsUseCase from "@modules/performance/core/app/use-cases/criteria/ListCriteriaSetsUseCase";
import PublishCriteriaVersionUseCase from "@modules/performance/core/app/use-cases/criteria/PublishCriteriaVersionUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import BadRequestError from "@shared/adapters/driver/http/errors/BadRequestError";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface CriteriaControllerUseCases {
    createCriteriaSet:      CreateCriteriaSetUseCase;
    publishCriteriaVersion: PublishCriteriaVersionUseCase;
    listCriteriaSets:       ListCriteriaSetsUseCase;
}

const bodySchemaCreateCriteriaSet = bodySchema({
    name:        field.string,
    description: field.optionalString,
});

/** Controller nhóm endpoint bộ tiêu chí đánh giá. */
export default class CriteriaController {
    public constructor(
        private readonly _useCases: CriteriaControllerUseCases,
    ) {}

    public createCriteriaSet = async (req: Request, res: Response): Promise<void> => {
        const output = await this._useCases.createCriteriaSet.execute({
            ...bodySchemaCreateCriteriaSet.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listCriteriaSets = async (_req: Request, res: Response): Promise<void> => {
        const criteriaSets = await this._useCases.listCriteriaSets.execute({ actorUserId: ActorContext.get(res) });
        res.status(200).json({ criteriaSets: criteriaSets.map(CriteriaSetPresenter.toDTO) });
    };

    public publishCriteriaVersion = async (req: Request<{ criteriaSetId: string }>, res: Response): Promise<void> => {
        const output = await this._useCases.publishCriteriaVersion.execute({
            criteriaSetId: req.params.criteriaSetId,
            criteria:      parseCriteria((req.body as Record<string, unknown>)?.criteria),
            actorUserId:   ActorContext.get(res),
        });
        res.status(201).json(output);
    };
}

/**
 * Parse mảng tiêu chí thủ công: `bodySchema` chỉ xử lý field phẳng, còn đây là
 * mảng object. Kiểm ngay ở biên để use-case không phải phòng thủ với `unknown`.
 */
function parseCriteria(raw: unknown): { code: string; name: string; kind: string; weight: number }[] {
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new BadRequestError("'criteria' must be a non-empty array");
    }

    return raw.map((entry, index) => {
        const item = entry as Record<string, unknown>;
        const code   = item.code;
        const name   = item.name;
        const kind   = item.kind;
        const weight = item.weight;

        if (typeof code !== "string" || typeof name !== "string" || typeof kind !== "string" || typeof weight !== "number") {
            throw new BadRequestError(`criteria[${index}] must have string code/name/kind and numeric weight`);
        }
        return { code, name, kind, weight };
    });
}
