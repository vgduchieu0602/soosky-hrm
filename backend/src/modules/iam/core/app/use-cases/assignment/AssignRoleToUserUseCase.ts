import { RoleAssignmentExistsError } from "@modules/iam/core/app/errors/RoleAssignmentExistsError";
import { RoleNotFoundError } from "@modules/iam/core/app/errors/RoleNotFoundError";
import { UserNotFoundError } from "@modules/iam/core/app/errors/UserNotFoundError";
import AuditRepo from "@modules/iam/core/app/ports/AuditRepo";
import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";
import UserRepo from "@modules/iam/core/app/ports/UserRepo";
import UserRoleRepo from "@modules/iam/core/app/ports/UserRoleRepo";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import AuditLog from "@modules/iam/core/domain/entities/AuditLog";
import UserRole from "@modules/iam/core/domain/entities/UserRole";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_IAM_MANAGE      = "iam:manage";
const AUDIT_RESOURCE_ASSIGNMENT  = "user-role";
const AUDIT_ACTION_ASSIGN        = "assign";

export interface AssignRoleToUserInput {
    actorUserId: string;
    userId:      string;
    roleId:      string;
}

/**
 * Gán một role cho một user.
 */
export default class AssignRoleToUserUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _userRepo: UserRepo,
        private readonly _roleRepo: RoleRepo,
        private readonly _userRoleRepo: UserRoleRepo,
        private readonly _auditRepo: AuditRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     * @param input.userId      Id user nhận role.
     * @param input.roleId      Id role cần gán.
     *
     * @returns Lượt gán vừa tạo.
     *
     * @throws {AccessDeniedError}         Actor không có quyền `iam:manage`.
     * @throws {UserNotFoundError}         User không tồn tại.
     * @throws {RoleNotFoundError}         Role không tồn tại.
     * @throws {RoleAssignmentExistsError} User đã được gán role này rồi.
     */
    public async execute(input: AssignRoleToUserInput): Promise<UserRole> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        if (!await this._userRepo.existsById(input.userId)) {
            throw new UserNotFoundError();
        }
        const role = await this._roleRepo.getById(input.roleId);
        if (role == undefined) {
            throw new RoleNotFoundError();
        }
        if (await this._userRoleRepo.getByUserAndRole(input.userId, input.roleId) != undefined) {
            throw new RoleAssignmentExistsError();
        }

        const userRole = UserRole.create(createUuidV7(), input.userId, input.roleId);
        await this._userRoleRepo.save(userRole);

        await this._auditRepo.save(AuditLog.create({
            id:          createUuidV7(),
            actorUserId: input.actorUserId,
            resource:    AUDIT_RESOURCE_ASSIGNMENT,
            action:      AUDIT_ACTION_ASSIGN,
            resourceId:  userRole.id,
            changes:     { userId: input.userId, roleId: input.roleId },
        }));

        return userRole;
    }
}
