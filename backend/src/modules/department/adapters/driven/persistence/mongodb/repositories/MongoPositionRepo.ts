import { DEPARTMENT_COLLECTIONS } from "@modules/department/adapters/driven/persistence/mongodb/collections";
import PositionDocument from "@modules/department/adapters/driven/persistence/mongodb/documents/PositionDocument";
import PositionMapper from "@modules/department/adapters/driven/persistence/mongodb/mappers/PositionMapper";
import MongoRepository from "@modules/department/adapters/driven/persistence/mongodb/MongoRepository";
import PositionRepo, { PositionListFilter } from "@modules/department/core/app/ports/PositionRepo";
import Position from "@modules/department/core/domain/entities/Position";
import { ClientSession, Db, Filter } from "mongodb";

export default class MongoPositionRepo extends MongoRepository<PositionDocument> implements PositionRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, DEPARTMENT_COLLECTIONS.positions, session);
    }

    /** Index: mã vị trí duy nhất; index theo phòng ban để lọc. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<PositionDocument>(DEPARTMENT_COLLECTIONS.positions);
        await collection.createIndex({ code: 1 }, { unique: true });
        await collection.createIndex({ departmentId: 1 });
    }

    public async getById(id: string): Promise<Position | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? PositionMapper.toDomain(document) : undefined;
    }

    public async getByCode(code: string): Promise<Position | undefined> {
        const document = await this._collection.findOne({ code }, this._sessionOptions);
        return document ? PositionMapper.toDomain(document) : undefined;
    }

    public async list(filter: PositionListFilter): Promise<Position[]> {
        const query: Filter<PositionDocument> = {};
        if (filter.departmentId != undefined) query.departmentId = filter.departmentId;
        if (filter.status != undefined)       query.status = filter.status;

        const documents = await this._collection
            .find(query, { sort: { level: 1, createdAt: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(PositionMapper.toDomain);
    }

    public async countByDepartment(departmentId: string): Promise<number> {
        return this._collection.countDocuments({ departmentId }, this._sessionOptions);
    }

    public async save(position: Position): Promise<void> {
        const { _id, ...body } = PositionMapper.toDocument(position);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
