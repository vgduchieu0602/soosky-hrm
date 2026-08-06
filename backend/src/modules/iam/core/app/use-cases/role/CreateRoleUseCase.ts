import { RoleKeyConflictError } from "@modules/iam/core/app/errors/RoleKeyConflictError";
import AuditRepo from "@modules/iam/core/app/ports/AuditRepo";
import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import AuditLog from "@modules/iam/core/domain/entities/AuditLog";
import Role from "@modules/iam/core/domain/entities/Role";
import RoleKey from "@modules/iam/core/domain/value-objects/RoleKey";
import RoleName from "@modules/iam/core/domain/value-objects/RoleName";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_IAM_MANAGE = "iam:manage";
const AUDIT_RESOURCE_ROLE   = "role";
const AUDIT_ACTION_CREATE   = "create";

export interface CreateRoleInput {
    actorUserId: string;
    key:         string;
    name:        string;
    description: string;
}

/**
 * Tạo một role tuỳ chỉnh mới (không phải role hệ thống — role hệ thống chỉ
 * được tạo qua seed lúc khởi động).
 */
export default class CreateRoleUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _roleRepo: RoleRepo,
        private readonly _auditRepo: AuditRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     * @param input.key         Khoá định danh role, duy nhất (vd: "hr-manager").
     * @param input.name        Tên hiển thị.
     * @param input.description Mô tả.
     *
     * @returns Role vừa được tạo.
     *
     * @throws {AccessDeniedError}    Actor không có quyền `iam:manage`.
     * @throws {RoleKeyInvalidError}  Khoá sai định dạng.
     * @throws {RoleNameInvalidError} Tên rỗng.
     * @throws {RoleKeyConflictError} Khoá đã được dùng bởi role khác.
     */
    public async execute(input: CreateRoleInput): Promise<Role> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        const key  = RoleKey.create(input.key);
        const name = RoleName.create(input.name);

        if (await this._roleRepo.existsByKey(key)) {
            throw new RoleKeyConflictError();
        }

        const role = Role.create({
            id:          createUuidV7(),
            key:         key,
            name:        name,
            description: input.description,
            isSystem:    false,
        });
        await this._roleRepo.save(role);

        await this._auditRepo.save(AuditLog.create({
            id:          createUuidV7(),
            actorUserId: input.actorUserId,
            resource:    AUDIT_RESOURCE_ROLE,
            action:      AUDIT_ACTION_CREATE,
            resourceId:  role.id,
            changes:     { key: key.value, name: name.value, description: input.description },
        }));

        return role;
    }
}
