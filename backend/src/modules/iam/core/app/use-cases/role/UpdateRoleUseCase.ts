import { RoleIsSystemError } from "@modules/iam/core/app/errors/RoleIsSystemError";
import { RoleNotFoundError } from "@modules/iam/core/app/errors/RoleNotFoundError";
import AuditRepo from "@modules/iam/core/app/ports/AuditRepo";
import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import AuditLog from "@modules/iam/core/domain/entities/AuditLog";
import Role from "@modules/iam/core/domain/entities/Role";
import RoleName from "@modules/iam/core/domain/value-objects/RoleName";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_IAM_MANAGE = "iam:manage";
const AUDIT_RESOURCE_ROLE   = "role";
const AUDIT_ACTION_UPDATE   = "update";

export interface UpdateRoleInput {
    actorUserId: string;
    roleId:      string;
    name?:       string;
    description?: string;
}

/**
 * Cập nhật tên/mô tả của một role tuỳ chỉnh. Khoá (key) là bất biến —
 * không thể đổi sau khi tạo.
 *
 * Idempotent: không có trường nào thay đổi thì bỏ qua, không ghi audit.
 */
export default class UpdateRoleUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _roleRepo: RoleRepo,
        private readonly _auditRepo: AuditRepo,
    ) {}

    /**
     * @param input.actorUserId  Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     * @param input.roleId       Id role cần cập nhật.
     * @param input.name         Tên hiển thị mới (tuỳ chọn).
     * @param input.description  Mô tả mới (tuỳ chọn).
     *
     * @returns Role sau khi cập nhật.
     *
     * @throws {AccessDeniedError}    Actor không có quyền `iam:manage`.
     * @throws {RoleNotFoundError}    Role không tồn tại.
     * @throws {RoleIsSystemError}    Role là role hệ thống, không thể sửa.
     * @throws {RoleNameInvalidError} Tên rỗng.
     */
    public async execute(input: UpdateRoleInput): Promise<Role> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        const role = await this._roleRepo.getById(input.roleId);
        if (role == undefined) {
            throw new RoleNotFoundError();
        }
        if (role.isSystem) {
            throw new RoleIsSystemError();
        }

        const changes: Record<string, unknown> = {};

        if (input.name != undefined && role.rename(RoleName.create(input.name))) {
            changes["name"] = input.name;
        }
        if (input.description != undefined && role.changeDescription(input.description)) {
            changes["description"] = input.description;
        }

        if (Object.keys(changes).length === 0) return role;

        await this._roleRepo.save(role);
        await this._auditRepo.save(AuditLog.create({
            id:          UUIDv7(),
            actorUserId: input.actorUserId,
            resource:    AUDIT_RESOURCE_ROLE,
            action:      AUDIT_ACTION_UPDATE,
            resourceId:  role.id,
            changes:     changes,
        }));

        return role;
    }
}
