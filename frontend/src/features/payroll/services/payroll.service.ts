import api from "@core/http/axios";
import type {
  Allowance,
  AmountType,
  AttendanceReadiness,
  EvaluationReadiness,
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
  BankTransferFileResult,
  PayrollVariance,
  PeriodTotalRow,
  RetroAdjustment,
  ReconciliationRunResult,
  RunResult,
  TaxProfile,
} from "@features/payroll/types/payroll.types";

type PayrollPeriodDto = Omit<PayrollPeriod, "_id" | "created_at"> & { id: string; createdAt?: string };

/** Phụ cấp/thưởng/khấu trừ dùng chung hình dạng: backend trả `id`, UI dùng `_id`. */
interface CompensationDto {
  id: string;
  employeeId: string;
  payrollPeriodId?: string | null;
  name: string;
  type?: string;
  amount: number;
  isTaxable?: boolean;
  isInsuranceBase?: boolean;
  reason?: string | null;
  effectiveDate?: string;
  endDate?: string | null;
  createdAt: string;
}

interface TaxProfileDto {
  id: string;
  employeeId: string;
  taxCode: string | null;
  isResident: boolean;
  dependentsCount: number;
  insuranceAmount: number;
  effectiveDate: string;
  endDate: string | null;
  createdAt: string;
}

function toAllowance(row: CompensationDto): Allowance {
  return {
    _id: row.id,
    employeeId: row.employeeId,
    name: row.name,
    category: row.type ?? "fixed",
    type: (row.type as AmountType) ?? "fixed",
    amount: row.amount,
    isTaxable: row.isTaxable ?? true,
    isInsuranceBase: row.isInsuranceBase ?? false,
    effectiveDate: row.effectiveDate ?? row.createdAt,
    endDate: row.endDate ?? null,
  };
}

function toBonus(row: CompensationDto): Bonus {
  return {
    _id: row.id,
    employeeId: row.employeeId,
    payrollPeriodId: row.payrollPeriodId ?? "",
    name: row.name,
    amount: row.amount,
    isTaxable: row.isTaxable ?? true,
    reason: row.reason ?? null,
  };
}

function toDeduction(row: CompensationDto): Deduction {
  return {
    _id: row.id,
    employeeId: row.employeeId,
    payrollPeriodId: row.payrollPeriodId ?? null,
    name: row.name,
    type: (row.type as AmountType) ?? "fixed",
    amount: row.amount,
    effectiveDate: row.effectiveDate ?? row.createdAt,
    endDate: row.endDate ?? null,
  };
}

function toTaxProfile(row: TaxProfileDto): TaxProfile {
  return {
    _id: row.id,
    employeeId: row.employeeId,
    taxCode: row.taxCode,
    isResident: row.isResident,
    dependentsCount: row.dependentsCount,
    insuranceAmount: row.insuranceAmount,
    effectiveDate: row.effectiveDate,
    endDate: row.endDate,
  };
}
interface PayslipDto { id: string; payrollPeriodId: string; employeeId: string; workdays: { standardWorkDays: number; actualWorkDays: number; unpaidDays: number }; attendanceRatio: number; performanceRatio: number; goalRatio: number; breakdown: Record<string, number>; segments?: PayrollRecord["segments"]; status: PayrollRecord["status"]; paidAt: string | null; computedAt: string; }

function toPayrollPeriod(period: PayrollPeriodDto): PayrollPeriod {
  const { id, createdAt, ...rest } = period;
  return { _id: id, ...rest, created_at: createdAt };
}

function toPayrollRecord(payslip: PayslipDto): PayrollRecord {
  const b = payslip.breakdown;
  return {
    _id: payslip.id, payrollPeriodId: payslip.payrollPeriodId, employeeId: payslip.employeeId, status: payslip.status,
    standardWorkDays: payslip.workdays.standardWorkDays, actualWorkDays: payslip.workdays.actualWorkDays, unpaidLeaveDays: payslip.workdays.unpaidDays, workDays: payslip.workdays.actualWorkDays, leaveDays: payslip.workdays.unpaidDays,
    attendanceRatio: payslip.attendanceRatio, performanceRatio: payslip.performanceRatio, goalRatio: payslip.goalRatio,
    attendanceComponent: b.attendanceComponent, performanceComponent: b.performanceComponent, goalComponent: b.goalComponent, baseSalary: b.baseSalary, proRatedBaseSalary: b.proRatedBaseSalary, totalTaxableAllowances: b.totalTaxableAllowances, totalNonTaxableAllowances: b.totalNonTaxableAllowances, totalAllowances: b.totalAllowances, overtimePay: b.overtimePay, totalBonuses: b.totalBonuses, totalRetroClaims: b.totalRetroClaims, totalRetroClawbacks: b.totalRetroClawbacks, segments: payslip.segments, grossSalary: b.grossSalary,
    insuranceBase: b.insuranceBase, socialInsurance: b.socialInsurance, healthInsurance: b.healthInsurance, unemploymentInsurance: b.unemploymentInsurance, insurance: b.insurance, taxableIncome: b.taxableIncome, personalDeduction: b.personalDeduction, dependentDeduction: b.dependentDeduction, dependentsCount: b.dependentsCount, taxableIncomeAfterDeduction: b.taxableIncomeAfterDeduction, tax: b.tax, unionFee: b.unionFee, otherDeductions: b.otherDeductions, totalDeductions: b.totalDeductions, netSalary: b.netSalary, computedAt: payslip.computedAt, paidAt: payslip.paidAt,
  };
}

