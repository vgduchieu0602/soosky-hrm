import AuditLog from "@modules/iam/core/domain/entities/AuditLog";

export interface AuditLogDTO {
    id:          string;
    actorUserId: string | null;
    resource:    string;
    action:      string;
    resourceId:  string | null;
    changes:     Record<string, unknown> | null;
    occurredAt:  string;
}

const AuditLogPresenter = {
    toDTO(auditLog: AuditLog): AuditLogDTO {
        return {
            id:          auditLog.id,
            actorUserId: auditLog.actorUserId,
            resource:    auditLog.resource,
            action:      auditLog.action,
            resourceId:  auditLog.resourceId,
            changes:     auditLog.changes,
            occurredAt:  auditLog.occurredAt.toISOString(),
        };
    },
};

export default AuditLogPresenter;
