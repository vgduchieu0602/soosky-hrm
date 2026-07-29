import { MongoRoleRepo, MongoUserRepo, MongoUserRoleRepo } from "@modules/iam/adapters/driven/persistence/mongodb";
import DeactivateUserProjectionUseCase from "@modules/iam/core/app/use-cases/projection/DeactivateUserProjectionUseCase";
import ProjectUserFromAccountUseCase from "@modules/iam/core/app/use-cases/projection/ProjectUserFromAccountUseCase";
import ReactivateUserProjectionUseCase from "@modules/iam/core/app/use-cases/projection/ReactivateUserProjectionUseCase";
import SyncUserProfileUseCase from "@modules/iam/core/app/use-cases/projection/SyncUserProfileUseCase";
import { IamEventUseCases } from "@modules/iam";
import { Db as MongoDb } from "mongodb";

/**
 * Lắp ráp bộ use-case mà driver adapter events của module IAM cần — tách
 * khỏi bộ use-case HTTP vì đây là các thao tác chiếu (projection), không
 * qua kiểm tra quyền hạn và được gọi bởi event handler, không phải người dùng.
 */
export default function createIamEventUseCases(mongoDb: MongoDb): IamEventUseCases {
    const userRepo     = new MongoUserRepo(mongoDb);
    const roleRepo     = new MongoRoleRepo(mongoDb);
    const userRoleRepo = new MongoUserRoleRepo(mongoDb);

    return {
        projectUserFromAccount:   new ProjectUserFromAccountUseCase(userRepo, roleRepo, userRoleRepo),
        syncUserProfile:          new SyncUserProfileUseCase(userRepo),
        deactivateUserProjection: new DeactivateUserProjectionUseCase(userRepo),
        reactivateUserProjection: new ReactivateUserProjectionUseCase(userRepo),
    };
}
