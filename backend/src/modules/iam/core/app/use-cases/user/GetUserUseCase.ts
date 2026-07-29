import AccessControl from "@modules/iam/core/app/services/AccessControl";
import { UserNotFoundError } from "@modules/iam/core/app/errors/UserNotFoundError";
import UserRepo from "@modules/iam/core/app/ports/UserRepo";
import User from "@modules/iam/core/domain/entities/User";

const PERMISSION_IAM_MANAGE = "iam:manage";

export interface GetUserInput {
    actorUserId: string;
    userId:      string;
}

export default class GetUserUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _userRepo: UserRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     * @param input.userId      Id user cần xem.
     *
     * @throws {AccessDeniedError} Actor không có quyền `iam:manage`.
     * @throws {UserNotFoundError} User không tồn tại.
     */
    public async execute(input: GetUserInput): Promise<User> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        const user = await this._userRepo.getById(input.userId);
        if (user == undefined) {
            throw new UserNotFoundError();
        }
        return user;
    }
}
