import { RoleNotFoundError } from "@modules/iam/core/app/errors/RoleNotFoundError";
import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import Role from "@modules/iam/core/domain/entities/Role";

const PERMISSION_IAM_MANAGE = "iam:manage";

export interface GetRoleInput {
    actorUserId: string;
    roleId:      string;
}

export default class GetRoleUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _roleRepo: RoleRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     * @param input.roleId      Id role cần xem.
     *
     * @throws {AccessDeniedError} Actor không có quyền `iam:manage`.
     * @throws {RoleNotFoundError} Role không tồn tại.
     */
    public async execute(input: GetRoleInput): Promise<Role> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        const role = await this._roleRepo.getById(input.roleId);
        if (role == undefined) {
            throw new RoleNotFoundError();
        }
        return role;
    }
}
