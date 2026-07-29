import AccessControl from "@modules/iam/core/app/services/AccessControl";
import UserRepo from "@modules/iam/core/app/ports/UserRepo";
import User from "@modules/iam/core/domain/entities/User";

const PERMISSION_IAM_MANAGE = "iam:manage";

export interface ListUsersInput {
    actorUserId: string;
}

/**
 * Liệt kê toàn bộ user (bản chiếu Account) trong hệ thống.
 */
export default class ListUsersUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _userRepo: UserRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     *
     * @returns Danh sách user, theo thứ tự tạo.
     *
     * @throws {AccessDeniedError} Actor không có quyền `iam:manage`.
     */
    public async execute(input: ListUsersInput): Promise<User[]> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        return this._userRepo.list();
    }
}
