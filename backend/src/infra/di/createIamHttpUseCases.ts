import { MongoAuditRepo, MongoPermissionRepo, MongoRolePermissionRepo, MongoRoleRepo, MongoUnitOfWork, MongoUserRepo, MongoUserRoleRepo } from "@modules/iam/adapters/driven/persistence/mongodb";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import ListAuditLogsUseCase from "@modules/iam/core/app/use-cases/audit/ListAuditLogsUseCase";
import AssignRoleToUserUseCase from "@modules/iam/core/app/use-cases/assignment/AssignRoleToUserUseCase";
import ListUserRolesUseCase from "@modules/iam/core/app/use-cases/assignment/ListUserRolesUseCase";
import RevokeRoleFromUserUseCase from "@modules/iam/core/app/use-cases/assignment/RevokeRoleFromUserUseCase";
import SetRolePermissionsUseCase from "@modules/iam/core/app/use-cases/assignment/SetRolePermissionsUseCase";
import ListPermissionsUseCase from "@modules/iam/core/app/use-cases/permission/ListPermissionsUseCase";
import CreateRoleUseCase from "@modules/iam/core/app/use-cases/role/CreateRoleUseCase";
import DeleteRoleUseCase from "@modules/iam/core/app/use-cases/role/DeleteRoleUseCase";
import GetRoleUseCase from "@modules/iam/core/app/use-cases/role/GetRoleUseCase";
import ListRolePermissionsUseCase from "@modules/iam/core/app/use-cases/role/ListRolePermissionsUseCase";
import ListRolesUseCase from "@modules/iam/core/app/use-cases/role/ListRolesUseCase";
import UpdateRoleUseCase from "@modules/iam/core/app/use-cases/role/UpdateRoleUseCase";
import GetMyPermissionsUseCase from "@modules/iam/core/app/use-cases/user/GetMyPermissionsUseCase";
import GetUserPermissionsUseCase from "@modules/iam/core/app/use-cases/user/GetUserPermissionsUseCase";
import GetUserUseCase from "@modules/iam/core/app/use-cases/user/GetUserUseCase";
import ListUsersUseCase from "@modules/iam/core/app/use-cases/user/ListUsersUseCase";
import { IamHttpUseCases } from "@modules/iam";
import { Db as MongoDb, MongoClient } from "mongodb";

/**
 * Lắp ráp toàn bộ use-case mà driver adapter HTTP của module IAM cần
 * (`IamHttpUseCases`), trên các adapter MongoDB.
 *
 * `AccessControl` được chia sẻ giữa mọi use-case mutating — cùng một cách
 * giải quyết quyền hạn hiệu lực cho toàn module. Index của các collection do
 * bước `ensureMongoIndexes` lúc khởi động đảm nhiệm.
 */
export default function createIamHttpUseCases(
    mongoClient: MongoClient,
    mongoDb: MongoDb,
): IamHttpUseCases {
    const userRepo           = new MongoUserRepo(mongoDb);
    const roleRepo           = new MongoRoleRepo(mongoDb);
    const permissionRepo     = new MongoPermissionRepo(mongoDb);
    const userRoleRepo       = new MongoUserRoleRepo(mongoDb);
    const rolePermissionRepo = new MongoRolePermissionRepo(mongoDb);
    const auditRepo          = new MongoAuditRepo(mongoDb);
    const uow                = new MongoUnitOfWork(mongoClient, mongoDb);

    const accessControl = new AccessControl(userRoleRepo, rolePermissionRepo, permissionRepo);

    return {
        // User
        listUsers:          new ListUsersUseCase(accessControl, userRepo),
        getUser:            new GetUserUseCase(accessControl, userRepo),
        getUserPermissions: new GetUserPermissionsUseCase(accessControl, userRepo),
        getMyPermissions:   new GetMyPermissionsUseCase(accessControl),

        // Role
        listRoles:  new ListRolesUseCase(accessControl, roleRepo),
        getRole:    new GetRoleUseCase(accessControl, roleRepo),
        createRole: new CreateRoleUseCase(accessControl, roleRepo, auditRepo),
        updateRole: new UpdateRoleUseCase(accessControl, roleRepo, auditRepo),
        deleteRole: new DeleteRoleUseCase(accessControl, roleRepo, userRoleRepo, rolePermissionRepo, auditRepo),

        // Permission
        listPermissions: new ListPermissionsUseCase(accessControl, permissionRepo),

        // Assignment
        listUserRoles:      new ListUserRolesUseCase(accessControl, userRepo, userRoleRepo),
        assignRoleToUser:   new AssignRoleToUserUseCase(accessControl, userRepo, roleRepo, userRoleRepo, auditRepo),
        revokeRoleFromUser: new RevokeRoleFromUserUseCase(accessControl, userRoleRepo, auditRepo),
        setRolePermissions: new SetRolePermissionsUseCase(accessControl, uow),
        listRolePermissions: new ListRolePermissionsUseCase(accessControl, roleRepo, rolePermissionRepo),

        // Audit
        listAuditLogs: new ListAuditLogsUseCase(accessControl, auditRepo),
    };
}
