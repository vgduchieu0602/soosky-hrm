import { ClientSession, Collection, Db, Document } from "mongodb";

/**
 * Lớp cơ sở cho các repository MongoDB của module IAM.
 *
 * Giữ tham chiếu tới collection và (tuỳ chọn) `ClientSession` đang mở. Khi được tạo
 * bên trong `MongoUnitOfWork`, mọi thao tác đều gắn session để chạy trong cùng một
 * transaction; khi dùng độc lập (không session) thì thao tác chạy như bình thường.
 */
export default abstract class MongoRepository<TDocument extends Document> {
    protected readonly _collection: Collection<TDocument>;

    protected constructor(
        db: Db,
        collectionName: string,
        protected readonly _session?: ClientSession,
    ) {
        this._collection = db.collection<TDocument>(collectionName);
    }

    /**
     * Option kèm `session` (nếu đang trong transaction) để truyền vào lệnh của driver.
     * Trả về object rỗng khi không có session — tránh gán `session: undefined`
     * (vi phạm `exactOptionalPropertyTypes`).
     */
    protected get _sessionOptions(): { session?: ClientSession } {
        return this._session ? { session: this._session } : {};
    }
}
