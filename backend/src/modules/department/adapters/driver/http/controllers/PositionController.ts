import PositionPresenter from "@modules/department/adapters/driver/http/presenters/PositionPresenter";
import ArchivePositionUseCase from "@modules/department/core/app/use-cases/position/ArchivePositionUseCase";
import CreatePositionUseCase from "@modules/department/core/app/use-cases/position/CreatePositionUseCase";
import DeletePositionUseCase from "@modules/department/core/app/use-cases/position/DeletePositionUseCase";
import GetPositionUseCase from "@modules/department/core/app/use-cases/position/GetPositionUseCase";
import ListPositionsUseCase from "@modules/department/core/app/use-cases/position/ListPositionsUseCase";
import UpdatePositionUseCase from "@modules/department/core/app/use-cases/position/UpdatePositionUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface PositionControllerUseCases {
    createPosition:  CreatePositionUseCase;
    updatePosition:  UpdatePositionUseCase;
    getPosition:     GetPositionUseCase;
    listPositions:   ListPositionsUseCase;
    archivePosition: ArchivePositionUseCase;
    deletePosition:  DeletePositionUseCase;
}

const bodySchemaCreatePosition = bodySchema({
    code:         field.string,
    title:        field.string,
    departmentId: field.string,
    level:        field.optionalNumber,
    description:  field.optionalString,
});

const bodySchemaUpdatePosition = bodySchema({
    title:        field.optionalString,
    departmentId: field.optionalString,
    level:        field.optionalNumber,
    description:  field.optionalString,
    status:       field.optionalString,
});

/**
 * Controller nhóm endpoint Position.
 */
export default class PositionController {
    public constructor(
        private readonly _useCases: PositionControllerUseCases,
    ) {}

    public createPosition = async (req: Request, res: Response): Promise<void> => {
        const output = await this._useCases.createPosition.execute({
            ...bodySchemaCreatePosition.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listPositions = async (req: Request, res: Response): Promise<void> => {
        const filter: { departmentId?: string; status?: string } = {};
        if (typeof req.query.departmentId === "string") filter.departmentId = req.query.departmentId;
        if (typeof req.query.status === "string")       filter.status = req.query.status;

        const positions = await this._useCases.listPositions.execute(filter);
        res.status(200).json({ positions: positions.map(position => PositionPresenter.toDTO(position)) });
    };

    public getPosition = async (req: Request<{ positionId: string }>, res: Response): Promise<void> => {
        const position = await this._useCases.getPosition.execute({ positionId: req.params.positionId });
        res.status(200).json(PositionPresenter.toDTO(position));
    };

    public updatePosition = async (req: Request<{ positionId: string }>, res: Response): Promise<void> => {
        await this._useCases.updatePosition.execute({
            ...bodySchemaUpdatePosition.parse(req.body),
            positionId:  req.params.positionId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public archivePosition = async (req: Request<{ positionId: string }>, res: Response): Promise<void> => {
        await this._useCases.archivePosition.execute({
            positionId:  req.params.positionId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deletePosition = async (req: Request<{ positionId: string }>, res: Response): Promise<void> => {
        await this._useCases.deletePosition.execute({
            positionId:  req.params.positionId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };
}
