/** Dạng document lưu trữ của aggregate `AttendanceSymbol`. */
export default interface AttendanceSymbolDocument {
    _id:         string;
    code:        string;
    name:        string;
    description: string;
    createdAt:   Date;
}
