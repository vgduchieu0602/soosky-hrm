import { PERFORMANCE_COLLECTIONS } from "@modules/performance/adapters/driven/persistence/mongodb/collections";
import PerformanceReviewDocument from "@modules/performance/adapters/driven/persistence/mongodb/documents/PerformanceReviewDocument";
import PerformanceReviewMapper from "@modules/performance/adapters/driven/persistence/mongodb/mappers/PerformanceReviewMapper";
import MongoRepository from "@modules/performance/adapters/driven/persistence/mongodb/MongoRepository";
import PerformanceReviewRepo, { ReviewListFilter } from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceReview from "@modules/performance/core/domain/entities/PerformanceReview";
import { ClientSession, Db, Filter } from "mongodb";

export default class MongoPerformanceReviewRepo extends MongoRepository<PerformanceReviewDocument> implements PerformanceReviewRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PERFORMANCE_COLLECTIONS.reviews, session);
    }

    /**
     * `(cycleId, employeeId)` UNIQUE: mỗi nhân viên đúng MỘT phiếu trong một chu
     * kỳ. Hai phiếu cùng người sẽ khiến bản chụp sang lương phụ thuộc thứ tự khoá.
     */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<PerformanceReviewDocument>(PERFORMANCE_COLLECTIONS.reviews);
        await collection.createIndex({ cycleId: 1, employeeId: 1 }, { unique: true });
        await collection.createIndex({ cycleId: 1, status: 1 });
        await collection.createIndex({ reviewerUserId: 1, status: 1 });
        await collection.createIndex({ employeeId: 1, createdAt: -1 });
    }

    public async getById(id: string): Promise<PerformanceReview | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? PerformanceReviewMapper.toDomain(document) : undefined;
    }

    public async findOne(cycleId: string, employeeId: string): Promise<PerformanceReview | undefined> {
        const document = await this._collection.findOne({ cycleId, employeeId }, this._sessionOptions);
        return document ? PerformanceReviewMapper.toDomain(document) : undefined;
    }

    public async list(filter: ReviewListFilter): Promise<PerformanceReview[]> {
        const query: Filter<PerformanceReviewDocument> = {};
        if (filter.cycleId != undefined)        query.cycleId = filter.cycleId;
        if (filter.status != undefined)         query.status = filter.status;
        if (filter.reviewerUserId != undefined) query.reviewerUserId = filter.reviewerUserId;
        if (filter.employeeIds != undefined)    query.employeeId = { $in: [...filter.employeeIds] };

        const documents = await this._collection
            .find(query, { sort: { createdAt: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(PerformanceReviewMapper.toDomain);
    }

    public async listByCycle(cycleId: string): Promise<PerformanceReview[]> {
        const documents = await this._collection
            .find({ cycleId }, { sort: { createdAt: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(PerformanceReviewMapper.toDomain);
    }

    public async save(review: PerformanceReview): Promise<void> {
        const { _id, ...body } = PerformanceReviewMapper.toDocument(review);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
