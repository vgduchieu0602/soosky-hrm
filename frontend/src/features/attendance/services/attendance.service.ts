import api from "@core/http/axios";
import type {
  AdminGrid,
  AttendanceCorrectionRecord,
  AttendanceRecord,
  LeaveBalanceRecord,
  LeaveRequestRecord,
  MyMonth,
  ShiftOption,
  SubmitCorrectionInput,
  UpsertAttendanceInput,
  SubmitLeaveInput,
} from "@features/attendance/types/attendance.types";

interface ShiftDto {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: string;
}

type AttendanceDto = Omit<AttendanceRecord, "_id"> & { id: string };
type LeaveBalanceDto = Omit<LeaveBalanceRecord, "_id"> & { id: string };
type LeaveRequestDto = Omit<LeaveRequestRecord, "_id" | "created_at"> & { id: string; createdAt?: string };
type CorrectionDto = Omit<AttendanceCorrectionRecord, "_id"> & { id: string };

/** Chỉ những trường của nhân viên mà lưới chấm công cần. */
interface RosterEmployeeDto {
  id: string;
  code: string;
  name: string;
  departmentId: string;
}

function toAttendanceRecord(record: AttendanceDto): AttendanceRecord {
  const { id, ...rest } = record;
  return { _id: id, ...rest };
}

function toLeaveBalance(record: LeaveBalanceDto): LeaveBalanceRecord {
  const { id, ...rest } = record;
  return { _id: id, ...rest };
}

function toLeaveRequest(record: LeaveRequestDto): LeaveRequestRecord {
  const { id, createdAt, ...rest } = record;
  return { _id: id, ...rest, created_at: createdAt };
}

function toCorrection(record: CorrectionDto): AttendanceCorrectionRecord {
  const { id, ...rest } = record;
  return { _id: id, ...rest };
}

async function getLeaveRequest(id: string): Promise<LeaveRequestRecord> {
  const { data } = await api.get<LeaveRequestDto>(`/attendance/leave-requests/${id}`);
  return toLeaveRequest(data);
}

/** `YYYY-MM` → khoảng [đầu tháng, cuối tháng] dạng ISO mà backend nhận. */
function monthRange(month: string): { start: string; end: string } {
  const [year, monthIndex] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year ?? 1970, (monthIndex ?? 1) - 1, 1));
  const to = new Date(Date.UTC(year ?? 1970, monthIndex ?? 1, 0));
  return { start: from.toISOString(), end: to.toISOString() };
}

