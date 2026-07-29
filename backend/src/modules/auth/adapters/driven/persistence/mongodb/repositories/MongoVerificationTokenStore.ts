import { AUTH_COLLECTIONS } from "@modules/auth/adapters/driven/persistence/mongodb/collections";
import VerificationTokenDocument from "@modules/auth/adapters/driven/persistence/mongodb/documents/VerificationTokenDocument";
import MongoRepository from "@modules/auth/adapters/driven/persistence/mongodb/MongoRepository";
import IssuedToken from "@modules/auth/core/app/ports/IssuedToken";
import VerificationTokenStore from "@modules/auth/core/app/ports/VerificationTokenStore";
import { ClientSession, Db } from "mongodb";
import { createHash, randomBytes } from "node:crypto";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ

/**
 * Hiện thực `VerificationTokenStore` trên MongoDB — cùng cách tiếp cận với
 * `MongoRefreshTokenStore`.
 *
 * Token thô là 32 byte ngẫu nhiên (base64url), chỉ nằm trong email gửi đi;
 * DB chỉ lưu SHA-256 của token làm `_id` — token đủ entropy nên không cần
 * hàm băm chậm như mật khẩu, và tra cứu là so khớp chính xác trên khoá chính.
 *
 * Document hết hạn do TTL index dọn dần; `consume` vẫn tự kiểm tra `expiresAt`
 * vì TTL sweep của MongoDB chạy theo chu kỳ, không tức thời.
 */
export default class MongoVerificationTokenStore extends MongoRepository<VerificationTokenDocument> implements VerificationTokenStore {

    public constructor(
        db: Db,
        session?: ClientSession,
        private readonly _ttlMs: number = DEFAULT_TTL_MS,
    ) {
        super(db, AUTH_COLLECTIONS.verificationTokens, session);
    }

    /**
     * Tạo các index mà collection này cần, gọi một lần lúc khởi động ứng dụng:
     * TTL index dọn token hết hạn, index theo accountId phục vụ thu hồi hàng loạt.
     */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<VerificationTokenDocument>(AUTH_COLLECTIONS.verificationTokens);
        await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        await collection.createIndex({ accountId: 1 });
    }

    public async issue(accountId: string): Promise<IssuedToken> {
        const token     = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + this._ttlMs);

        await this._collection.insertOne({
            _id:       this._hash(token),
            accountId: accountId,
            expiresAt: expiresAt,
            createdAt: new Date(),
        }, this._sessionOptions);

        return { token, expiresAt };
    }

    public async consume(token: string): Promise<string | null> {
        const document = await this._collection.findOneAndDelete({ _id: this._hash(token) }, this._sessionOptions);
        if (document == undefined) return null;
        if (document.expiresAt.getTime() <= Date.now()) return null;

        return document.accountId;
    }

    public async revokeAllForAccount(accountId: string): Promise<void> {
        await this._collection.deleteMany({ accountId }, this._sessionOptions);
    }

    /**
     * SHA-256 (hex) của token thô — dạng duy nhất được phép chạm DB.
     */
    private _hash(token: string): string {
        return createHash("sha256").update(token).digest("hex");
    }
}
