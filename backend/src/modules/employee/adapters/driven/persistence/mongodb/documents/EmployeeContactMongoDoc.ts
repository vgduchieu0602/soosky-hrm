/** Dạng document lưu trữ của aggregate `EmployeeContact`. */
export default interface EmployeeContactMongoDoc {
    _id:          string;
    employeeId:   string;
    name:         string;
    relationship: string;
    phone:        string | null;
    email:        string | null;
    address:      string | null;
    isPrimary:    boolean;
    createdAt:    Date;
}
