import { AuditEntry } from "@shared/core/app/audit/AuditEntry";

/**
 * Cổng ghi nhật ký thao tác. Sổ audit do module IAM sở hữu; module Attendance
 * KHÔNG import IAM — composition root nối cổng này vào `createIamAuditTrail`.
 *
 * Ghi audit là phụ trợ, KHÔNG được làm thất bại nghiệp vụ chính: hiện thực chịu
 * trách nhiệm nuốt lỗi và log lại.
 */
export default interface AuditTrail {
    record(entry: AuditEntry): Promise<void>;
}
