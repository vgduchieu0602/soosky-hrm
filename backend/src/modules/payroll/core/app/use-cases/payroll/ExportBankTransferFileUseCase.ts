import BankTransferProfileMissingError from "@modules/payroll/core/app/errors/BankTransferProfileMissingError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import BankTransferProfileDirectory, { BankTransferProfileView } from "@modules/payroll/core/app/ports/BankTransferProfileDirectory";
import EmployeeDirectory, { EmployeePayoutInfo } from "@modules/payroll/core/app/ports/EmployeeDirectory";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";
import Payslip from "@modules/payroll/core/domain/entities/Payslip";

const PERMISSION_KEY = "payroll:approve";

export interface ExportBankTransferFileOutput {
    fileName:     string;
    /** Nội dung file (đã gồm BOM nếu hồ sơ yêu cầu). */
    content:      string;
    bankCode:     string;
    bankName:     string;
    rowCount:     number;
    totalAmount:  number;
    /** Nhân viên bị loại khỏi file, kèm lý do — không bao giờ bỏ im. */
    skipped:      { employeeId: string; reason: string }[];
}

/**
 * Sinh file chuyển lương cho một kỳ, theo mẫu ngân hàng Admin/HR đã cấu hình
 * trong Cài đặt.
 *
 * Quyền `payroll:approve`: file này là LỆNH CHI, không phải báo cáo. Người lập
 * lương xuất được nó thì bốn mắt mất nghĩa ở đúng chỗ tiền ra khỏi công ty.
 *
 * CHỈ lấy phiếu `approved` và `paid`. Phiếu `draft` bị loại và nêu rõ trong
 * `skipped` — chuyển tiền theo con số chưa ai duyệt là sự cố, không phải tiện lợi.
 *
 * @throws {AccessDeniedError}                  Actor không có quyền `payroll:approve`.
 * @throws {PayrollPeriodNotFoundError}         Không tìm thấy kỳ lương.
 * @throws {BankTransferProfileMissingError}    Chưa bật hồ sơ ngân hàng nào.
 */
export default class ExportBankTransferFileUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _payslips: PayslipRepo,
        private readonly _employees: EmployeeDirectory,
        private readonly _bankProfiles: BankTransferProfileDirectory,
    ) {}

    public async execute(input: { periodId: string; actorUserId: string }): Promise<ExportBankTransferFileOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();

        const profile = await this._bankProfiles.activeProfile();
        if (profile == undefined) throw new BankTransferProfileMissingError();

        const payslips = await this._payslips.listByPeriod(input.periodId);
        const skipped: { employeeId: string; reason: string }[] = [];
        const lines: string[] = [];
        let totalAmount = 0;
        let sequence = 0;

        for (const payslip of payslips) {
            if (payslip.status === "draft") {
                skipped.push({ employeeId: payslip.employeeId, reason: "Payslip is still draft (not approved)" });
                continue;
            }

            const payout = await this._employees.payoutInfo(payslip.employeeId);
            if (payout == undefined) {
                skipped.push({ employeeId: payslip.employeeId, reason: "Employee not found" });
                continue;
            }
            if (payout.bankAccountNumber.trim().length === 0) {
                skipped.push({ employeeId: payslip.employeeId, reason: "No bank account on file" });
                continue;
            }
            // Net = 0 (nghỉ không lương cả kỳ, truy thu ăn hết lương) không tạo lệnh
            // chi: ngân hàng từ chối dòng 0 đồng và nó chỉ làm nhiễu bảng đối soát.
            if (payslip.netSalary <= 0) {
                skipped.push({ employeeId: payslip.employeeId, reason: "Net salary is zero" });
                continue;
            }

            sequence += 1;
            totalAmount += payslip.netSalary;
            lines.push(buildRow(profile, { payslip, payout, period, sequence }));
        }

        const header = profile.includeHeader
            ? [profile.columns.map(column => escapeCell(column.header, profile.delimiter)).join(profile.delimiter)]
            : [];
        const body = [...header, ...lines].join("\r\n");

        return {
            // BOM: nhiều cổng ngân hàng đọc UTF-8 không BOM thành ký tự lỗi ở tên tiếng Việt.
            content:     (profile.utf8Bom ? "\uFEFF" : "") + body,
            fileName:    `bank-transfer_${profile.code}_${period.name.value}.csv`,
            bankCode:    profile.code,
            bankName:    profile.bankName,
            rowCount:    lines.length,
            totalAmount,
            skipped,
        };
    }
}

interface RowContext {
    payslip:  Payslip;
    payout:   EmployeePayoutInfo;
    period:   PayrollPeriod;
    sequence: number;
}

function buildRow(profile: BankTransferProfileView, ctx: RowContext): string {
    return profile.columns
        .map(column => escapeCell(cellValue(profile, column.source, column.staticValue, ctx), profile.delimiter))
        .join(profile.delimiter);
}

function cellValue(
    profile: BankTransferProfileView,
    source: string,
    staticValue: string | null,
    ctx: RowContext,
): string {
    switch (source) {
        case "sequence":            return String(ctx.sequence);
        case "employee_code":       return ctx.payout.employeeCode;
        case "employee_name":       return ctx.payout.fullName;
        case "bank_account_number": return ctx.payout.bankAccountNumber;
        case "bank_account_holder": return ctx.payout.bankAccountHolder;
        case "bank_name":           return ctx.payout.bankName;
        case "bank_branch":         return ctx.payout.bankBranch ?? "";
        case "net_salary":          return formatAmount(ctx.payslip.netSalary, profile.amountFormat);
        case "period_name":         return ctx.period.name.value;
        case "pay_date":            return formatDate(ctx.period.payDate, profile.dateFormat);
        case "static":              return staticValue ?? "";
        // Nguồn lạ (hồ sơ cấu hình bởi bản mới hơn) ra ô rỗng thay vì làm chết cả
        // file — kế toán thấy cột trống và sửa cấu hình, không mất luôn lệnh chi.
        default:                    return "";
    }
}

function formatAmount(amount: number, format: string): string {
    const rounded = Math.round(amount);
    return format === "grouped" ? rounded.toLocaleString("en-US") : String(rounded);
}

function formatDate(date: Date, format: string): string {
    const day   = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year  = String(date.getUTCFullYear());

    if (format === "yyyy-MM-dd") return `${year}-${month}-${day}`;
    if (format === "ddMMyyyy")   return `${day}${month}${year}`;
    return `${day}/${month}/${year}`;
}

function escapeCell(value: string, delimiter: string): string {
    const needsQuote = value.includes(delimiter) || /["\r\n]/.test(value);
    return needsQuote ? `"${value.replace(/"/g, '""')}"` : value;
}
