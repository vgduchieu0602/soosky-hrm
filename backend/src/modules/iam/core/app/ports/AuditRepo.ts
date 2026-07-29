import AuditLog from "@modules/iam/core/domain/entities/AuditLog";

export interface AuditListFilter {
    resource?:   string;
    resourceId?: string;
}

export default interface AuditRepo {
    save(auditLog: AuditLog): Promise<void>;

    /** Liệt kê audit log khớp bộ lọc, mới nhất trước. */
    list(filter: AuditListFilter): Promise<AuditLog[]>;
}
