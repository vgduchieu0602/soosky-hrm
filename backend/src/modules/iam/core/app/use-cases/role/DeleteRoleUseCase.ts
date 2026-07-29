import { RoleAssignmentExistsError } from "@modules/iam/core/app/errors/RoleAssignmentExistsError";
import { RoleIsSystemError } from "@modules/iam/core/app/errors/RoleIsSystemError";
import { RoleNotFoundError } from "@modules/iam/core/app/errors/RoleNotFoundError";
import AuditRepo from "@modules/iam/core/app/ports/AuditRepo";
import RolePermissionRepo from "@modules/iam/core/app/ports/RolePermissionRepo";
import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";
import UserRoleRepo from "@modules/iam/core/app/ports/UserRoleRepo";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import AuditLog from "@modules/iam/core/domain/entities/AuditLog";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_IAM_MANAGE = "iam:manage";
const AUDIT_RESOURCE_ROLE   = "role";
const AUDIT_ACTION_DELETE   = "delete";

export interface DeleteRoleInput {
    actorUserId: string;
    roleId:      string;
}

/**
 * Xoá một role tuỳ chỉnh. Role hệ thống không bao giờ xoá được; role còn
 * đang được gán cho user nào đó cũng bị chặn — phải thu hồi hết trước.
 */
export default class DeleteRoleUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _roleRepo: RoleRepo,
        private readonly _userRoleRepo: UserRoleRepo,
        private readonly _rolePermissionRepo: RolePermissionRepo,
        private readonly _auditRepo: AuditRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     * @param input.roleId      Id role cần xoá.
     *
     * @throws {AccessDeniedError}         Actor không có quyền `iam:manage`.
     * @throws {RoleNotFoundError}         Role không tồn tại.
     * @throws {RoleIsSystemError}         Role là role hệ thống.
     * @throws {RoleAssignmentExistsError} Role còn đang được gán cho ít nhất một user.
     */
    public async execute(input: DeleteRoleInput): Promise<void> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        const role = await this._roleRepo.getById(input.roleId);
        if (role == undefined) {
            throw new RoleNotFoundError();
        }
        if (role.isSystem) {
            throw new RoleIsSystemError();
        }
        if (await this._userRoleRepo.existsByRoleId(role.id)) {
            throw new RoleAssignmentExistsError();
        }

        await this._rolePermissionRepo.deleteByRoleId(role.id);
        await this._roleRepo.deleteById(role.id);

        await this._auditRepo.save(AuditLog.create({
            id:          UUIDv7(),
            actorUserId: input.actorUserId,
            resource:    AUDIT_RESOURCE_ROLE,
            action:      AUDIT_ACTION_DELETE,
            resourceId:  role.id,
            changes:     null,
        }));
    }
}
