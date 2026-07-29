import { DEPARTMENT_COLLECTIONS } from "@modules/department/adapters/driven/persistence/mongodb/collections";
import DepartmentDocument from "@modules/department/adapters/driven/persistence/mongodb/documents/DepartmentDocument";
import DepartmentMapper from "@modules/department/adapters/driven/persistence/mongodb/mappers/DepartmentMapper";
import MongoRepository from "@modules/department/adapters/driven/persistence/mongodb/MongoRepository";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import Department from "@modules/department/core/domain/entities/Department";
import { ClientSession, Db } from "mongodb";

export default class MongoDepartmentRepo extends MongoRepository<DepartmentDocument> implements DepartmentRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, DEPARTMENT_COLLECTIONS.departments, session);
    }

    /** Index: mã phòng ban là duy nhất; index theo cha để liệt kê con. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<DepartmentDocument>(DEPARTMENT_COLLECTIONS.departments);
        await collection.createIndex({ code: 1 }, { unique: true });
        await collection.createIndex({ parentDepartmentId: 1 });
    }

    public async getById(id: string): Promise<Department | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? DepartmentMapper.toDomain(document) : undefined;
    }

    public async getByCode(code: string): Promise<Department | undefined> {
        const document = await this._collection.findOne({ code }, this._sessionOptions);
        return document ? DepartmentMapper.toDomain(document) : undefined;
    }

    public async listAll(): Promise<Department[]> {
        const documents = await this._collection
            .find({}, { sort: { createdAt: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(DepartmentMapper.toDomain);
    }

    public async listChildren(parentDepartmentId: string): Promise<Department[]> {
        const documents = await this._collection
            .find({ parentDepartmentId }, this._sessionOptions)
            .toArray();
        return documents.map(DepartmentMapper.toDomain);
    }

    public async countChildren(parentDepartmentId: string): Promise<number> {
        return this._collection.countDocuments({ parentDepartmentId }, this._sessionOptions);
    }

    public async save(department: Department): Promise<void> {
        const { _id, ...body } = DepartmentMapper.toDocument(department);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
