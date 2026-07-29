import EmployeeAsset from "@modules/employee/core/domain/entities/EmployeeAsset";

export interface EmployeeAssetDTO {
    id:           string;
    employeeId:   string;
    assetName:    string;
    assetCode:    string;
    assignedDate: string;
    returnedDate: string | null;
    condition:    string;
    note:         string | null;
    createdAt:    string;
}

const EmployeeAssetPresenter = {
    toDTO(asset: EmployeeAsset): EmployeeAssetDTO {
        return {
            id:           asset.id,
            employeeId:   asset.employeeId,
            assetName:    asset.assetName,
            assetCode:    asset.assetCode,
            assignedDate: asset.assignedDate.toISOString(),
            returnedDate: asset.returnedDate?.toISOString() ?? null,
            condition:    asset.condition,
            note:         asset.note,
            createdAt:    asset.createdAt.toISOString(),
        };
    },
};

export default EmployeeAssetPresenter;
