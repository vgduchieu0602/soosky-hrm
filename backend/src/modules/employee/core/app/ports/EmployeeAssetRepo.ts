import EmployeeAsset from "@modules/employee/core/domain/entities/EmployeeAsset";

export default interface EmployeeAssetRepo {
    getById(id: string): Promise<EmployeeAsset | undefined>;
    listByEmployeeId(employeeId: string): Promise<EmployeeAsset[]>;
    save(asset: EmployeeAsset): Promise<void>;
    deleteById(id: string): Promise<void>;
}