/** Lock endpoints kick payroll off in the BACKGROUND when both locks are in
 *  place; `autoRunning` tells the UI to point HR at the payroll page shortly. */
export interface LockResult {
  period: PayrollPeriod;
  autoRunning?: boolean;
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
    const { data } = await api.get<{ periods: PayrollPeriodDto[] }>("/payroll/periods");
    return data.periods.map(toPayrollPeriod);
  },
  async getPeriod(id: string): Promise<PayrollPeriod> {
    const { data } = await api.get<PayrollPeriodDto>(`/payroll/periods/${id}`);
    return toPayrollPeriod(data);
  },
  async createPeriod(input: CreatePeriodInput): Promise<PayrollPeriod> {
    const { data: created } = await api.post<{ periodId: string }>("/payroll/periods", input);
    return this.getPeriod(created.periodId);
  },
  async attendanceReadiness(id: string): Promise<AttendanceReadiness> {
    const { data } = await api.get<AttendanceReadiness>(`/payroll/periods/${id}/attendance-readiness`);
    return data;
  },
  async lockAttendance(id: string): Promise<LockResult> {
    const { data } = await api.post<PayrollPeriodDto & { autoRunning?: boolean }>(`/payroll/periods/${id}/lock-attendance`);
    const { autoRunning, ...period } = data;
    return { period: toPayrollPeriod(period), autoRunning };
  },
  /** Mở khoá công đòi LÝ DO — backend ghi audit kèm lý do đó. */
  async unlockAttendance(id: string, reason: string): Promise<PayrollPeriod> {
    const { data } = await api.post<PayrollPeriodDto>(`/payroll/periods/${id}/unlock-attendance`, { reason });
    return toPayrollPeriod(data);
  },
  async evaluationReadiness(id: string): Promise<EvaluationReadiness> {
    const { data } = await api.get<EvaluationReadiness>(`/payroll/periods/${id}/evaluation-readiness`);
    return data;
  },
  async lockEvaluations(id: string): Promise<LockResult> {
    const { data } = await api.post<PayrollPeriodDto & { autoRunning?: boolean }>(`/payroll/periods/${id}/lock-evaluations`);
    const { autoRunning, ...period } = data;
    return { period: toPayrollPeriod(period), autoRunning };
  },
  async unlockEvaluations(id: string): Promise<PayrollPeriod> {
    const { data } = await api.post<PayrollPeriodDto>(`/payroll/periods/${id}/unlock-evaluations`, {});
    return toPayrollPeriod(data);
  },
  async reopenPeriod(id: string): Promise<PayrollPeriod> {
    const { data } = await api.post<PayrollPeriodDto>(`/payroll/periods/${id}/reopen`, {});
    return toPayrollPeriod(data);
  },
  async deletePeriod(id: string): Promise<void> {
    await api.delete(`/payroll/periods/${id}`);
  },
  /**
   * File chuyển lương theo mẫu ngân hàng đang bật trong Cài đặt.
   *
   * Trả cả `skipped` (ai không vào lệnh chi và vì sao) nên UI phải hiện nó, không
   * chỉ tải file xuống.
   */
  async bankTransferFile(id: string): Promise<BankTransferFileResult> {
    const { data } = await api.get<BankTransferFileResult>(`/payroll/periods/${id}/bank-file`);
    return data;
  },

  // ---- Đối soát song song v1/v2 ----
  /** Tính lại cả kỳ bằng phiên bản cũ (dry-run) và ghi mọi chênh lệch. */
  async reconcile(id: string): Promise<ReconciliationRunResult> {
    const { data } = await api.post<ReconciliationRunResult>(`/payroll/periods/${id}/reconciliation`, undefined, { timeout: 120_000 });
    return data;
  },
  async listReconciliation(id: string): Promise<{ variances: PayrollVariance[]; unsignedCount: number }> {
    const { data } = await api.get<{ variances: PayrollVariance[]; unsignedCount: number }>(`/payroll/periods/${id}/reconciliation`);
    return data;
  },
  async signVariance(id: string, employeeId: string, explanation: string): Promise<PayrollVariance> {
    const { data } = await api.post<PayrollVariance>(`/payroll/periods/${id}/reconciliation/${employeeId}/sign`, { explanation });
    return data;
  },

  /** HR xác nhận đã soát bảng lương thử — bắt buộc trước khi người duyệt bấm duyệt. */
  async hrReview(id: string): Promise<PayrollPeriod> {
    const { data } = await api.post<PayrollPeriodDto>(`/payroll/periods/${id}/hr-review`);
    return toPayrollPeriod(data);
  },
  async closePeriod(id: string): Promise<PayrollPeriod> {
    const { data } = await api.post<PayrollPeriodDto>(`/payroll/periods/${id}/close`);
    return toPayrollPeriod(data);
  },

  // ---- Run ----
  async runPeriod(id: string): Promise<RunResult> {
    const { data } = await api.post<RunResult>(`/payroll/periods/${id}/run`, {}, { timeout: 120_000 });
    return data;
  },
  /**
   * Tính lại một nhân viên. Backend trả bản rút gọn (`payslipId/status/netSalary`)
   * nên đọc lại phiếu đầy đủ để UI có toàn bộ breakdown.
   */
  async runEmployee(id: string, employeeId: string): Promise<PayrollRecord> {
    const { data } = await api.post<{ payslipId: string; status: PayrollRecord["status"]; netSalary: number }>(
      `/payroll/periods/${id}/run/${employeeId}`, {}, { timeout: 120_000 },
    );
    return this.getPayroll(data.payslipId);
  },

  // ---- NET → GROSS calculator ----
  async calculateGrossUp(input: GrossUpInput): Promise<GrossUpResult> {
    const { data } = await api.post<GrossUpResult>("/payroll/gross-up", input);
    return data;
  },

  // ---- Payrolls ----
  async listPayrolls(params: ListPayrollsParams): Promise<Paginated<PayrollRecord>> {
    const { data } = await api.get<{ payrolls: PayslipDto[]; meta: Paginated<PayrollRecord>["meta"] }>("/payroll/payrolls", { params });
    return { data: data.payrolls.map(toPayrollRecord), meta: data.meta };
  },
  async getPayroll(id: string): Promise<PayrollRecord> {
    const { data } = await api.get<PayslipDto>(`/payroll/payrolls/${id}`);
    return toPayrollRecord(data);
  },
  async preflight(periodId: string): Promise<PayrollPreflight> {
    const { data } = await api.get<PayrollPreflight>(`/payroll/periods/${periodId}/preflight`);
    return data;
  },
  async exportPeriod(periodId: string): Promise<Blob> {
    const res = await api.get(`/payroll/periods/${periodId}/export`, { responseType: "blob" });
    return res.data as Blob;
  },
  async periodTotals(periodId: string): Promise<PeriodTotalRow[]> {
    const { data } = await api.get<{ totals: PeriodTotalRow[] }>(`/payroll/periods/${periodId}/totals`);
    return data.totals;
  },
  /** Tự phục vụ: phiếu lương của chính tôi, kèm tên kỳ. */
  async myPayslips(): Promise<(PayrollRecord & { periodName?: string })[]> {
    const { data } = await api.get<{ payrolls: (PayslipDto & { periodName?: string })[] }>("/payroll/payrolls/me");
    return data.payrolls.map((payslip) => ({ ...toPayrollRecord(payslip), periodName: payslip.periodName }));
  },

  // ---- Workflow ----
  async approve(periodId: string, employeeId?: string): Promise<ApprovalResult> {
    const { data } = await api.post<ApprovalResult>(`/payroll/periods/${periodId}/approve`, {
      ...(employeeId != null ? { employeeId } : {}),
    });
    return data;
  },
  async revert(payrollId: string): Promise<void> {
    await api.post(`/payroll/payrolls/${payrollId}/revert`, {});
  },
  async markPaid(periodId: string): Promise<ApprovalResult> {
    const { data } = await api.post<ApprovalResult>(`/payroll/periods/${periodId}/mark-paid`, {});
    return data;
  },

  // ---- Compensation ----
  // Backend trả DTO có `id`; UI dùng `_id` -> map ở đây, và PATCH/DELETE trả
  // rỗng nên đọc lại danh sách của nhân viên thay vì tin vào body trả về.
  async allowances(employeeId: string): Promise<Allowance[]> {
    const { data } = await api.get<{ allowances: CompensationDto[] }>(`/payroll/employees/${employeeId}/allowances`);
    return data.allowances.map(toAllowance);
  },
  async createAllowance(input: {
    employeeId: string; name: string; amount: number; effectiveDate: string;
    endDate?: string | null; type?: AmountType; isTaxable?: boolean; isInsuranceBase?: boolean;
  }): Promise<Allowance> {
    const { data } = await api.post<CompensationDto>("/payroll/allowances", input);
    return toAllowance(data);
  },
  async updateAllowance(id: string, input: { name?: string; amount?: number; endDate?: string | null }): Promise<void> {
    await api.patch(`/payroll/allowances/${id}`, input);
  },
  async deleteAllowance(id: string): Promise<void> {
    await api.delete(`/payroll/allowances/${id}`);
  },

  async bonuses(employeeId: string): Promise<Bonus[]> {
    const { data } = await api.get<{ bonuses: CompensationDto[] }>(`/payroll/employees/${employeeId}/bonuses`);
    return data.bonuses.map(toBonus);
  },
  /** Thưởng gắn với MỘT kỳ lương cụ thể (`payrollPeriodId` bắt buộc). */
  async createBonus(input: {
    employeeId: string; payrollPeriodId: string; name: string; amount: number;
    isTaxable?: boolean; reason?: string | null;
  }): Promise<Bonus> {
    const { data } = await api.post<CompensationDto>("/payroll/bonuses", input);
    return toBonus(data);
  },
  async updateBonus(id: string, input: { name?: string; amount?: number; isTaxable?: boolean; reason?: string | null }): Promise<void> {
    await api.patch(`/payroll/bonuses/${id}`, input);
  },
  async deleteBonus(id: string): Promise<void> {
    await api.delete(`/payroll/bonuses/${id}`);
  },

  async deductions(employeeId: string): Promise<Deduction[]> {
    const { data } = await api.get<{ deductions: CompensationDto[] }>(`/payroll/employees/${employeeId}/deductions`);
    return data.deductions.map(toDeduction);
  },
  async createDeduction(input: {
    employeeId: string; name: string; amount: number; effectiveDate: string;
    endDate?: string | null; type?: AmountType; payrollPeriodId?: string | null; reason?: string | null;
  }): Promise<Deduction> {
    const { data } = await api.post<CompensationDto>("/payroll/deductions", input);
    return toDeduction(data);
  },
  async updateDeduction(id: string, input: { name?: string; amount?: number; endDate?: string | null }): Promise<void> {
    await api.patch(`/payroll/deductions/${id}`, input);
  },
  async deleteDeduction(id: string): Promise<void> {
    await api.delete(`/payroll/deductions/${id}`);
  },

  async taxProfiles(employeeId: string): Promise<TaxProfile[]> {
    const { data } = await api.get<{ taxProfiles: TaxProfileDto[] }>(`/payroll/employees/${employeeId}/tax-profiles`);
    return data.taxProfiles.map(toTaxProfile);
  },
  async upsertTaxProfile(input: {
    employeeId: string; effectiveDate: string; isResident?: boolean;
    dependentsCount?: number; insuranceAmount?: number; taxCode?: string | null;
  }): Promise<TaxProfile> {
    const { data } = await api.post<TaxProfileDto>("/payroll/tax-profiles", input);
    return toTaxProfile(data);
  },

  // ---- Điều chỉnh hồi tố (truy lĩnh/truy thu kỳ trước) ----
  async retroAdjustments(params: { employeeId?: string; payoutPeriodId?: string; originPeriodId?: string } = {}): Promise<RetroAdjustment[]> {
    const { data } = await api.get<{ retroAdjustments: RetroAdjustment[] }>("/payroll/retro-adjustments", { params });
    return data.retroAdjustments;
  },
  async createRetroAdjustment(input: {
    employeeId: string; kind: "claim" | "clawback"; amount: number;
    originPeriodId: string; payoutPeriodId: string; reason: string; taxable?: boolean;
  }): Promise<RetroAdjustment> {
    const { data } = await api.post<RetroAdjustment>("/payroll/retro-adjustments", input);
    return data;
  },
  async cancelRetroAdjustment(id: string, reason: string): Promise<void> {
    await api.post(`/payroll/retro-adjustments/${id}/cancel`, { reason });
  },
};
