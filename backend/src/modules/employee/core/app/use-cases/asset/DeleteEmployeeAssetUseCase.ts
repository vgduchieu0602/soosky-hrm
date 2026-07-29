import EmployeeAssetRepo from "@modules/employee/core/app/ports/EmployeeAssetRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "employee:manage";

export interface DeleteEmployeeAssetInput {
    assetId:     string;
    actorUserId: string;
}

/**
 * Xoá một tài sản. Idempotent — xoá id không tồn tại không lỗi.
 *
 * @throws {AccessDeniedError} Actor không có quyền `employee:manage`.
 */
export default class DeleteEmployeeAssetUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _assetRepo:   EmployeeAssetRepo,
    ) {}

    public async execute(input: DeleteEmployeeAssetInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);
        await this._assetRepo.deleteById(input.assetId);
    }
}
