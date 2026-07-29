/** Dạng document lưu trữ của aggregate `EmployeeDocument` (giấy tờ). */
export default interface EmployeeDocumentMongoDoc {
    _id:            string;
    employeeId:     string;
    documentType:   string;
    documentNumber: string;
    fileUrl:        string | null;
    issuedDate:     Date | null;
    expiryDate:     Date | null;
    issuedBy:       string | null;
    createdAt:      Date;
}
