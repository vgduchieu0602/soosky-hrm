/** Dạng document lưu trữ của aggregate `Holiday`. */
export default interface HolidayDocument {
    _id:         string;
    name:        string;
    date:        Date;
    isRecurring: boolean;
    createdAt:   Date;
}
