import api from "@core/http/axios";
import type {
  AdminGrid,
  AttendanceRecord,
  LeaveBalanceRecord,
  LeaveRequestRecord,
  MyMonth,
  ShiftOption,
  SubmitLeaveInput,
  UpsertAttendanceInput,
} from "@features/attendance/types/attendance.types";

interface Env<T> {
  data: T;
}

export const attendanceService = {
  async shifts(): Promise<ShiftOption[]> {
    const { data } = await api.get<Env<ShiftOption[]>>("/shifts");
    return data.data ?? [];
  },

  // ---- attendance ----
  async adminGrid(params: { month: string; departmentId?: string; q?: string }): Promise<AdminGrid> {
    const { data } = await api.get<Env<AdminGrid>>("/admin/attendances", { params });
    return data.data;
  },
  async myMonth(month: string): Promise<MyMonth> {
    const { data } = await api.get<Env<MyMonth>>("/attendances/me", { params: { month } });
    return data.data;
  },
  async checkIn(): Promise<AttendanceRecord> {
    const { data } = await api.post<Env<AttendanceRecord>>("/attendances/check-in");
    return data.data;
  },
  async checkOut(): Promise<AttendanceRecord> {
    const { data } = await api.post<Env<AttendanceRecord>>("/attendances/check-out");
    return data.data;
  },
  async upsert(input: UpsertAttendanceInput): Promise<AttendanceRecord> {
    const { data } = await api.post<Env<AttendanceRecord>>("/admin/attendances", input);
    return data.data;
  },
  async adjust(id: string, input: Partial<UpsertAttendanceInput> & { reason?: string }): Promise<AttendanceRecord> {
    const { data } = await api.patch<Env<AttendanceRecord>>(`/admin/attendances/${id}`, input);
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/admin/attendances/${id}`);
  },

  // ---- leave (self) ----
  async submitLeave(input: SubmitLeaveInput): Promise<LeaveRequestRecord> {
    const { data } = await api.post<Env<LeaveRequestRecord>>("/leave-requests", input);
    return data.data;
  },
  async myLeaves(): Promise<LeaveRequestRecord[]> {
    const { data } = await api.get<Env<LeaveRequestRecord[]>>("/leave-requests/me");
    return data.data ?? [];
  },
  async cancelLeave(id: string): Promise<LeaveRequestRecord> {
    const { data } = await api.patch<Env<LeaveRequestRecord>>(`/leave-requests/${id}/cancel`);
    return data.data;
  },
  async myBalances(): Promise<LeaveBalanceRecord[]> {
    const { data } = await api.get<Env<LeaveBalanceRecord[]>>("/leave-balances/me");
    return data.data ?? [];
  },

  // ---- leave (admin/HR) ----
  async adminLeaves(status?: string): Promise<LeaveRequestRecord[]> {
    const { data } = await api.get<Env<LeaveRequestRecord[]>>("/admin/leave-requests", {
      params: status ? { status } : undefined,
    });
    return data.data ?? [];
  },
  async approveLeave(id: string): Promise<LeaveRequestRecord> {
    const { data } = await api.post<Env<LeaveRequestRecord>>(`/admin/leave-requests/${id}/approve`);
    return data.data;
  },
  async rejectLeave(id: string, reason: string): Promise<LeaveRequestRecord> {
    const { data } = await api.post<Env<LeaveRequestRecord>>(`/admin/leave-requests/${id}/reject`, {
      reason,
    });
    return data.data;
  },

  // ---- leave balances (admin/HR) ----
  async adminBalances(employeeId: string, year?: number): Promise<LeaveBalanceRecord[]> {
    const { data } = await api.get<Env<LeaveBalanceRecord[]>>(`/admin/leave-balances/${employeeId}`, {
      params: year ? { year } : undefined,
    });
    return data.data ?? [];
  },
  async upsertBalance(input: { employeeId: string; leaveType: string; year: number; entitled: number }): Promise<LeaveBalanceRecord> {
    const { data } = await api.post<Env<LeaveBalanceRecord>>("/admin/leave-balances", input);
    return data.data;
  },
};
