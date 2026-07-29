import { MongoPermissionRepo, MongoRolePermissionRepo, MongoUserRoleRepo } from "@modules/iam/adapters/driven/persistence/mongodb";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import { Db as MongoDb } from "mongodb";

/**
 * Bề mặt kiểm tra quyền hạn của IAM mà các module khác được phép tiêu thụ, mà
 * KHÔNG cần import trực tiếp `AccessControl` hay các repo Mongo nội bộ.
 */
export interface IamAccessControlFacade {
    assertPermission(actorUserId: string, permissionKey: string): Promise<void>;
    listPermissionsOf(userId: string): Promise<string[]>;
}

/**
 * Lắp `AccessControl` trên nền MongoDB và trả về dưới hình dạng tối giản
 * (`IamAccessControlFacade`) — điểm nối duy nhất để module khác (vd:
 * Department) dùng RBAC của IAM mà vẫn giữ ranh giới module: chỉ composition
 * root (infra) mới được phép import cả hai module để nối dây.
 */
export function createIamAccessControl(mongoDb: MongoDb): IamAccessControlFacade {
    const userRoleRepo       = new MongoUserRoleRepo(mongoDb);
    const rolePermissionRepo = new MongoRolePermissionRepo(mongoDb);
    const permissionRepo     = new MongoPermissionRepo(mongoDb);

    const accessControl = new AccessControl(userRoleRepo, rolePermissionRepo, permissionRepo);

    return {
        assertPermission:  (actorUserId, permissionKey) => accessControl.assertPermission(actorUserId, permissionKey),
        listPermissionsOf: userId => accessControl.listPermissionsOf(userId),
    };
}