export const attendanceService = {
  // ---- catalog ----
  async shifts(): Promise<ShiftOption[]> {
    const { data } = await api.get<{ shifts: ShiftDto[] }>("/attendance/shifts");
    return data.shifts.map((shift) => ({
      _id: shift.id,
      name: shift.name,
      type: "standard",
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      status: shift.status,
    }));
  },

  // ---- bảng công ----
  /**
   * Lưới chấm công của HR/Manager: bảng công mọi người trong phạm vi + danh sách
   * nhân viên + ca.
   *
   * Backend không có endpoint "grid" gộp sẵn — lưới được ghép từ ba nguồn thật
   * (`/attendance/records/visible`, `/employee/employees`, `/attendance/shifts`)
   * thay vì một endpoint tổng hợp, nên mỗi phần vẫn tôn trọng phạm vi quyền của
   * chính nó.
   */
  async adminGrid(params: { month: string; departmentId?: string; q?: string }): Promise<AdminGrid> {
    const { start, end } = monthRange(params.month);

    const [recordsResponse, employeesResponse, departmentsResponse, shifts] = await Promise.all([
      api.get<{ records: AttendanceDto[] }>("/attendance/records/visible", { params: { start, end } }),
      api.get<{ employees: RosterEmployeeDto[] }>("/employee/employees", {
        params: {
          status: "active",
          ...(params.departmentId == null ? {} : { departmentId: params.departmentId }),
        },
      }),
      api.get<{ departments: { id: string; name: string }[] }>("/department/departments"),
      this.shifts(),
    ]);

    const departmentName = new Map(departmentsResponse.data.departments.map((row) => [row.id, row.name]));
    const employees = employeesResponse.data.employees;
    const keyword = (params.q ?? "").trim().toLowerCase();

    const roster = employees
      .filter((employee) =>
        keyword === ""
        || employee.name.toLowerCase().includes(keyword)
        || employee.code.toLowerCase().includes(keyword))
      .map((employee) => ({
        _id: employee.id,
        employeeCode: employee.code,
        fullName: employee.name,
        departmentName: departmentName.get(employee.departmentId) ?? "—",
      }));

    const rosterIds = new Set(roster.map((employee) => employee._id));

    return {
      month: params.month,
      employees: roster,
      shifts,
      records: recordsResponse.data.records
        .map(toAttendanceRecord)
        .filter((record) => rosterIds.has(record.employeeId)),
    };
  },

  /** Bảng công của CHÍNH tôi: không gửi employeeId, backend suy ra từ access token. */
  async myMonth(month: string): Promise<MyMonth> {
    const { start, end } = monthRange(month);
    const { data } = await api.get<{ records: AttendanceDto[] }>("/attendance/records", {
      params: { start, end },
    });
    const records = data.records.map(toAttendanceRecord);
    return { employeeId: records[0]?.employeeId ?? "", month, records };
  },

  /**
   * HR nhập MỘT lần giờ vào/ra của một ngày; backend rải sang từng ca và tự lo
   * timezone, ngày lễ, thiếu giờ ra, chốt kỳ.
   */
  async upsertDay(input: UpsertAttendanceInput): Promise<{ totalCong: number; records: AttendanceRecord[] }> {
    const { data } = await api.post<{ date: string; totalCong: number; records: AttendanceDto[] }>(
      "/attendance/records",
      input,
    );
    return { totalCong: data.totalCong, records: data.records.map(toAttendanceRecord) };
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/attendance/records/${id}`);
  },

  // ---- chỉnh công ----
  /** Nhân viên gửi yêu cầu chỉnh công; bỏ trống `employeeId` = cho chính mình. */
  async submitCorrection(input: SubmitCorrectionInput): Promise<{ correctionRequestId: string }> {
    const { data } = await api.post<{ correctionRequestId: string }>("/attendance/correction-requests", {
      date: input.date,
      reason: input.reason,
      ...(input.employeeId != null ? { employeeId: input.employeeId } : {}),
      ...(input.requestedCheckIn != null ? { requestedCheckIn: input.requestedCheckIn } : {}),
      ...(input.requestedCheckOut != null ? { requestedCheckOut: input.requestedCheckOut } : {}),
    });
    return data;
  },

  async corrections(params: { employeeId?: string; status?: string } = {}): Promise<AttendanceCorrectionRecord[]> {
    const { data } = await api.get<{ correctionRequests: CorrectionDto[] }>("/attendance/correction-requests", {
      params: {
        ...(params.employeeId != null ? { employeeId: params.employeeId } : {}),
        ...(params.status != null ? { status: params.status } : {}),
      },
    });
    return data.correctionRequests.map(toCorrection);
  },

  /** Duyệt là ÁP DỤNG NGAY: bảng công ngày đó được tính lại phía backend. */
  async approveCorrection(id: string, note?: string): Promise<{ totalCong: number }> {
    const { data } = await api.post<{ totalCong: number }>(
      `/attendance/correction-requests/${id}/approve`,
      note == null ? {} : { note },
    );
    return data;
  },

  async rejectCorrection(id: string, reason: string): Promise<void> {
    await api.post(`/attendance/correction-requests/${id}/reject`, { reason });
  },

  // ---- nghỉ phép (tự phục vụ) ----
  // Không gửi employeeId: backend suy ra nhân viên từ access token và tự thu hẹp
  // theo phạm vi (`leave:submit:self` / `leave:read:self`).
  async submitLeave(input: SubmitLeaveInput): Promise<LeaveRequestRecord> {
    const { data } = await api.post<{ leaveRequestId: string }>("/attendance/leave-requests", {
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate,
      ...(input.employeeId != null ? { employeeId: input.employeeId } : {}),
      ...(input.halfDaySession != null ? { halfDaySession: input.halfDaySession } : {}),
      ...(input.reason != null && input.reason !== "" ? { reason: input.reason } : {}),
    });
    return getLeaveRequest(data.leaveRequestId);
  },
  async myLeaves(): Promise<LeaveRequestRecord[]> {
    const { data } = await api.get<{ leaveRequests: LeaveRequestDto[] }>("/attendance/leave-requests");
    return data.leaveRequests.map(toLeaveRequest);
  },
  async cancelLeave(id: string): Promise<LeaveRequestRecord> {
    await api.post(`/attendance/leave-requests/${id}/cancel`, {});
    return getLeaveRequest(id);
  },
  async myBalances(year: number = new Date().getFullYear()): Promise<LeaveBalanceRecord[]> {
    const { data } = await api.get<{ balances: LeaveBalanceDto[] }>("/attendance/leave-balances", {
      params: { year },
    });
    return data.balances.map(toLeaveBalance);
  },

  // ---- nghỉ phép (HR/quản lý) ----
  async adminLeaves(status?: string): Promise<LeaveRequestRecord[]> {
    const { data } = await api.get<{ leaveRequests: LeaveRequestDto[] }>("/attendance/leave-requests", {
      params: status == null ? {} : { status },
    });
    return data.leaveRequests.map(toLeaveRequest);
  },
  async approveLeave(id: string): Promise<LeaveRequestRecord> {
    await api.post(`/attendance/leave-requests/${id}/approve`, {});
    return getLeaveRequest(id);
  },
  async rejectLeave(id: string, reason: string): Promise<LeaveRequestRecord> {
    await api.post(`/attendance/leave-requests/${id}/reject`, { reason });
    return getLeaveRequest(id);
  },
  async revokeLeave(id: string, reason?: string): Promise<LeaveRequestRecord> {
    await api.post(`/attendance/leave-requests/${id}/cancel`, reason == null ? {} : { reason });
    return getLeaveRequest(id);
  },

  // ---- số dư phép (HR) ----
  async adminBalances(employeeId: string, year?: number): Promise<LeaveBalanceRecord[]> {
    const targetYear = year ?? new Date().getFullYear();
    const { data } = await api.get<{ balances: LeaveBalanceDto[] }>("/attendance/leave-balances", {
      params: { employeeId, year: targetYear },
    });
    return data.balances.map(toLeaveBalance);
  },
  async upsertBalance(input: { employeeId: string; leaveType: string; year: number; entitled: number }): Promise<LeaveBalanceRecord> {
    await api.post("/attendance/leave-balances", input);
    const balances = await this.adminBalances(input.employeeId, input.year);
    const balance = balances.find((item) => item.leaveType === input.leaveType);
    if (!balance) throw new Error(`Leave balance ${input.leaveType} was not returned by the backend`);
    return balance;
  },
};
