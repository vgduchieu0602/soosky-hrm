import EmployeeAssetMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeAssetMongoDoc";
import EmployeeAsset, { AssetCondition } from "@modules/employee/core/domain/entities/EmployeeAsset";

const EmployeeAssetMapper = {
    toDocument(asset: EmployeeAsset): EmployeeAssetMongoDoc {
        return {
            _id:          asset.id,
            employeeId:   asset.employeeId,
            assetName:    asset.assetName,
            assetCode:    asset.assetCode,
            assignedDate: asset.assignedDate,
            returnedDate: asset.returnedDate,
            condition:    asset.condition,
            note:         asset.note,
            createdAt:    asset.createdAt,
        };
    },

    toDomain(document: EmployeeAssetMongoDoc): EmployeeAsset {
        return EmployeeAsset.rehydrate({
            id:           document._id,
            employeeId:   document.employeeId,
            assetName:    document.assetName,
            assetCode:    document.assetCode,
            assignedDate: document.assignedDate,
            returnedDate: document.returnedDate,
            condition:    document.condition as AssetCondition,
            note:         document.note,
            createdAt:    document.createdAt,
        });
    },
};

export default EmployeeAssetMapper;
