/**
 * Dạng document lưu trữ của aggregate `User` (bản chiếu Account) trong module IAM.
 */
export default interface UserDocument {
    _id:         string;
    displayName: string;
    email:       string;
    status:      string;
    createdAt:   Date;
}
