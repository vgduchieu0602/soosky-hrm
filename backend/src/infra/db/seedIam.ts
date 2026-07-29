import { MongoPermissionRepo, MongoRolePermissionRepo, MongoRoleRepo } from "@modules/iam/adapters/driven/persistence/mongodb";
import Permission from "@modules/iam/core/domain/entities/Permission";
import Role from "@modules/iam/core/domain/entities/Role";
import RolePermission from "@modules/iam/core/domain/entities/RolePermission";
import PermissionKey from "@modules/iam/core/domain/value-objects/PermissionKey";
import RoleKey from "@modules/iam/core/domain/value-objects/RoleKey";
import RoleName from "@modules/iam/core/domain/value-objects/RoleName";
import { Db as MongoDb } from "mongodb";
import { v7 as UUIDv7 } from "uuid";

const SYSTEM_PERMISSION_KEYS = [
    "*",
    "iam:manage",
    "department:manage",
    "employee:read",
    "employee:manage",
    "attendance:manage",
    "payroll:manage",
    "setting:manage",
] as const;

const SYSTEM_ADMIN_ROLE_KEY  = "admin";
const SYSTEM_ADMIN_ROLE_NAME = "Administrator";

/**
 * Nạp catalog quyền hạn hệ thống + role hệ thống "admin" (giữ toàn bộ quyền
 * hạn qua wildcard "*") — chạy một lần lúc khởi động (server lẫn CLI), ngay
 * sau `ensureMongoIndexes`.
 *
 * Idempotent: kiểm tra tồn tại theo key trước khi tạo, chạy lại nhiều lần
 * (mỗi lần khởi động) là an toàn — không tạo trùng, không ghi đè thay đổi
 * thủ công đã thực hiện sau đó (vd: đổi mô tả quyền hạn).
 */
export default async function seedIam(mongoDb: MongoDb): Promise<void> {
    const permissionRepo     = new MongoPermissionRepo(mongoDb);
    const roleRepo           = new MongoRoleRepo(mongoDb);
    const rolePermissionRepo = new MongoRolePermissionRepo(mongoDb);

    const permissionIds: string[] = [];
    for (const rawKey of SYSTEM_PERMISSION_KEYS) {
        const key = PermissionKey.create(rawKey);
        const existing = await permissionRepo.getByKey(key);
        if (existing != undefined) {
            permissionIds.push(existing.id);
            continue;
        }

        const permission = Permission.create({ id: UUIDv7(), key, description: `System permission: ${key.value}` });
        await permissionRepo.save(permission);
        permissionIds.push(permission.id);
    }

    const adminRoleKey = RoleKey.create(SYSTEM_ADMIN_ROLE_KEY);
    let adminRole       = await roleRepo.getByKey(adminRoleKey);
    if (adminRole == undefined) {
        adminRole = Role.create({
            id:          UUIDv7(),
            key:         adminRoleKey,
            name:        RoleName.create(SYSTEM_ADMIN_ROLE_NAME),
            description: "Full access to every module (system role, immutable)",
            isSystem:    true,
        });
        await roleRepo.save(adminRole);
    }

    const wildcardId = permissionIds[0]; // SYSTEM_PERMISSION_KEYS[0] === "*"
    if (wildcardId == undefined) return;

    const currentPermissions = await rolePermissionRepo.listByRoleId(adminRole.id);
    const alreadyHasWildcard = currentPermissions.some(rolePermission => rolePermission.permissionId === wildcardId);
    if (alreadyHasWildcard) return;

    await rolePermissionRepo.save(RolePermission.create(UUIDv7(), adminRole.id, wildcardId));
}
