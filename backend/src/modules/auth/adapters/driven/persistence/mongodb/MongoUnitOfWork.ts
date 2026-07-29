import MongoAccountRepo from "@modules/auth/adapters/driven/persistence/mongodb/repositories/MongoAccountRepo";
import MongoRefreshTokenStore from "@modules/auth/adapters/driven/persistence/mongodb/repositories/MongoRefreshTokenStore";
import MongoVerificationTokenStore from "@modules/auth/adapters/driven/persistence/mongodb/repositories/MongoVerificationTokenStore";
import UnitOfWork, { AuthUoWContext } from "@modules/auth/core/app/ports/UnitOfWork";
import { Db, MongoClient } from "mongodb";

/**
 * `UnitOfWork` cho module Auth trên MongoDB.
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

    public async run<T>(work: (ctx: AuthUoWContext) => Promise<T>): Promise<T> {
        const session = this._client.startSession();
        try {
            let result!: T;
            await session.withTransaction(async () => {
                const ctx: AuthUoWContext = {
                    accountRepo:            new MongoAccountRepo(this._db, session),
                    refreshTokenStore:      new MongoRefreshTokenStore(this._db, session),
                    verificationTokenStore: new MongoVerificationTokenStore(this._db, session),
                };
                result = await work(ctx);
            });
            return result;
        } finally {
            await session.endSession();
        }
    }
}
