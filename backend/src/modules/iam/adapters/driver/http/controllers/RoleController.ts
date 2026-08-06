import RolePresenter from "@modules/iam/adapters/driver/http/presenters/RolePresenter";
import SetRolePermissionsUseCase from "@modules/iam/core/app/use-cases/assignment/SetRolePermissionsUseCase";
import CreateRoleUseCase from "@modules/iam/core/app/use-cases/role/CreateRoleUseCase";
import DeleteRoleUseCase from "@modules/iam/core/app/use-cases/role/DeleteRoleUseCase";
import GetRoleUseCase from "@modules/iam/core/app/use-cases/role/GetRoleUseCase";
import ListRolePermissionsUseCase from "@modules/iam/core/app/use-cases/role/ListRolePermissionsUseCase";
import ListRolesUseCase from "@modules/iam/core/app/use-cases/role/ListRolesUseCase";
import UpdateRoleUseCase from "@modules/iam/core/app/use-cases/role/UpdateRoleUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import BadRequestError from "@shared/adapters/driver/http/errors/BadRequestError";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface RoleControllerUseCases {
    listRoles:           ListRolesUseCase;
    getRole:             GetRoleUseCase;
    createRole:          CreateRoleUseCase;
    updateRole:          UpdateRoleUseCase;
    deleteRole:          DeleteRoleUseCase;
    setRolePermissions:  SetRolePermissionsUseCase;
    listRolePermissions: ListRolePermissionsUseCase;
}

const bodySchemaCreateRole = bodySchema({
    key:         field.string,
    name:        field.string,
    description: field.optionalString,
});

const bodySchemaUpdateRole = bodySchema({
    name:        field.optionalString,
    description: field.optionalString,
});

/**
 * Controller cho nhóm endpoint Role + đặt quyền hạn của role
 * (docs/share-docs/use-cases.html § IAM): parse request, gọi use-case tương
 * ứng rồi ghi response — không chứa nghiệp vụ.
 */
export default class RoleController {
    public constructor(
        private readonly _useCases: RoleControllerUseCases,
    ) {}

    public listRoles = async (_req: Request, res: Response): Promise<void> => {
        const roles = await this._useCases.listRoles.execute({
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json({ roles: roles.map(role => RolePresenter.toDTO(role)) });
    };

    public getRole = async (req: Request<{ roleId: string }>, res: Response): Promise<void> => {
        const role = await this._useCases.getRole.execute({
            actorUserId: ActorContext.get(res),
            roleId:      req.params.roleId,
        });
        res.status(200).json({ role: RolePresenter.toDTO(role) });
    };

    public createRole = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaCreateRole.parse(req.body);
        const role = await this._useCases.createRole.execute({
            actorUserId: ActorContext.get(res),
            key:         body.key,
            name:        body.name,
            description: body.description ?? "",
        });
        res.status(201).json({ role: RolePresenter.toDTO(role) });
    };

    public updateRole = async (req: Request<{ roleId: string }>, res: Response): Promise<void> => {
        const role = await this._useCases.updateRole.execute({
            ...bodySchemaUpdateRole.parse(req.body),
            actorUserId: ActorContext.get(res),
            roleId:      req.params.roleId,
        });
        res.status(200).json({ role: RolePresenter.toDTO(role) });
    };

    public deleteRole = async (req: Request<{ roleId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteRole.execute({
            actorUserId: ActorContext.get(res),
            roleId:      req.params.roleId,
        });
        res.status(204).end();
    };

    public listRolePermissions = async (req: Request<{ roleId: string }>, res: Response): Promise<void> => {
        const output = await this._useCases.listRolePermissions.execute({
            actorUserId: ActorContext.get(res),
            roleId:      req.params.roleId,
        });
        res.status(200).json(output);
    };

    public setRolePermissions = async (req: Request<{ roleId: string }>, res: Response): Promise<void> => {
        const permissionIds = req.body?.permissionIds;
        if (!Array.isArray(permissionIds) || permissionIds.some(id => typeof id !== "string")) {
            throw new BadRequestError("'permissionIds' must be an array of strings");
        }

        await this._useCases.setRolePermissions.execute({
            actorUserId:   ActorContext.get(res),
            roleId:        req.params.roleId,
            permissionIds: permissionIds as string[],
        });
        res.status(200).end();
    };
}
