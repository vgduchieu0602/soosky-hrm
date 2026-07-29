import AccessControl from "@modules/iam/core/app/services/AccessControl";
import { UserNotFoundError } from "@modules/iam/core/app/errors/UserNotFoundError";
import UserRepo from "@modules/iam/core/app/ports/UserRepo";

const PERMISSION_IAM_MANAGE = "iam:manage";

export interface GetUserPermissionsInput {
    actorUserId: string;
    userId:      string;
}

/**
 * Trả về tập khoá quyền hạn hiệu lực của một user (hợp của quyền hạn mọi role
 * đang được gán).
 */
export default class GetUserPermissionsUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _userRepo: UserRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     * @param input.userId      Id user cần xem quyền hạn.
     *
     * @throws {AccessDeniedError} Actor không có quyền `iam:manage`.
     * @throws {UserNotFoundError} User không tồn tại.
     */
    public async execute(input: GetUserPermissionsInput): Promise<string[]> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        const user = await this._userRepo.getById(input.userId);
        if (user == undefined) {
            throw new UserNotFoundError();
        }

        return this._accessControl.listPermissionsOf(input.userId);
    }
}
