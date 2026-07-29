import EmployeeSubResourceNotFoundError from "@modules/employee/core/app/errors/EmployeeSubResourceNotFoundError";
import EmployeeAssetRepo from "@modules/employee/core/app/ports/EmployeeAssetRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import { AssetCondition } from "@modules/employee/core/domain/entities/EmployeeAsset";

const PERMISSION_KEY = "employee:manage";

export interface UpdateEmployeeAssetInput {
    assetId:       string;
    returnedDate?: Date | null | undefined;
    condition?: AssetCondition | undefined;
    note?: string | null | undefined;
    actorUserId:   string;
}

/**
 * Cập nhật một tài sản (thu hồi, đổi tình trạng, ghi chú).
 *
 * @throws {AccessDeniedError}               Actor không có quyền `employee:manage`.
 * @throws {EmployeeSubResourceNotFoundError} Tài sản không tồn tại.
 */
export default class UpdateEmployeeAssetUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _assetRepo:   EmployeeAssetRepo,
    ) {}

    public async execute(input: UpdateEmployeeAssetInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const asset = await this._assetRepo.getById(input.assetId);
        if (asset == undefined) throw new EmployeeSubResourceNotFoundError();

        asset.update({
            returnedDate: input.returnedDate,
            condition:    input.condition,
            note:         input.note,
        });

        await this._assetRepo.save(asset);
    }
}
