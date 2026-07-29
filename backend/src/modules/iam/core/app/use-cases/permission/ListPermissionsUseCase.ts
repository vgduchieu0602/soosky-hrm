import PermissionRepo from "@modules/iam/core/app/ports/PermissionRepo";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import Permission from "@modules/iam/core/domain/entities/Permission";

const PERMISSION_IAM_MANAGE = "iam:manage";

export interface ListPermissionsInput {
    actorUserId: string;
}

/**
 * Liệt kê catalog quyền hạn hệ thống — chỉ đọc, catalog được nạp một lần lúc
 * khởi động qua seed.
 */
export default class ListPermissionsUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _permissionRepo: PermissionRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     *
     * @throws {AccessDeniedError} Actor không có quyền `iam:manage`.
     */
    public async execute(input: ListPermissionsInput): Promise<Permission[]> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        return this._permissionRepo.list();
    }
}
