import api from "@core/http/axios";
import type {
  AttendanceSymbol,
  CompanyConfig,
  Holiday,
  SalaryPolicy,
  Shift,
} from "@features/settings/types/settings.types";

interface CompanyProfileDto {
  id: string;
  name: string;
  address: string | null;
  taxCode: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  timezone: string;
  currency: string;
  standardWorkHoursPerDay: number;
  standardWorkDaysPerMonth: number;
  createdAt: string;
  updatedAt: string;
}

interface ShiftDto {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workingDays: number[];
  status: string;
  createdAt: string;
}

interface HolidayDto {
  id: string;
  name: string;
  date: string;
  isRecurring: boolean;
  createdAt: string;
}

interface SymbolDto {
  id: string;
  code: string;
  name: string;
  description: string;
  createdAt: string;
}

interface SalaryPolicyDto {
  id: string;
  effectiveFrom: string;
  baseSalaryReference: number;
  regionalMinWage: number;
  insuranceCeilingMultiplier: number;
  socialInsuranceSalary: number;
  personalDeduction: number;
  dependentDeduction: number;
  unionFeeRate: number;
  unionFeeEnabled: boolean;
  taxEnabled: boolean;
  nonResidentTaxRate: number;
  probationPayRate: number;
  prorateByAttendance: boolean;
  createdAt: string;
}

function toCompany(profile: CompanyProfileDto): CompanyConfig {
  return {
    companyName: profile.name,
    address: profile.address,
    taxCode: profile.taxCode,
    phone: profile.phone,
    contactEmail: profile.email,
    logoUrl: profile.logoUrl,
    timezone: profile.timezone,
    currency: profile.currency,
    standardWorkHoursPerDay: profile.standardWorkHoursPerDay,
    standardWorkDaysPerMonth: profile.standardWorkDaysPerMonth,
  };
}

function toShift(shift: ShiftDto): Shift {
  return {
    _id: shift.id,
    code: shift.code,
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakMinutes: shift.breakMinutes,
    workingDays: shift.workingDays,
    status: shift.status as Shift["status"],
  };
}

function toHoliday(holiday: HolidayDto): Holiday {
  return {
    _id: holiday.id,
    name: holiday.name,
    date: holiday.date,
    isRecurring: holiday.isRecurring,
  };
}

function toSymbol(symbol: SymbolDto): AttendanceSymbol {
  return {
    _id: symbol.id,
    code: symbol.code,
    name: symbol.name,
    description: symbol.description,
  };
}

function toPolicy(policy: SalaryPolicyDto): SalaryPolicy {
  return { ...policy, _id: policy.id };
}

/**
 * Cấu hình hệ thống.
 *
 * Ranh giới module theo đúng backend: hồ sơ công ty ở `/setting`, danh mục chấm
 * công (ca/ngày lễ/ký hiệu) ở `/attendance`, chính sách lương ở `/payroll`.
 * Không có tiền tố `/admin` — phân quyền do backend kiểm theo khoá quyền, không
 * theo đường dẫn.
 */
