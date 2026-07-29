import { IAM_COLLECTIONS } from "@modules/iam/adapters/driven/persistence/mongodb/collections";
import AuditLogDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/AuditLogDocument";
import AuditLogMapper from "@modules/iam/adapters/driven/persistence/mongodb/mappers/AuditLogMapper";
import MongoRepository from "@modules/iam/adapters/driven/persistence/mongodb/MongoRepository";
import AuditRepo, { AuditListFilter } from "@modules/iam/core/app/ports/AuditRepo";
import AuditLog from "@modules/iam/core/domain/entities/AuditLog";
import { ClientSession, Db, Filter } from "mongodb";

export default class MongoAuditRepo extends MongoRepository<AuditLogDocument> implements AuditRepo {

    public constructor(db: Db, session?: ClientSession) {
        super(db, IAM_COLLECTIONS.auditLogs, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        await db.collection<AuditLogDocument>(IAM_COLLECTIONS.auditLogs)
            .createIndex({ resource: 1, resourceId: 1 });
    }

    public async save(auditLog: AuditLog): Promise<void> {
        await this._collection.insertOne(AuditLogMapper.toDocument(auditLog), this._sessionOptions);
    }

    public async list(filter: AuditListFilter): Promise<AuditLog[]> {
        const query: Filter<AuditLogDocument> = {};
        if (filter.resource != undefined)   query.resource = filter.resource;
        if (filter.resourceId != undefined) query.resourceId = filter.resourceId;

        const documents = await this._collection
            .find(query, this._sessionOptions)
            .sort({ occurredAt: -1 })
            .toArray();
        return documents.map(document => AuditLogMapper.toDomain(document));
    }
}
