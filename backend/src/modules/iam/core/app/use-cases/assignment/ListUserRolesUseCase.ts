import { UserNotFoundError } from "@modules/iam/core/app/errors/UserNotFoundError";
import UserRepo from "@modules/iam/core/app/ports/UserRepo";
import UserRoleRepo from "@modules/iam/core/app/ports/UserRoleRepo";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import UserRole from "@modules/iam/core/domain/entities/UserRole";

const PERMISSION_IAM_MANAGE = "iam:manage";

export interface ListUserRolesInput {
    actorUserId: string;
    userId:      string;
}

/**
 * Liệt kê các role đang được gán cho một user.
 */
export default class ListUserRolesUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _userRepo: UserRepo,
        private readonly _userRoleRepo: UserRoleRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     * @param input.userId      Id user cần xem role.
     *
     * @throws {AccessDeniedError} Actor không có quyền `iam:manage`.
     * @throws {UserNotFoundError} User không tồn tại.
     */
    public async execute(input: ListUserRolesInput): Promise<UserRole[]> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        if (!await this._userRepo.existsById(input.userId)) {
            throw new UserNotFoundError();
        }

        return this._userRoleRepo.listByUserId(input.userId);
    }
}