export const settingsService = {
  // ---- hồ sơ công ty (module Setting) ----
  async getCompany(): Promise<CompanyConfig> {
    const { data } = await api.get<CompanyProfileDto>("/setting/company");
    return toCompany(data);
  },
  /** Upsert: backend nhận toàn bộ hồ sơ (`name` bắt buộc), không phải PATCH từng trường. */
  async updateCompany(input: CompanyConfig): Promise<CompanyConfig> {
    const { data } = await api.put<CompanyProfileDto>("/setting/company", {
      name: input.companyName,
      ...(input.address != null ? { address: input.address } : {}),
      ...(input.taxCode != null ? { taxCode: input.taxCode } : {}),
      ...(input.phone != null ? { phone: input.phone } : {}),
      ...(input.contactEmail != null ? { email: input.contactEmail } : {}),
      ...(input.logoUrl != null ? { logoUrl: input.logoUrl } : {}),
      ...(input.timezone != null ? { timezone: input.timezone } : {}),
      ...(input.currency != null ? { currency: input.currency } : {}),
      ...(input.standardWorkHoursPerDay != null ? { standardWorkHoursPerDay: input.standardWorkHoursPerDay } : {}),
      ...(input.standardWorkDaysPerMonth != null ? { standardWorkDaysPerMonth: input.standardWorkDaysPerMonth } : {}),
    });
    return toCompany(data);
  },

  // ---- cấu hình key/value (module Setting) ----
  async getSystemSettings(): Promise<Record<string, string | number | boolean>> {
    const { data } = await api.get<{ entries: Record<string, string | number | boolean> }>("/setting/system");
    return data.entries;
  },
  async updateSystemSettings(entries: Record<string, string | number | boolean>): Promise<void> {
    await api.patch("/setting/system", entries);
  },

  // ---- chính sách lương (module Payroll) ----
  async listPolicies(): Promise<SalaryPolicy[]> {
    const { data } = await api.get<{ policies: SalaryPolicyDto[] }>("/payroll/policies");
    return data.policies.map(toPolicy);
  },
  /**
   * Chính sách lương là bản ghi CÓ HIỆU LỰC TỪ một ngày — không sửa bản cũ, tạo
   * bản mới; phiếu lương đã tính giữ id chính sách đã dùng.
   */
  async createPolicy(input: {
    effectiveFrom: string;
    baseSalaryReference: number;
    regionalMinWage: number;
    socialInsuranceSalary: number;
    taxEnabled?: boolean;
    unionFeeEnabled?: boolean;
    unionFeeRate?: number;
    probationPayRate?: number;
    prorateByAttendance?: boolean;
  }): Promise<SalaryPolicy> {
    const { data } = await api.post<SalaryPolicyDto>("/payroll/policies", input);
    return toPolicy(data);
  },

  // ---- danh mục chấm công (module Attendance) ----
  async listShifts(): Promise<Shift[]> {
    const { data } = await api.get<{ shifts: ShiftDto[] }>("/attendance/shifts");
    return data.shifts.map(toShift);
  },
  async createShift(input: {
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    workingDays: number[];
  }): Promise<Shift> {
    const { data } = await api.post<ShiftDto>("/attendance/shifts", input);
    return toShift(data);
  },
  async updateShift(id: string, input: Partial<Omit<Shift, "_id" | "code" | "status">>): Promise<Shift> {
    const { data } = await api.patch<ShiftDto>(`/attendance/shifts/${id}`, input);
    return toShift(data);
  },
  /** Ca đã dùng trong bảng công thì lưu trữ (archive), không xoá. */
  async archiveShift(id: string): Promise<void> {
    await api.post(`/attendance/shifts/${id}/archive`, {});
  },
  async deleteShift(id: string): Promise<void> {
    await api.delete(`/attendance/shifts/${id}`);
  },

  async listHolidays(): Promise<Holiday[]> {
    const { data } = await api.get<{ holidays: HolidayDto[] }>("/attendance/holidays");
    return data.holidays.map(toHoliday);
  },
  async createHoliday(input: { name: string; date: string; isRecurring?: boolean }): Promise<Holiday> {
    const { data } = await api.post<HolidayDto>("/attendance/holidays", input);
    return toHoliday(data);
  },
  async updateHoliday(id: string, input: { name?: string; date?: string; isRecurring?: boolean }): Promise<Holiday> {
    const { data } = await api.patch<HolidayDto>(`/attendance/holidays/${id}`, input);
    return toHoliday(data);
  },
  async deleteHoliday(id: string): Promise<void> {
    await api.delete(`/attendance/holidays/${id}`);
  },

  async listSymbols(): Promise<AttendanceSymbol[]> {
    const { data } = await api.get<{ symbols: SymbolDto[] }>("/attendance/symbols");
    return data.symbols.map(toSymbol);
  },
  async createSymbol(input: { code: string; name: string; description?: string }): Promise<AttendanceSymbol> {
    const { data } = await api.post<SymbolDto>("/attendance/symbols", input);
    return toSymbol(data);
  },
  async updateSymbol(id: string, input: { name?: string; description?: string }): Promise<AttendanceSymbol> {
    const { data } = await api.patch<SymbolDto>(`/attendance/symbols/${id}`, input);
    return toSymbol(data);
  },
  async deleteSymbol(id: string): Promise<void> {
    await api.delete(`/attendance/symbols/${id}`);
  },
};
