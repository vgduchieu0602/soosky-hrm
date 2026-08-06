import { AuditEntry } from "@shared/core/app/audit/AuditEntry";

/**
 * Cổng ghi nhật ký thao tác — sổ audit do IAM sở hữu. Ghi audit không được làm
 * thất bại nghiệp vụ chính (hiện thực tự nuốt lỗi và log).
 */
export default interface AuditTrail {
    record(entry: AuditEntry): Promise<void>;
}
