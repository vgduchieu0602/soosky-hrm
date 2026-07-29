/** Dạng document lưu trữ của aggregate `Shift`. */
export default interface ShiftDocument {
    _id:          string;
    code:         string;
    name:         string;
    startTime:    string;
    endTime:      string;
    breakMinutes: number;
    workingDays:  number[];
    status:       string;
    createdAt:    Date;
}
