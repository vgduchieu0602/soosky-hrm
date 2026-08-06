import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ delete: vi.fn(), get: vi.fn(), patch: vi.fn(), post: vi.fn() }));
vi.mock("@core/http/axios", () => ({ default: api }));

import { payrollService } from "@features/payroll/services/payroll.service";

describe("payrollService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("maps backend payroll periods into the UI's legacy id field", async () => {
    api.get.mockResolvedValueOnce({
      data: { periods: [{ id: "period-1", name: "02/2026", startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-02-28T00:00:00.000Z", payDate: "2026-03-05T00:00:00.000Z", standardWorkDays: 22, status: "open", closedAt: null, closedBy: null, attendanceLockedAt: null, attendanceLockedBy: null, evaluationLockedAt: null, evaluationLockedBy: null, createdBy: "admin-1", createdAt: "2026-01-01T00:00:00.000Z" }] },
    });

    await expect(payrollService.listPeriods()).resolves.toMatchObject([{ _id: "period-1", name: "02/2026", status: "open" }]);
    expect(api.get).toHaveBeenCalledWith("/payroll/periods");
  });

  it("creates a payroll period then reloads the backend period", async () => {
    api.post.mockResolvedValueOnce({ data: { periodId: "period-1" } });
    api.get.mockResolvedValueOnce({
      data: { id: "period-1", name: "02/2026", startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-02-28T00:00:00.000Z", payDate: "2026-03-05T00:00:00.000Z", standardWorkDays: 22, status: "open", closedAt: null, closedBy: null, attendanceLockedAt: null, attendanceLockedBy: null, evaluationLockedAt: null, evaluationLockedBy: null, createdBy: "admin-1", createdAt: "2026-01-01T00:00:00.000Z" },
    });

    await expect(payrollService.createPeriod({ name: "02/2026", startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-02-28T00:00:00.000Z", payDate: "2026-03-05T00:00:00.000Z", standardWorkDays: 22 }))
      .resolves.toMatchObject({ _id: "period-1", name: "02/2026" });
    expect(api.post).toHaveBeenCalledWith("/payroll/periods", { name: "02/2026", startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-02-28T00:00:00.000Z", payDate: "2026-03-05T00:00:00.000Z", standardWorkDays: 22 });
    expect(api.get).toHaveBeenCalledWith("/payroll/periods/period-1");
  });

  it("keeps the backend auto-run flag when locking attendance", async () => {
    api.post.mockResolvedValueOnce({
      data: { id: "period-1", name: "02/2026", startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-02-28T00:00:00.000Z", payDate: "2026-03-05T00:00:00.000Z", standardWorkDays: 22, status: "open", closedAt: null, closedBy: null, attendanceLockedAt: "2026-02-28T00:00:00.000Z", attendanceLockedBy: "admin-1", evaluationLockedAt: null, evaluationLockedBy: null, createdBy: "admin-1", createdAt: "2026-01-01T00:00:00.000Z", autoRunning: true },
    });

    await expect(payrollService.lockAttendance("period-1")).resolves.toMatchObject({ period: { _id: "period-1" }, autoRunning: true });
    expect(api.post).toHaveBeenCalledWith("/payroll/periods/period-1/lock-attendance");
  });

  it("keeps the backend auto-run flag when locking evaluations", async () => {
    api.post.mockResolvedValueOnce({
      data: { id: "period-1", name: "02/2026", startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-02-28T00:00:00.000Z", payDate: "2026-03-05T00:00:00.000Z", standardWorkDays: 22, status: "open", closedAt: null, closedBy: null, attendanceLockedAt: null, attendanceLockedBy: null, evaluationLockedAt: "2026-02-28T00:00:00.000Z", evaluationLockedBy: "admin-1", createdBy: "admin-1", createdAt: "2026-01-01T00:00:00.000Z", autoRunning: true },
    });

    await expect(payrollService.lockEvaluations("period-1")).resolves.toMatchObject({ period: { _id: "period-1" }, autoRunning: true });
    expect(api.post).toHaveBeenCalledWith("/payroll/periods/period-1/lock-evaluations");
  });

  it("returns the backend gross-up result without an obsolete envelope", async () => {
    api.post.mockResolvedValueOnce({ data: { gross: 12000000, net: 10000000, insurance: 1260000, tax: 740000, employerInsurance: 2580000, employerCost: 14580000 } });

    await expect(payrollService.calculateGrossUp({ net: 10000000, dependentsCount: 1 })).resolves.toMatchObject({ gross: 12000000, net: 10000000 });
    expect(api.post).toHaveBeenCalledWith("/payroll/gross-up", { net: 10000000, dependentsCount: 1 });
  });

  it("maps a closed payroll period returned directly by the backend", async () => {
    api.post.mockResolvedValueOnce({ data: { id: "period-1", name: "02/2026", startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-02-28T00:00:00.000Z", payDate: "2026-03-05T00:00:00.000Z", standardWorkDays: 22, status: "closed", closedAt: "2026-03-01T00:00:00.000Z", closedBy: "admin-1", attendanceLockedAt: null, attendanceLockedBy: null, evaluationLockedAt: null, evaluationLockedBy: null, createdBy: "admin-1", createdAt: "2026-01-01T00:00:00.000Z" } });

    await expect(payrollService.closePeriod("period-1")).resolves.toMatchObject({ _id: "period-1", status: "closed" });
    expect(api.post).toHaveBeenCalledWith("/payroll/periods/period-1/close");
  });

  it("flattens backend payslip workdays and salary breakdown for the UI", async () => {
    api.get.mockResolvedValueOnce({ data: { payrolls: [{ id: "pay-1", payrollPeriodId: "period-1", employeeId: "emp-1", workdays: { standardWorkDays: 22, actualWorkDays: 20, unpaidDays: 1 }, attendanceRatio: 0.9, performanceRatio: 100, goalRatio: 100, breakdown: { baseSalary: 10000000, proRatedBaseSalary: 9000000, attendanceComponent: 4000000, performanceComponent: 3000000, goalComponent: 2000000, totalTaxableAllowances: 0, totalNonTaxableAllowances: 0, totalAllowances: 0, overtimePay: 0, totalBonuses: 0, grossSalary: 9000000, insuranceBase: 9000000, socialInsurance: 720000, healthInsurance: 135000, unemploymentInsurance: 90000, insurance: 945000, taxableIncome: 8055000, personalDeduction: 11000000, dependentDeduction: 0, dependentsCount: 0, taxableIncomeAfterDeduction: 0, tax: 0, unionFee: 0, otherDeductions: 0, totalDeductions: 945000, netSalary: 8055000 }, status: "draft", approvedBy: null, paidAt: null, computedAt: "2026-03-01T00:00:00.000Z", createdAt: "2026-03-01T00:00:00.000Z" }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } });

    await expect(payrollService.listPayrolls({ payrollPeriodId: "period-1" })).resolves.toMatchObject({ data: [{ _id: "pay-1", standardWorkDays: 22, actualWorkDays: 20, netSalary: 8055000 }] });
    expect(api.get).toHaveBeenCalledWith("/payroll/payrolls", { params: { payrollPeriodId: "period-1" } });
  });
});
