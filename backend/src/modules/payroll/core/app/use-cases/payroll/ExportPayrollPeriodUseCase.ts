import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";

const CSV_HEADER = [
    "employeeId", "standardWorkDays", "actualWorkDays", "baseSalary", "proRatedBaseSalary",
    "totalAllowances", "totalBonuses", "grossSalary", "insurance", "tax", "unionFee",
    "otherDeductions", "netSalary", "status",
];

function csvEscape(value: string | number): string {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Xuất bảng lương một kỳ dạng CSV — thay cho file .xlsx có định dạng của bản
 * cũ (`exceljs` không nằm trong dependency của stack mới, xem payroll-report.md).
 * Cùng dữ liệu, khác định dạng xuất.
 */
export default class ExportPayrollPeriodUseCase {
    public constructor(
        private readonly _payslips: PayslipRepo,
    ) {}

    public async execute(input: { periodId: string }): Promise<string> {
        const payslips = await this._payslips.listByPeriod(input.periodId);

        const rows = payslips.map(p => [
            p.employeeId, p.workdays.standardWorkDays, p.workdays.actualWorkDays,
            p.breakdown.baseSalary, p.breakdown.proRatedBaseSalary, p.breakdown.totalAllowances,
            p.breakdown.totalBonuses, p.breakdown.grossSalary, p.breakdown.insurance, p.breakdown.tax,
            p.breakdown.unionFee, p.breakdown.otherDeductions, p.breakdown.netSalary, p.status,
        ].map(csvEscape).join(","));

        return [CSV_HEADER.join(","), ...rows].join("\n");
    }
}
