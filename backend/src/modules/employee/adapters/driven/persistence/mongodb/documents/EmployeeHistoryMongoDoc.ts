/** Dạng document lưu trữ của aggregate `EmployeeHistory` (append-only). */
export default interface EmployeeHistoryMongoDoc {
    _id:             string;
    employeeId:      string;
    eventType:       string;
    fromValue:       Record<string, unknown> | null;
    toValue:         Record<string, unknown> | null;
    effectiveDate:   Date;
    note:            string | null;
    createdByUserId: string | null;
    createdAt:       Date;
}
