/**
 * Dạng document lưu trữ của aggregate `Account` trong module Auth.
 */
export default interface AccountDocument {
    _id:          string;
    email:        string;
    passwordHash: string;
    fullName:     string;
    role:         string;
    status:       string;
    verifiedAt:   Date | null;
    createdAt:    Date;
}
