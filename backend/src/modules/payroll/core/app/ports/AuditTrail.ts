import { AuditEntry } from "@shared/core/app/audit/AuditEntry";

/**
 * Cổng ghi nhật ký thao tác. Sổ audit do module IAM sở hữu; module Payroll
 * KHÔNG import IAM — composition root nối cổng này vào `createIamAuditTrail`.
 */
export default interface AuditTrail {
    record(entry: AuditEntry): Promise<void>;
}
