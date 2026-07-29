import MongoAuditRepo from "@modules/iam/adapters/driven/persistence/mongodb/repositories/MongoAuditRepo";
import MongoPermissionRepo from "@modules/iam/adapters/driven/persistence/mongodb/repositories/MongoPermissionRepo";
import MongoRolePermissionRepo from "@modules/iam/adapters/driven/persistence/mongodb/repositories/MongoRolePermissionRepo";
import MongoRoleRepo from "@modules/iam/adapters/driven/persistence/mongodb/repositories/MongoRoleRepo";
import MongoUserRepo from "@modules/iam/adapters/driven/persistence/mongodb/repositories/MongoUserRepo";
import MongoUserRoleRepo from "@modules/iam/adapters/driven/persistence/mongodb/repositories/MongoUserRoleRepo";
import UnitOfWork, { IamUoWContext } from "@modules/iam/core/app/ports/UnitOfWork";
import { Db, MongoClient } from "mongodb";

/**
 * `UnitOfWork` cho module IAM trên MongoDB.
 *
 * Mở một `ClientSession`, chạy callback bên trong một transaction (`withTransaction`
 * tự commit khi thành công và rollback khi có lỗi), và cấp cho callback bộ repo đã
 * gắn session — nên mọi ghi trong `run` là nguyên tử (atomic).
 *
 * Lưu ý: transaction MongoDB yêu cầu deployment dạng replica set (hoặc sharded cluster).
 */
export default class MongoUnitOfWork implements UnitOfWork {
    public constructor(
        private readonly _client: MongoClient,
        private readonly _db: Db,
    ) {}

    public async run<T>(work: (ctx: IamUoWContext) => Promise<T>): Promise<T> {
        const session = this._client.startSession();
        try {
            let result!: T;
            await session.withTransaction(async () => {
                const ctx: IamUoWContext = {
                    userRepo:           new MongoUserRepo(this._db, session),
                    roleRepo:           new MongoRoleRepo(this._db, session),
                    permissionRepo:     new MongoPermissionRepo(this._db, session),
                    userRoleRepo:       new MongoUserRoleRepo(this._db, session),
                    rolePermissionRepo: new MongoRolePermissionRepo(this._db, session),
                    auditRepo:          new MongoAuditRepo(this._db, session),
                };
                result = await work(ctx);
            });
            return result;
        } finally {
            await session.endSession();
        }
    }
}
