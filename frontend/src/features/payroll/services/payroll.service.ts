import api from "@core/http/axios";
import type {
  Allowance,
  AttendanceReadiness,
  PayrollPreflight,
  ApprovalResult,
  Bonus,
  CreatePeriodInput,
  Deduction,
  GrossUpInput,
  GrossUpResult,
  Paginated,
  PayrollPeriod,
  PayrollRecord,
  PeriodTotalRow,
  RunResult,
  TaxProfile,
} from "@features/payroll/types/payroll.types";

interface Env<T> {
  data: T;
}

export interface ListPayrollsParams {
  payrollPeriodId?: string;
  employeeId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const payrollService = {
  // ---- Periods ----
  async listPeriods(): Promise<PayrollPeriod[]> {
    const { data } = await api.get<Env<PayrollPeriod[]>>("/payroll/periods");
    return data.data ?? [];
  },
  async getPeriod(id: string): Promise<PayrollPeriod> {
    const { data } = await api.get<Env<PayrollPeriod>>(`/payroll/periods/${id}`);
    return data.data;
  },
  async createPeriod(input: CreatePeriodInput): Promise<PayrollPeriod> {
    const { data } = await api.post<Env<PayrollPeriod>>("/payroll/periods", input);
    return data.data;
  },
  async attendanceReadiness(id: string): Promise<AttendanceReadiness> {
    const { data } = await api.get<Env<AttendanceReadiness>>(`/payroll/periods/${id}/attendance-readiness`);
    return data.data;
  },
  async lockAttendance(id: string): Promise<PayrollPeriod> {
    const { data } = await api.post<Env<PayrollPeriod>>(`/payroll/periods/${id}/lock-attendance`);
    return data.data;
  },
  async unlockAttendance(id: string): Promise<PayrollPeriod> {
    const { data } = await api.post<Env<PayrollPeriod>>(`/payroll/periods/${id}/unlock-attendance`);
    return data.data;
  },
  async reopenPeriod(id: string): Promise<PayrollPeriod> {
    const { data } = await api.post<Env<PayrollPeriod>>(`/payroll/periods/${id}/reopen`);
    return data.data;
  },
  async deletePeriod(id: string): Promise<void> {
    await api.delete(`/payroll/periods/${id}`);
  },
  async closePeriod(id: string): Promise<PayrollPeriod> {
    const { data } = await api.post<Env<PayrollPeriod>>(`/payroll/periods/${id}/close`);
    return data.data;
  },

  // ---- Run ----
  async runPeriod(id: string, requireApprovedEvaluation = true): Promise<RunResult> {
    const { data } = await api.post<Env<RunResult>>(`/payroll/periods/${id}/run`, {
      requireApprovedEvaluation,
    });
    return data.data;
  },
  async runEmployee(id: string, employeeId: string): Promise<PayrollRecord> {
    const { data } = await api.post<Env<PayrollRecord>>(`/payroll/periods/${id}/run/${employeeId}`);
    return data.data;
  },

  // ---- NET → GROSS calculator ----
  async calculateGrossUp(input: GrossUpInput): Promise<GrossUpResult> {
    const { data } = await api.post<Env<GrossUpResult>>("/payroll/gross-up", input);
    return data.data;
  },

  // ---- Payrolls ----
  async listPayrolls(params: ListPayrollsParams): Promise<Paginated<PayrollRecord>> {
    const { data } = await api.get<Paginated<PayrollRecord>>("/payroll/payrolls", { params });
    return data;
  },
  async getPayroll(id: string): Promise<PayrollRecord> {
    const { data } = await api.get<Env<PayrollRecord>>(`/payroll/payrolls/${id}`);
    return data.data;
  },
  async preflight(periodId: string): Promise<PayrollPreflight> {
    const { data } = await api.get<Env<PayrollPreflight>>(`/payroll/periods/${periodId}/preflight`);
    return data.data;
  },
  async exportPeriod(periodId: string): Promise<Blob> {
    const res = await api.get(`/payroll/periods/${periodId}/export`, { responseType: "blob" });
    return res.data as Blob;
  },
  async periodTotals(periodId: string): Promise<PeriodTotalRow[]> {
    const { data } = await api.get<Env<PeriodTotalRow[]>>(`/payroll/periods/${periodId}/totals`);
    return data.data ?? [];
  },
  /** Self-service: own finalized payslips. */
  async myPayslips(): Promise<PayrollRecord[]> {
    const { data } = await api.get<Env<PayrollRecord[]>>("/payroll/payrolls/me");
    return data.data ?? [];
  },

  // ---- Workflow ----
  async approve(periodId: string, employeeId?: string): Promise<ApprovalResult> {
    const { data } = await api.post<Env<ApprovalResult>>(`/payroll/periods/${periodId}/approve`, {
      ...(employeeId ? { employeeId } : {}),
    });
    return data.data;
  },
  async revert(payrollId: string): Promise<{ id: string }> {
    const { data } = await api.post<Env<{ id: string }>>(`/payroll/payrolls/${payrollId}/revert`);
    return data.data;
  },
  async markPaid(periodId: string): Promise<ApprovalResult> {
    const { data } = await api.post<Env<ApprovalResult>>(`/payroll/periods/${periodId}/mark-paid`);
    return data.data;
  },

  // ---- Compensation ----
  async allowances(employeeId: string): Promise<Allowance[]> {
    const { data } = await api.get<Env<Allowance[]>>(`/payroll/employees/${employeeId}/allowances`);
    return data.data ?? [];
  },
  async createAllowance(input: Partial<Allowance>): Promise<Allowance> {
    const { data } = await api.post<Env<Allowance>>("/payroll/allowances", input);
    return data.data;
  },
  async updateAllowance(id: string, input: Partial<Allowance>): Promise<Allowance> {
    const { data } = await api.patch<Env<Allowance>>(`/payroll/allowances/${id}`, input);
    return data.data;
  },
  async deleteAllowance(id: string): Promise<void> {
    await api.delete(`/payroll/allowances/${id}`);
  },
  async bonuses(employeeId: string): Promise<Bonus[]> {
    const { data } = await api.get<Env<Bonus[]>>(`/payroll/employees/${employeeId}/bonuses`);
    return data.data ?? [];
  },
  async createBonus(input: Partial<Bonus>): Promise<Bonus> {
    const { data } = await api.post<Env<Bonus>>("/payroll/bonuses", input);
    return data.data;
  },
  async updateBonus(id: string, input: Partial<Bonus>): Promise<Bonus> {
    const { data } = await api.patch<Env<Bonus>>(`/payroll/bonuses/${id}`, input);
    return data.data;
  },
  async deleteBonus(id: string): Promise<void> {
    await api.delete(`/payroll/bonuses/${id}`);
  },
  async deductions(employeeId: string): Promise<Deduction[]> {
    const { data } = await api.get<Env<Deduction[]>>(`/payroll/employees/${employeeId}/deductions`);
    return data.data ?? [];
  },
  async createDeduction(input: Partial<Deduction>): Promise<Deduction> {
    const { data } = await api.post<Env<Deduction>>("/payroll/deductions", input);
    return data.data;
  },
  async updateDeduction(id: string, input: Partial<Deduction>): Promise<Deduction> {
    const { data } = await api.patch<Env<Deduction>>(`/payroll/deductions/${id}`, input);
    return data.data;
  },
  async deleteDeduction(id: string): Promise<void> {
    await api.delete(`/payroll/deductions/${id}`);
  },
  async taxProfiles(employeeId: string): Promise<TaxProfile[]> {
    const { data } = await api.get<Env<TaxProfile[]>>(
      `/payroll/employees/${employeeId}/tax-profiles`,
    );
    return data.data ?? [];
  },
  async upsertTaxProfile(input: Partial<TaxProfile>): Promise<TaxProfile> {
    const { data } = await api.post<Env<TaxProfile>>("/payroll/tax-profiles", input);
    return data.data;
  },
};
