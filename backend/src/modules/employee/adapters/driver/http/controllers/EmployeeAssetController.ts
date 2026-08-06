import EmployeeAssetPresenter from "@modules/employee/adapters/driver/http/presenters/EmployeeAssetPresenter";
import CreateEmployeeAssetUseCase from "@modules/employee/core/app/use-cases/asset/CreateEmployeeAssetUseCase";
import DeleteEmployeeAssetUseCase from "@modules/employee/core/app/use-cases/asset/DeleteEmployeeAssetUseCase";
import ListEmployeeAssetsUseCase from "@modules/employee/core/app/use-cases/asset/ListEmployeeAssetsUseCase";
import UpdateEmployeeAssetUseCase from "@modules/employee/core/app/use-cases/asset/UpdateEmployeeAssetUseCase";
import { AssetCondition } from "@modules/employee/core/domain/entities/EmployeeAsset";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface EmployeeAssetControllerUseCases {
    createEmployeeAsset: CreateEmployeeAssetUseCase;
    updateEmployeeAsset: UpdateEmployeeAssetUseCase;
    deleteEmployeeAsset: DeleteEmployeeAssetUseCase;
    listEmployeeAssets:  ListEmployeeAssetsUseCase;
}

const bodySchemaCreateAsset = bodySchema({
    assetName:    field.string,
    assetCode:    field.string,
    assignedDate: field.date,
    condition:    field.optionalString,
    note:         field.optionalString,
});

const bodySchemaUpdateAsset = bodySchema({
    returnedDate: field.optionalDate,
    condition:    field.optionalString,
    note:         field.optionalString,
});

/** Controller nhóm endpoint tài sản công ty cấp phát cho nhân viên. */
export default class EmployeeAssetController {
    public constructor(
        private readonly _useCases: EmployeeAssetControllerUseCases,
    ) {}

    public createEmployeeAsset = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaCreateAsset.parse(req.body);
        const output = await this._useCases.createEmployeeAsset.execute({
            ...body,
            condition:   body.condition as AssetCondition | undefined,
            employeeId:  req.params.employeeId,
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listEmployeeAssets = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const assets = await this._useCases.listEmployeeAssets.execute({ employeeId: req.params.employeeId, actorUserId: ActorContext.get(res) });
        res.status(200).json({ assets: assets.map(EmployeeAssetPresenter.toDTO) });
    };

    public updateEmployeeAsset = async (req: Request<{ assetId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaUpdateAsset.parse(req.body);
        await this._useCases.updateEmployeeAsset.execute({
            ...body,
            condition:   body.condition as AssetCondition | undefined,
            assetId:     req.params.assetId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteEmployeeAsset = async (req: Request<{ assetId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteEmployeeAsset.execute({
            assetId:     req.params.assetId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };
}
