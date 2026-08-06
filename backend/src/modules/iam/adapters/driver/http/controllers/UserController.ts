import UserPresenter from "@modules/iam/adapters/driver/http/presenters/UserPresenter";
import UserRolePresenter from "@modules/iam/adapters/driver/http/presenters/UserRolePresenter";
import AssignRoleToUserUseCase from "@modules/iam/core/app/use-cases/assignment/AssignRoleToUserUseCase";
import ListUserRolesUseCase from "@modules/iam/core/app/use-cases/assignment/ListUserRolesUseCase";
import RevokeRoleFromUserUseCase from "@modules/iam/core/app/use-cases/assignment/RevokeRoleFromUserUseCase";
import GetMyPermissionsUseCase from "@modules/iam/core/app/use-cases/user/GetMyPermissionsUseCase";
import GetUserPermissionsUseCase from "@modules/iam/core/app/use-cases/user/GetUserPermissionsUseCase";
import GetUserUseCase from "@modules/iam/core/app/use-cases/user/GetUserUseCase";
import ListUsersUseCase from "@modules/iam/core/app/use-cases/user/ListUsersUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface UserControllerUseCases {
    listUsers:           ListUsersUseCase;
    getUser:             GetUserUseCase;
    getUserPermissions:  GetUserPermissionsUseCase;
    getMyPermissions:    GetMyPermissionsUseCase;
    listUserRoles:       ListUserRolesUseCase;
    assignRoleToUser:    AssignRoleToUserUseCase;
    revokeRoleFromUser:  RevokeRoleFromUserUseCase;
}

const bodySchemaAssignRole = bodySchema({
    roleId: field.string,
});

/**
 * Controller cho nhóm endpoint User + gán/thu hồi role của user
 * (docs/share-docs/use-cases.html § IAM): parse request, gọi use-case tương
 * ứng rồi ghi response — không chứa nghiệp vụ.
 *
 * Handler khai báo dạng arrow property để giữ `this` khi được truyền rời
 * instance vào danh sách route của `createIamHttpRouter`.
 */
export default class UserController {
    public constructor(
        private readonly _useCases: UserControllerUseCases,
    ) {}

    public listUsers = async (_req: Request, res: Response): Promise<void> => {
        const users = await this._useCases.listUsers.execute({
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json({ users: users.map(user => UserPresenter.toDTO(user)) });
    };

    public getUser = async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
        const user = await this._useCases.getUser.execute({
            actorUserId: ActorContext.get(res),
            userId:      req.params.userId,
        });
        res.status(200).json({ user: UserPresenter.toDTO(user) });
    };

    /** Quyền hạn của chính actor — frontend dùng để hiện đúng menu/nút. */
    public getMyPermissions = async (_req: Request, res: Response): Promise<void> => {
        const permissions = await this._useCases.getMyPermissions.execute({
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json({ permissions });
    };

    public getUserPermissions = async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
        const permissions = await this._useCases.getUserPermissions.execute({
            actorUserId: ActorContext.get(res),
            userId:      req.params.userId,
        });
        res.status(200).json({ permissions });
    };

    public listUserRoles = async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
        const userRoles = await this._useCases.listUserRoles.execute({
            actorUserId: ActorContext.get(res),
            userId:      req.params.userId,
        });
        res.status(200).json({ userRoles: userRoles.map(userRole => UserRolePresenter.toDTO(userRole)) });
    };

    public assignRoleToUser = async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
        const userRole = await this._useCases.assignRoleToUser.execute({
            ...bodySchemaAssignRole.parse(req.body),
            actorUserId: ActorContext.get(res),
            userId:      req.params.userId,
        });
        res.status(201).json({ userRole: UserRolePresenter.toDTO(userRole) });
    };

    public revokeRoleFromUser = async (req: Request<{ userId: string; roleId: string }>, res: Response): Promise<void> => {
        await this._useCases.revokeRoleFromUser.execute({
            actorUserId: ActorContext.get(res),
            userId:      req.params.userId,
            roleId:      req.params.roleId,
        });
        res.status(204).end();
    };
}
