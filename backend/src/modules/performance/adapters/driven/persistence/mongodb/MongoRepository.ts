import { ClientSession, Collection, Db, Document } from "mongodb";

/**
 * Lớp nền cho repository MongoDB của module Performance — giữ collection và
 * session (nếu đang trong transaction). Mỗi module có bản riêng để không module
 * nào phụ thuộc hạ tầng của module khác.
 */
export default abstract class MongoRepository<TDocument extends Document> {
    protected readonly _collection: Collection<TDocument>;

    protected constructor(
        db: Db,
        collectionName: string,
        private readonly _session?: ClientSession,
    ) {
        this._collection = db.collection<TDocument>(collectionName);
    }

    protected get _sessionOptions(): { session?: ClientSession } {
        return this._session == undefined ? {} : { session: this._session };
    }
}
