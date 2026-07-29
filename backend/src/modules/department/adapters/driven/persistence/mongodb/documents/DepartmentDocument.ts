/** Dạng document lưu trữ của aggregate `Department`. */
export default interface DepartmentDocument {
    _id:                string;
    code:               string;
    name:               string;
    description:        string;
    parentDepartmentId: string | null;
    managerId:          string | null;
    status:             string;
    createdAt:          Date;
}
