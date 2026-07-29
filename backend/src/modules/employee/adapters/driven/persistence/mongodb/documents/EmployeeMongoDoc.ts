/** Dạng document lưu trữ của aggregate `Employee`. */
export default interface EmployeeMongoDoc {
    _id:             string;
    code:            string;
    name:            string;
    email:           string | null;
    phone:           string | null;
    dob:             Date | null;
    gender:          string | null;
    departmentId:    string;
    positionId:      string;
    managerId:       string | null;
    hireDate:        Date;
    terminationDate: Date | null;
    employeeType:    string;
    status:          string;
    accountId:       string | null;
    createdAt:       Date;
}
