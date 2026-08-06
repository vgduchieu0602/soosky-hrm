import { MongoAuditRepo, MongoPermissionRepo, MongoRolePermissionRepo, MongoUserRoleRepo } from "@modules/iam/adapters/driven/persistence/mongodb";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import AuditLog from "@modules/iam/core/domain/entities/AuditLog";
import { AuditEntry } from "@shared/core/app/audit/AuditEntry";
import { PermissionScope } from "@shared/core/app/authorization/PermissionScope";
import { Db as MongoDb } from "mongodb";
import { v7 as UUIDv7 } from "uuid";

/**
 * Bề mặt kiểm tra quyền hạn của IAM mà các module khác được phép tiêu thụ, mà
 * KHÔNG cần import trực tiếp `AccessControl` hay các repo Mongo nội bộ.
 */
export interface IamAccessControlFacade {
    assertPermission(actorUserId: string, permissionKey: string): Promise<void>;
    /**
     * Phạm vi dữ liệu actor được đọc trên một khoá gốc — `all` / `team` /
     * `self`, suy ra từ hậu tố khoá quyền (xem
     * `shared/core/app/authorization/PermissionScope.ts`).
     */
    resolveScope(actorUserId: string, permissionKey: string): Promise<PermissionScope>;
    listPermissionsOf(userId: string): Promise<string[]>;
}

/**
 * Lắp `AccessControl` trên nền MongoDB và trả về dưới hình dạng tối giản
 * (`IamAccessControlFacade`) — điểm nối duy nhất để module khác (vd:
 * Department) dùng RBAC của IAM mà vẫn giữ ranh giới module: chỉ composition
 * root (infra) mới được phép import cả hai module để nối dây.
 */
/**
 * Bề mặt GHI nhật ký thao tác mà module khác được phép tiêu thụ. Khớp đúng hình
 * dạng cổng `AuditTrail` mà các module khai báo, nên composition root chỉ cần
 * truyền thẳng vào.
 */
export interface IamAuditTrailFacade {
    record(entry: AuditEntry): Promise<void>;
}

/**
 * Lắp bộ ghi audit dùng chung trên nền MongoDB — mọi module ghi vào CÙNG MỘT
 * sổ (`iam_audit_logs`), nên tra cứu "ai đã sửa gì" chỉ cần một endpoint
 * (`GET /iam/audit-logs`).
 *
 * Nuốt lỗi có chủ đích: audit là phụ trợ. Không ai muốn việc sửa hợp đồng thất
 * bại chỉ vì ghi log thất bại — nhưng cũng không được im lặng, nên lỗi được
 * log ra stderr để giám sát bắt được.
 */
export function createIamAuditTrail(mongoDb: MongoDb): IamAuditTrailFacade {
    const auditRepo = new MongoAuditRepo(mongoDb);

    return {
        record: async (entry: AuditEntry) => {
            try {
                await auditRepo.save(AuditLog.create({
                    id:          UUIDv7(),
                    actorUserId: entry.actorUserId,
                    resource:    entry.resource,
                    action:      entry.action,
                    resourceId:  entry.resourceId,
                    changes:     entry.changes,
                }));
            } catch (error) {
                console.error("Audit log write failed:", entry.resource, entry.action, entry.resourceId, error);
            }
        },
    };
}

export function createIamAccessControl(mongoDb: MongoDb): IamAccessControlFacade {
    const userRoleRepo       = new MongoUserRoleRepo(mongoDb);
    const rolePermissionRepo = new MongoRolePermissionRepo(mongoDb);
    const permissionRepo     = new MongoPermissionRepo(mongoDb);

    const accessControl = new AccessControl(userRoleRepo, rolePermissionRepo, permissionRepo);

    return {
        assertPermission:  (actorUserId, permissionKey) => accessControl.assertPermission(actorUserId, permissionKey),
        resolveScope:      (actorUserId, permissionKey) => accessControl.resolveScope(actorUserId, permissionKey),
        listPermissionsOf: userId => accessControl.listPermissionsOf(userId),
    };
}

/** Bề mặt ĐỌC nhật ký thao tác cho read model (module Dashboard). */
export interface IamAuditReadFacade {
    listRecent(limit: number): Promise<{
        id:          string;
        actorUserId: string | null;
        resource:    string;
        action:      string;
        resourceId:  string | null;
        occurredAt:  Date;
    }[]>;
}

/**
 * Lắp bộ đọc audit gần nhất.
 *
 * KHÔNG kiểm quyền ở đây: quyền `audit:read` được kiểm ở use-case của module gọi
 * (Dashboard), giống mọi cổng cross-module khác — facade chỉ là đường đọc dữ liệu.
 */
export function createIamAuditReader(mongoDb: MongoDb): IamAuditReadFacade {
    const auditRepo = new MongoAuditRepo(mongoDb);

    return {
        listRecent: async (limit: number) => {
            const logs = await auditRepo.list({});
            return logs.slice(0, limit).map(log => ({
                id:          log.id,
                actorUserId: log.actorUserId,
                resource:    log.resource,
                action:      log.action,
                resourceId:  log.resourceId,
                occurredAt:  log.occurredAt,
            }));
        },
    };
}
