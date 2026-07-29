export type PayrollEmploymentStatus = "official" | "probation" | "internship";

export interface EmployeeContractBasis {
    contractId:        string;
    employeeId:        string;
    baseSalary:         number;
    employmentStatus:  PayrollEmploymentStatus;
}

/**
 * Cổng tra cứu dữ liệu nhân sự mà module Payroll cần — id nhân viên đang hoạt
 * động (để chạy lương cả kỳ) và cơ sở hợp đồng (lương cơ bản + tình trạng lao
 * động) tại một ngày. Module Payroll KHÔNG import trực tiếp module Employee —
 * composition root (infra) lắp hiện thực dựa trên `composition.ts` của
 * Employee (mở rộng thêm hàm đọc khi cần, xem `EmployeeDirectory` của Employee).
 *
 * Giản lược: MỘT hợp đồng active tại ngày trả lương cho mỗi nhân viên (không
 * tách nhiều dòng lương khi đổi hợp đồng giữa tháng như bản cũ — xem
 * payroll-report.md).
 */
export default interface EmployeeDirectory {
    /** Id toàn bộ nhân viên đang hoạt động (không phải `terminated`) — dùng khi chạy lương cả kỳ. */
    listActiveEmployeeIds(): Promise<string[]>;

    /** Cơ sở hợp đồng active của nhân viên tại một ngày, hoặc `undefined` nếu không có. */
    contractBasis(employeeId: string, atDate: Date): Promise<EmployeeContractBasis | undefined>;

    /** Id nhân viên gắn với một tài khoản đăng nhập — dùng cho tự-phục vụ (`/payrolls/me`). */
    findEmployeeIdByUserId(userId: string): Promise<string | undefined>;
}
