import Payslip, { PayslipStatus } from "@modules/payroll/core/domain/entities/Payslip";

export interface PayslipListFilter {
    payrollPeriodId?: string;
    employeeId?:      string;
    status?:          PayslipStatus;
}

export interface PayslipTotalsRow {
    status: PayslipStatus;
    count:  number;
    gross:  number;
    net:    number;
}

export default interface PayslipRepo {
    getById(id: string): Promise<Payslip | undefined>;
    findOne(payrollPeriodId: string, employeeId: string): Promise<Payslip | undefined>;
    listByPeriod(payrollPeriodId: string): Promise<Payslip[]>;
    listByPeriodAndStatus(payrollPeriodId: string, status: PayslipStatus, employeeId?: string): Promise<Payslip[]>;
    /** Phiếu lương đã duyệt/đã chi (không phải draft) của một nhân viên, mới nhất trước. */
    listFinalizedByEmployee(employeeId: string): Promise<Payslip[]>;
    paginate(filter: PayslipListFilter, page: number, limit: number): Promise<{ items: Payslip[]; total: number }>;
    totalsForPeriod(payrollPeriodId: string): Promise<PayslipTotalsRow[]>;
    countByPeriod(payrollPeriodId: string): Promise<number>;
    countByStatus(payrollPeriodId: string, status: PayslipStatus): Promise<number>;
    save(payslip: Payslip): Promise<void>;
}
