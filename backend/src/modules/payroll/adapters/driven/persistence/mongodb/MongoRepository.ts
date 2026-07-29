import { ClientSession, Collection, Db, Document } from "mongodb";

/**
 * Lớp cơ sở cho repository MongoDB của module Payroll. Giữ tham chiếu
 * collection và (tuỳ chọn) session để chạy trong transaction.
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

    protected get _sessionOptions(): { session?: ClientSession } {
        return this._session ? { session: this._session } : {};
    }
}
