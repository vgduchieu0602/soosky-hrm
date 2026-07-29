/** Dạng document lưu trữ của aggregate `Attendance`. */
export default interface AttendanceDocument {
    _id:            string;
    employeeId:     string;
    date:           Date;
    shiftId:        string;
    checkIn:        Date | null;
    checkOut:       Date | null;
    status:         string;
    workHours:      number | null;
    lateMinutes:    number;
    earlyMinutes:   number;
    session:        string;
    congWeight:     number;
    source:         string;
    note:           string | null;
    leaveRequestId: string | null;
    createdAt:      Date;
}
