export type PayrollEmploymentStatus = "official" | "probation" | "internship";

export interface EmployeeContractBasis {
    contractId:        string;
    employeeId:        string;
    baseSalary:         number;
    employmentStatus:  PayrollEmploymentStatus;
}

/** Thông tin chi trả của một nhân viên — dùng khi sinh file chuyển lương. */
export interface EmployeePayoutInfo {
    employeeId:        string;
    employeeCode:      string;
    fullName:          string;
    /** Rỗng = nhân viên chưa khai tài khoản; phải loại khỏi file và báo rõ. */
    bankAccountNumber: string;
    bankAccountHolder: string;
    bankName:          string;
    bankBranch:        string | null;
}

/** Một đoạn hợp đồng có hiệu lực trong kỳ, đã cắt về trong biên kỳ. */
export interface EmployeeContractSegment {
    contractId:       string;
    contractNumber:   string;
    baseSalary:       number;
    employmentStatus: PayrollEmploymentStatus;
    /** Ngày bắt đầu hiệu lực TRONG kỳ (đã cắt theo biên kỳ). */
    from:             Date;
    /** Ngày kết thúc hiệu lực TRONG kỳ (đã cắt; hợp đồng vô thời hạn = cuối kỳ). */
    to:               Date;
}

/**
 * Cổng tra cứu dữ liệu nhân sự mà module Payroll cần — id nhân viên đang hoạt
 * động (để chạy lương cả kỳ) và cơ sở hợp đồng (lương cơ bản + tình trạng lao
 * động) tại một ngày. Module Payroll KHÔNG import trực tiếp module Employee —
 * composition root (infra) lắp hiện thực dựa trên `composition.ts` của
 * Employee (mở rộng thêm hàm đọc khi cần, xem `EmployeeDirectory` của Employee).
 *
 * `contractBasis` (một hợp đồng tại một ngày) vẫn giữ cho các đường cần một con
 * số duy nhất (preflight, gross-up). Việc tính lương thật dùng
 * `contractSegments` để xử lý đúng trường hợp đổi hợp đồng giữa kỳ.
 */
export default interface EmployeeDirectory {
    /** Id toàn bộ nhân viên đang hoạt động (không phải `terminated`) — dùng khi chạy lương cả kỳ. */
    listActiveEmployeeIds(): Promise<string[]>;

    /** Cơ sở hợp đồng active của nhân viên tại một ngày, hoặc `undefined` nếu không có. */
    contractBasis(employeeId: string, atDate: Date): Promise<EmployeeContractBasis | undefined>;

    /**
     * Các đoạn hợp đồng active phủ khoảng [from, to], sắp xếp theo thời gian và
     * đã cắt về trong biên kỳ. Rỗng = không có hợp đồng nào trong kỳ.
     */
    contractSegments(employeeId: string, from: Date, to: Date): Promise<EmployeeContractSegment[]>;

    /** Id nhân viên gắn với một tài khoản đăng nhập — dùng cho tự-phục vụ (`/payrolls/me`). */
    findEmployeeIdByUserId(userId: string): Promise<string | undefined>;

    /** Mã, tên và tài khoản ngân hàng chính — dùng khi xuất file chuyển lương. */
    payoutInfo(employeeId: string): Promise<EmployeePayoutInfo | undefined>;
}
