import EmployeeAssetRepo from "@modules/employee/core/app/ports/EmployeeAssetRepo";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import EmployeeAsset from "@modules/employee/core/domain/entities/EmployeeAsset";

export interface ListEmployeeAssetsInput {
    employeeId:  string;
    actorUserId: string;
}

/**
 * Liệt kê tài sản đã cấp phát cho một nhân viên, trong phạm vi actor được đọc.
 *
 * @throws {AccessDeniedError} Actor không được đọc hồ sơ của nhân viên này.
 */
export default class ListEmployeeAssetsUseCase {
    public constructor(
        private readonly _accessScope: EmployeeAccessScope,
        private readonly _assetRepo: EmployeeAssetRepo,
    ) {}

    public async execute(input: ListEmployeeAssetsInput): Promise<EmployeeAsset[]> {
        await this._accessScope.assertCanRead(input.actorUserId, input.employeeId);
        return this._assetRepo.listByEmployeeId(input.employeeId);
    }
}
