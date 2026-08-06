import AccessControl from "@modules/iam/core/app/services/AccessControl";

/**
 * Tập khoá quyền hạn hiệu lực của CHÍNH actor.
 *
 * Không kiểm quyền: đọc quyền của bản thân là thông tin actor đã có (nó quyết
 * định mọi thứ họ làm được). Không dùng `GetUserPermissionsUseCase` vì use-case
 * đó đòi `iam:manage` — đúng cho việc xem quyền NGƯỜI KHÁC, nhưng sẽ chặn mọi
 * nhân viên đọc quyền của chính mình để hiện đúng menu.
 */
export default class GetMyPermissionsUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
    ) {}

    public async execute(input: { actorUserId: string }): Promise<string[]> {
        return this._accessControl.listPermissionsOf(input.actorUserId);
    }
}
