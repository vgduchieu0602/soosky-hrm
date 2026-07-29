/** Dạng document lưu trữ của aggregate `EmployeeContract`. */
export default interface EmployeeContractMongoDoc {
    _id:              string;
    employeeId:       string;
    contractType:     string;
    employmentStatus: string;
    contractNumber:   string;
    startDate:        Date;
    endDate:          Date | null;
    baseSalary:       number;
    currency:         string;
    fileUrl:          string | null;
    status:           string;
    createdAt:        Date;
}
