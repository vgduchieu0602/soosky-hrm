import PermissionPresenter from "@modules/iam/adapters/driver/http/presenters/PermissionPresenter";
import ListPermissionsUseCase from "@modules/iam/core/app/use-cases/permission/ListPermissionsUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { Request, Response } from "express";

export interface PermissionControllerUseCases {
    listPermissions: ListPermissionsUseCase;
}

/**
 * Controller cho endpoint catalog Permission — chỉ đọc.
 */
export default class PermissionController {
    public constructor(
        private readonly _useCases: PermissionControllerUseCases,
    ) {}

    public listPermissions = async (_req: Request, res: Response): Promise<void> => {
        const permissions = await this._useCases.listPermissions.execute({
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json({ permissions: permissions.map(permission => PermissionPresenter.toDTO(permission)) });
    };
}
