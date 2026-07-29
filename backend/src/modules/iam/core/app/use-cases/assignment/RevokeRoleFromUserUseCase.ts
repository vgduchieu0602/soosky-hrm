import { RoleAssignmentNotFoundError } from "@modules/iam/core/app/errors/RoleAssignmentNotFoundError";
import AuditRepo from "@modules/iam/core/app/ports/AuditRepo";
import UserRoleRepo from "@modules/iam/core/app/ports/UserRoleRepo";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import AuditLog from "@modules/iam/core/domain/entities/AuditLog";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_IAM_MANAGE     = "iam:manage";
const AUDIT_RESOURCE_ASSIGNMENT = "user-role";
const AUDIT_ACTION_REVOKE       = "revoke";

export interface RevokeRoleFromUserInput {
    actorUserId: string;
    userId:      string;
    roleId:      string;
}

/**
 * Thu hồi một role đã gán cho một user.
 */
export default class RevokeRoleFromUserUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _userRoleRepo: UserRoleRepo,
        private readonly _auditRepo: AuditRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     * @param input.userId      Id user cần thu hồi role.
     * @param input.roleId      Id role cần thu hồi.
     *
     * @throws {AccessDeniedError}            Actor không có quyền `iam:manage`.
     * @throws {RoleAssignmentNotFoundError}  User chưa từng được gán role này.
     */
    public async execute(input: RevokeRoleFromUserInput): Promise<void> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        const userRole = await this._userRoleRepo.getByUserAndRole(input.userId, input.roleId);
        if (userRole == undefined) {
            throw new RoleAssignmentNotFoundError();
        }

        await this._userRoleRepo.deleteById(userRole.id);

        await this._auditRepo.save(AuditLog.create({
            id:          UUIDv7(),
            actorUserId: input.actorUserId,
            resource:    AUDIT_RESOURCE_ASSIGNMENT,
            action:      AUDIT_ACTION_REVOKE,
            resourceId:  userRole.id,
            changes:     { userId: input.userId, roleId: input.roleId },
        }));
    }
}
