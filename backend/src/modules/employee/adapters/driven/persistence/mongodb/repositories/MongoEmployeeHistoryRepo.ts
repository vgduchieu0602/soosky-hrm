import { EMPLOYEE_COLLECTIONS } from "@modules/employee/adapters/driven/persistence/mongodb/collections";
import EmployeeHistoryMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeHistoryMongoDoc";
import EmployeeHistoryMapper from "@modules/employee/adapters/driven/persistence/mongodb/mappers/EmployeeHistoryMapper";
import MongoRepository from "@modules/employee/adapters/driven/persistence/mongodb/MongoRepository";
import EmployeeHistoryRepo from "@modules/employee/core/app/ports/EmployeeHistoryRepo";
import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";
import { ClientSession, Db } from "mongodb";

/** Append-only: chỉ `save` (insert) và `listByEmployeeId`, không có update/delete. */
export default class MongoEmployeeHistoryRepo extends MongoRepository<EmployeeHistoryMongoDoc> implements EmployeeHistoryRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, EMPLOYEE_COLLECTIONS.history, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<EmployeeHistoryMongoDoc>(EMPLOYEE_COLLECTIONS.history);
        await collection.createIndex({ employeeId: 1, effectiveDate: -1 });
    }

    public async listByEmployeeId(employeeId: string): Promise<EmployeeHistory[]> {
        const documents = await this._collection
            .find({ employeeId }, { sort: { effectiveDate: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(EmployeeHistoryMapper.toDomain);
    }

    public async save(history: EmployeeHistory): Promise<void> {
        const { _id, ...body } = EmployeeHistoryMapper.toDocument(history);
        await this._collection.insertOne({ _id, ...body } as EmployeeHistoryMongoDoc, this._sessionOptions);
    }
}
