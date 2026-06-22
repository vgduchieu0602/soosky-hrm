import api from "@core/http/axios";
import type {
  AttendanceSymbol,
  CompanyConfig,
  Holiday,
  PerformanceCriterion,
  SalaryPolicy,
  Shift,
} from "@features/settings/types/settings.types";

interface Env<T> { data: T }

export const settingsService = {
  // ---- company ----
  async getCompany(): Promise<CompanyConfig> {
    const { data } = await api.get<Env<CompanyConfig>>("/settings/company");
    return data.data;
  },
  async updateCompany(input: Partial<CompanyConfig>): Promise<CompanyConfig> {
    const { data } = await api.patch<Env<CompanyConfig>>("/admin/settings/company", input);
    return data.data;
  },

  // ---- salary policies ----
  async listPolicies(): Promise<SalaryPolicy[]> {
    const { data } = await api.get<Env<SalaryPolicy[]>>("/settings/salary-policies");
    return data.data ?? [];
  },
  async createPolicy(input: Record<string, unknown>): Promise<SalaryPolicy> {
    const { data } = await api.post<Env<SalaryPolicy>>("/admin/settings/salary-policies", input);
    return data.data;
  },
  async updatePolicy(id: string, input: Record<string, unknown>): Promise<SalaryPolicy> {
    const { data } = await api.patch<Env<SalaryPolicy>>(`/admin/settings/salary-policies/${id}`, input);
    return data.data;
  },

  // ---- performance criteria ----
  async listCriteria(all = true): Promise<PerformanceCriterion[]> {
    const { data } = await api.get<Env<PerformanceCriterion[]>>(`/settings/performance-criteria${all ? "?all=true" : ""}`);
    return data.data ?? [];
  },
  async createCriterion(input: Record<string, unknown>): Promise<PerformanceCriterion> {
    const { data } = await api.post<Env<PerformanceCriterion>>("/admin/settings/performance-criteria", input);
    return data.data;
  },
  async updateCriterion(id: string, input: Record<string, unknown>): Promise<PerformanceCriterion> {
    const { data } = await api.patch<Env<PerformanceCriterion>>(`/admin/settings/performance-criteria/${id}`, input);
    return data.data;
  },
  async archiveCriterion(id: string): Promise<void> {
    await api.delete(`/admin/settings/performance-criteria/${id}`);
  },

  // ---- attendance catalogs ----
  async listShifts(): Promise<Shift[]> {
    const { data } = await api.get<Env<Shift[]>>("/shifts");
    return data.data ?? [];
  },
  async createShift(input: Record<string, unknown>): Promise<Shift> {
    const { data } = await api.post<Env<Shift>>("/admin/shifts", input);
    return data.data;
  },
  async updateShift(id: string, input: Record<string, unknown>): Promise<Shift> {
    const { data } = await api.patch<Env<Shift>>(`/admin/shifts/${id}`, input);
    return data.data;
  },
  async deleteShift(id: string): Promise<void> {
    await api.delete(`/admin/shifts/${id}`);
  },
  async listHolidays(): Promise<Holiday[]> {
    const { data } = await api.get<Env<Holiday[]>>("/holidays");
    return data.data ?? [];
  },
  async createHoliday(input: Record<string, unknown>): Promise<Holiday> {
    const { data } = await api.post<Env<Holiday>>("/admin/holidays", input);
    return data.data;
  },
  async updateHoliday(id: string, input: Record<string, unknown>): Promise<Holiday> {
    const { data } = await api.patch<Env<Holiday>>(`/admin/holidays/${id}`, input);
    return data.data;
  },
  async deleteHoliday(id: string): Promise<void> {
    await api.delete(`/admin/holidays/${id}`);
  },
  async listSymbols(): Promise<AttendanceSymbol[]> {
    const { data } = await api.get<Env<AttendanceSymbol[]>>("/attendance-symbols");
    return data.data ?? [];
  },
  async createSymbol(input: Record<string, unknown>): Promise<AttendanceSymbol> {
    const { data } = await api.post<Env<AttendanceSymbol>>("/admin/attendance-symbols", input);
    return data.data;
  },
  async updateSymbol(id: string, input: Record<string, unknown>): Promise<AttendanceSymbol> {
    const { data } = await api.patch<Env<AttendanceSymbol>>(`/admin/attendance-symbols/${id}`, input);
    return data.data;
  },
  async deleteSymbol(id: string): Promise<void> {
    await api.delete(`/admin/attendance-symbols/${id}`);
  },
};
