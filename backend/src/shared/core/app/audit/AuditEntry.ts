/**
 * Một dòng nhật ký thao tác, dưới dạng module nghiệp vụ nhìn thấy: "ai làm gì,
 * trên bản ghi nào, đổi cái gì".
 *
 * Nằm ở shared kernel vì nhiều module cùng ghi vào một sổ audit (module IAM sở
 * hữu sổ đó). Nhờ vậy mỗi module chỉ khai một cổng `AuditTrail` với đúng hình
 * dạng này, và composition root nối tất cả về cùng một nơi lưu.
 */
export interface AuditEntry {
    /** `null` khi thao tác do hệ thống thực hiện (job, event handler). */
    actorUserId: string | null;
    /**
     * Loại bản ghi bị tác động, snake_case, có tiền tố nghiệp vụ:
     * `employee`, `employee_contract`, `employee_bank_account`,
     * `employee_document`, `employee_account`.
     */
    resource:    string;
    /** Hành động: `create` / `update` / `delete` / `terminate` / `grant_login` ... */
    action:      string;
    resourceId:  string | null;
    /**
     * Dữ liệu đã đổi. Quy ước: `{ before, after }` cho cập nhật, snapshot cho
     * tạo/xoá. KHÔNG ghi bí mật (mật khẩu, token) vào đây.
     */
    changes:     Record<string, unknown> | null;
}
