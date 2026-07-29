/** Dạng document lưu trữ của aggregate `Position`. */
export default interface PositionDocument {
    _id:          string;
    code:         string;
    title:        string;
    departmentId: string;
    level:        number;
    description:  string;
    status:       string;
    createdAt:    Date;
}
