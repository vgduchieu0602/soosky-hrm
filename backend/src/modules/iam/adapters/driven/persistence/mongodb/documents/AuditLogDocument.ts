export default interface AuditLogDocument {
    _id:         string;
    actorUserId: string | null;
    resource:    string;
    action:      string;
    resourceId:  string | null;
    changes:     Record<string, unknown> | null;
    occurredAt:  Date;
}
