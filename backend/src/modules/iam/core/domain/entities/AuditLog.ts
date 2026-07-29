import Entity from "@shared/core/domain/Entity";

export interface AuditLogProps {
    id:            string;
    actorUserId:   string | null;
    resource:      string;
    action:        string;
    resourceId:    string | null;
    changes:       Record<string, unknown> | null;
    occurredAt:    Date;
}

export interface AuditLogCreationInput {
    id:          string;
    actorUserId: string | null;
    resource:    string;
    action:      string;
    resourceId:  string | null;
    changes:     Record<string, unknown> | null;
}

/**
 * Một dòng nhật ký thao tác — ghi lại "ai làm gì trên cái gì" cho mọi use-case
 * mutating của module IAM. Bất biến sau khi tạo.
 */
export default class AuditLog extends Entity<string> {
    private constructor(
        public readonly id: string,
        public readonly actorUserId: string | null,
        public readonly resource: string,
        public readonly action: string,
        public readonly resourceId: string | null,
        public readonly changes: Record<string, unknown> | null,
        public readonly occurredAt: Date,
    ) {
        super();
    }

    static create(input: AuditLogCreationInput): AuditLog {
        return new AuditLog(
            input.id,
            input.actorUserId,
            input.resource,
            input.action,
            input.resourceId,
            input.changes,
            new Date(),
        );
    }

    static rehydrate(props: AuditLogProps): AuditLog {
        return new AuditLog(
            props.id,
            props.actorUserId,
            props.resource,
            props.action,
            props.resourceId,
            props.changes,
            props.occurredAt,
        );
    }
}
