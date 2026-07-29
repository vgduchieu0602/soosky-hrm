/** Dạng document lưu trữ của aggregate `EmployeeAsset`. */
export default interface EmployeeAssetMongoDoc {
    _id:          string;
    employeeId:   string;
    assetName:    string;
    assetCode:    string;
    assignedDate: Date;
    returnedDate: Date | null;
    condition:    string;
    note:         string | null;
    createdAt:    Date;
}
