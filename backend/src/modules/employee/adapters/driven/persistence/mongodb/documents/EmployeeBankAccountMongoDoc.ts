/** Dạng document lưu trữ của aggregate `EmployeeBankAccount`. */
export default interface EmployeeBankAccountMongoDoc {
    _id:           string;
    employeeId:    string;
    bankName:      string;
    branch:        string | null;
    accountNumber: string;
    accountHolder: string;
    isPrimary:     boolean;
    createdAt:     Date;
}
