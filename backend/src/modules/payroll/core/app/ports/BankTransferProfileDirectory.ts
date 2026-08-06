/** Một cột của mẫu file chuyển lương. */
export interface BankTransferColumnView {
    header:      string;
    /** Khớp `BANK_COLUMN_SOURCES` của module Setting; nguồn lạ ra cột rỗng. */
    source:      string;
    staticValue: string | null;
}

export interface BankTransferProfileView {
    code:          string;
    bankName:      string;
    delimiter:     string;
    includeHeader: boolean;
    utf8Bom:       boolean;
    amountFormat:  string;
    dateFormat:    string;
    columns:       BankTransferColumnView[];
}

/**
 * Cổng đọc cấu hình ngân hàng (module Setting) mà Payroll cần để sinh file
 * chuyển lương. Payroll KHÔNG biết ngân hàng nào, chỉ biết mô tả cột.
 */
export default interface BankTransferProfileDirectory {
    /** `undefined` khi Admin/HR chưa cấu hình và bật hồ sơ ngân hàng nào. */
    activeProfile(): Promise<BankTransferProfileView | undefined>;
}
