import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import Role from "@modules/iam/core/domain/entities/Role";

const PERMISSION_IAM_MANAGE = "iam:manage";

export interface ListRolesInput {
    actorUserId: string;
}

export default class ListRolesUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _roleRepo: RoleRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     *
     * @returns Danh sách role, theo thứ tự tạo.
     *
     * @throws {AccessDeniedError} Actor không có quyền `iam:manage`.
     */
    public async execute(input: ListRolesInput): Promise<Role[]> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        return this._roleRepo.list();
    }
}
