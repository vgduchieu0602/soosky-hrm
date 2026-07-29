/** Dạng document lưu trữ của aggregate `EmployeeProfile`. */
export default interface EmployeeProfileMongoDoc {
    _id:               string;
    employeeId:        string;
    firstName:         string;
    lastName:          string;
    middleName:        string | null;
    dateOfBirth:       Date | null;
    gender:            string | null;
    nationality:       string | null;
    maritalStatus:     string | null;
    avatarUrl:         string | null;
    personalEmail:     string | null;
    workEmail:         string | null;
    phone:             string | null;
    address:           string | null;
    socialInsuranceNo: string | null;
    taxCode:           string | null;
    vehiclePlate:      string | null;
    createdAt:         Date;
}
