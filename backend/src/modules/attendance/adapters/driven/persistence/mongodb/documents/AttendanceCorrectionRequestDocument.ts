/**
 * Dạng document lưu trữ của aggregate `AttendanceCorrectionRequest`.
 */
export default interface AttendanceCorrectionRequestDocument {
    _id:               string;
    employeeId:        string;
    date:              Date;
    requestedCheckIn:  Date | null;
    requestedCheckOut: Date | null;
    reason:            string;
    status:            string;
    createdBy:         string;
    createdAt:         Date;
    decidedBy:         string | null;
    decidedAt:         Date | null;
    decisionNote:      string | null;
}
