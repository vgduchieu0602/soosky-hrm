import EmployeeAssetRepo from "@modules/employee/core/app/ports/EmployeeAssetRepo";
import EmployeeAsset from "@modules/employee/core/domain/entities/EmployeeAsset";

export interface ListEmployeeAssetsInput {
    employeeId: string;
}

/** Liệt kê tài sản đã cấp phát cho một nhân viên. */
export default class ListEmployeeAssetsUseCase {
    public constructor(
        private readonly _assetRepo: EmployeeAssetRepo,
    ) {}

    public async execute(input: ListEmployeeAssetsInput): Promise<EmployeeAsset[]> {
        return this._assetRepo.listByEmployeeId(input.employeeId);
    }
}
