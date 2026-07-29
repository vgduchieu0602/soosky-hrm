import { EMPLOYEE_COLLECTIONS } from "@modules/employee/adapters/driven/persistence/mongodb/collections";
import EmployeeAssetMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeAssetMongoDoc";
import EmployeeAssetMapper from "@modules/employee/adapters/driven/persistence/mongodb/mappers/EmployeeAssetMapper";
import MongoRepository from "@modules/employee/adapters/driven/persistence/mongodb/MongoRepository";
import EmployeeAssetRepo from "@modules/employee/core/app/ports/EmployeeAssetRepo";
import EmployeeAsset from "@modules/employee/core/domain/entities/EmployeeAsset";
import { ClientSession, Db } from "mongodb";

export default class MongoEmployeeAssetRepo extends MongoRepository<EmployeeAssetMongoDoc> implements EmployeeAssetRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, EMPLOYEE_COLLECTIONS.assets, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<EmployeeAssetMongoDoc>(EMPLOYEE_COLLECTIONS.assets);
        await collection.createIndex({ employeeId: 1 });
        await collection.createIndex({ assetCode: 1 }, { unique: true });
    }

    public async getById(id: string): Promise<EmployeeAsset | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? EmployeeAssetMapper.toDomain(document) : undefined;
    }

    public async listByEmployeeId(employeeId: string): Promise<EmployeeAsset[]> {
        const documents = await this._collection.find({ employeeId }, this._sessionOptions).toArray();
        return documents.map(EmployeeAssetMapper.toDomain);
    }

    public async save(asset: EmployeeAsset): Promise<void> {
        const { _id, ...body } = EmployeeAssetMapper.toDocument(asset);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
