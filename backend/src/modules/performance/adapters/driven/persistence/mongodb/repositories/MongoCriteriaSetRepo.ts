import { PERFORMANCE_COLLECTIONS } from "@modules/performance/adapters/driven/persistence/mongodb/collections";
import CriteriaSetDocument from "@modules/performance/adapters/driven/persistence/mongodb/documents/CriteriaSetDocument";
import CriteriaSetMapper from "@modules/performance/adapters/driven/persistence/mongodb/mappers/CriteriaSetMapper";
import MongoRepository from "@modules/performance/adapters/driven/persistence/mongodb/MongoRepository";
import CriteriaSetRepo from "@modules/performance/core/app/ports/CriteriaSetRepo";
import CriteriaSet from "@modules/performance/core/domain/entities/CriteriaSet";
import { ClientSession, Db } from "mongodb";

export default class MongoCriteriaSetRepo extends MongoRepository<CriteriaSetDocument> implements CriteriaSetRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PERFORMANCE_COLLECTIONS.criteriaSets, session);
    }

    /** Số bộ tiêu chí rất nhỏ (vài bộ mỗi công ty) — chỉ cần index tên để tra nhanh. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<CriteriaSetDocument>(PERFORMANCE_COLLECTIONS.criteriaSets);
        await collection.createIndex({ name: 1 });
    }

    public async getById(id: string): Promise<CriteriaSet | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? CriteriaSetMapper.toDomain(document) : undefined;
    }

    public async listAll(): Promise<CriteriaSet[]> {
        const documents = await this._collection
            .find({}, { sort: { createdAt: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(CriteriaSetMapper.toDomain);
    }

    public async save(criteriaSet: CriteriaSet): Promise<void> {
        const { _id, ...body } = CriteriaSetMapper.toDocument(criteriaSet);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
