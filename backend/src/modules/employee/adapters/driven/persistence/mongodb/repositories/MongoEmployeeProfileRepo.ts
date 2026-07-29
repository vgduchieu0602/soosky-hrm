import { EMPLOYEE_COLLECTIONS } from "@modules/employee/adapters/driven/persistence/mongodb/collections";
import EmployeeProfileMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeProfileMongoDoc";
import EmployeeProfileMapper from "@modules/employee/adapters/driven/persistence/mongodb/mappers/EmployeeProfileMapper";
import MongoRepository from "@modules/employee/adapters/driven/persistence/mongodb/MongoRepository";
import EmployeeProfileRepo from "@modules/employee/core/app/ports/EmployeeProfileRepo";
import EmployeeProfile from "@modules/employee/core/domain/entities/EmployeeProfile";
import { ClientSession, Db } from "mongodb";

export default class MongoEmployeeProfileRepo extends MongoRepository<EmployeeProfileMongoDoc> implements EmployeeProfileRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, EMPLOYEE_COLLECTIONS.profiles, session);
    }

    /** Index: mỗi nhân viên chỉ có duy nhất một hồ sơ (quan hệ 1-1). */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<EmployeeProfileMongoDoc>(EMPLOYEE_COLLECTIONS.profiles);
        await collection.createIndex({ employeeId: 1 }, { unique: true });
    }

    public async getByEmployeeId(employeeId: string): Promise<EmployeeProfile | undefined> {
        const document = await this._collection.findOne({ employeeId }, this._sessionOptions);
        return document ? EmployeeProfileMapper.toDomain(document) : undefined;
    }

    public async save(profile: EmployeeProfile): Promise<void> {
        const { _id, ...body } = EmployeeProfileMapper.toDocument(profile);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
