import AuditLogDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/AuditLogDocument";
import AuditLog from "@modules/iam/core/domain/entities/AuditLog";

const AuditLogMapper = {
    toDocument(auditLog: AuditLog): AuditLogDocument {
        return {
            _id:         auditLog.id,
            actorUserId: auditLog.actorUserId,
            resource:    auditLog.resource,
            action:      auditLog.action,
            resourceId:  auditLog.resourceId,
            changes:     auditLog.changes,
            occurredAt:  auditLog.occurredAt,
        };
    },

    toDomain(document: AuditLogDocument): AuditLog {
        return AuditLog.rehydrate({
            id:          document._id,
            actorUserId: document.actorUserId,
            resource:    document.resource,
            action:      document.action,
            resourceId:  document.resourceId,
            changes:     document.changes,
            occurredAt:  document.occurredAt,
        });
    },
};

export default AuditLogMapper;
