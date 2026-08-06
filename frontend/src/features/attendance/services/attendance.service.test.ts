import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@core/http/axios", () => ({ default: api }));

import { attendanceService } from "@features/attendance/services/attendance.service";

describe("attendanceService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("maps backend shifts into the UI's legacy id field", async () => {
    api.get.mockResolvedValueOnce({
      data: { shifts: [{ id: "shift-1", code: "HC", name: "Hành chính", startTime: "08:00", endTime: "17:00", breakMinutes: 60, workingDays: [1, 2, 3, 4, 5], status: "active", createdAt: "2026-01-01T00:00:00.000Z" }] },
    });

    await expect(attendanceService.shifts()).resolves.toEqual([{
      _id: "shift-1", name: "Hành chính", type: "standard", startTime: "08:00", endTime: "17:00", breakMinutes: 60, status: "active",
    }]);
    expect(api.get).toHaveBeenCalledWith("/attendance/shifts");
  });

  it("writes a daily attendance record through the backend records endpoint", async () => {
    api.post.mockResolvedValueOnce({
      data: { date: "2026-02-01T00:00:00.000Z", totalCong: 1, records: [{ id: "record-1", employeeId: "emp-1", date: "2026-02-01T00:00:00.000Z", shiftId: "shift-1", checkIn: "2026-02-01T08:00:00.000Z", checkOut: "2026-02-01T17:00:00.000Z", status: "present", workHours: 8, lateMinutes: 0, earlyMinutes: 0, session: "full_day", congWeight: 1, source: "manual", note: null, leaveRequestId: null }] },
    });

    await expect(attendanceService.upsertDay({
      employeeId: "emp-1", date: "2026-02-01T00:00:00.000Z", checkIn: "2026-02-01T08:00:00.000Z", checkOut: "2026-02-01T17:00:00.000Z",
    })).resolves.toMatchObject({ totalCong: 1, records: [{ _id: "record-1", status: "present" }] });
    expect(api.post).toHaveBeenCalledWith("/attendance/records", {
      employeeId: "emp-1", date: "2026-02-01T00:00:00.000Z", checkIn: "2026-02-01T08:00:00.000Z", checkOut: "2026-02-01T17:00:00.000Z",
    });
  });

  it("reads and adjusts leave balances through the attendance module", async () => {
    api.get.mockResolvedValueOnce({
      data: { balances: [{ id: "balance-1", employeeId: "emp-1", leaveType: "annual", year: 2026, entitled: 12, used: 2, remaining: 10 }] },
    }).mockResolvedValueOnce({
      data: { balances: [{ id: "balance-1", employeeId: "emp-1", leaveType: "annual", year: 2026, entitled: 15, used: 2, remaining: 13 }] },
    });
    api.post.mockResolvedValueOnce({ data: undefined });

    await expect(attendanceService.adminBalances("emp-1", 2026)).resolves.toMatchObject([{ _id: "balance-1", entitled: 12 }]);
    await expect(attendanceService.upsertBalance({ employeeId: "emp-1", leaveType: "annual", year: 2026, entitled: 15 }))
      .resolves.toMatchObject({ _id: "balance-1", entitled: 15 });
    expect(api.get).toHaveBeenNthCalledWith(1, "/attendance/leave-balances", { params: { employeeId: "emp-1", year: 2026 } });
    expect(api.post).toHaveBeenCalledWith("/attendance/leave-balances", { employeeId: "emp-1", leaveType: "annual", year: 2026, entitled: 15 });
    expect(api.get).toHaveBeenNthCalledWith(2, "/attendance/leave-balances", { params: { employeeId: "emp-1", year: 2026 } });
  });

  it("approves a leave request then reloads its backend representation", async () => {
    api.post.mockResolvedValueOnce({ data: undefined });
    api.get.mockResolvedValueOnce({
      data: { id: "leave-1", employeeId: "emp-1", leaveType: "annual", startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-02-01T00:00:00.000Z", days: 1, halfDaySession: null, reason: "Personal", status: "approved", approverId: "admin-1", approvedAt: "2026-01-31T00:00:00.000Z", rejectionReason: null, createdBy: "emp-1", createdAt: "2026-01-30T00:00:00.000Z" },
    });

    await expect(attendanceService.approveLeave("leave-1")).resolves.toMatchObject({ _id: "leave-1", status: "approved" });
    expect(api.post).toHaveBeenCalledWith("/attendance/leave-requests/leave-1/approve", {});
    expect(api.get).toHaveBeenCalledWith("/attendance/leave-requests/leave-1");
  });

  it("bang cong cua chinh minh: khong gui employeeId, backend suy ra tu token", async () => {
    api.get.mockResolvedValueOnce({
      data: { records: [{ id: "record-1", employeeId: "emp-1", date: "2026-02-02T00:00:00.000Z", shiftId: "shift-1", checkIn: null, checkOut: null, status: "absent", workHours: null, lateMinutes: 0, earlyMinutes: 0, session: "full_day", congWeight: 0, source: "manual", note: null, leaveRequestId: null }] },
    });

    await expect(attendanceService.myMonth("2026-02")).resolves.toMatchObject({
      employeeId: "emp-1", month: "2026-02", records: [{ _id: "record-1" }],
    });

    // Khoang thang duoc dung bien: dau thang -> cuoi thang, KHONG co employeeId.
    expect(api.get).toHaveBeenCalledWith("/attendance/records", {
      params: { start: "2026-02-01T00:00:00.000Z", end: "2026-02-28T00:00:00.000Z" },
    });
  });

  it("nhan vien khong tu cham cong: sai gio thi gui yeu cau chinh cong", async () => {
    api.post.mockResolvedValueOnce({ data: { correctionRequestId: "correction-1" } });

    await expect(attendanceService.submitCorrection({
      date: "2026-02-02T00:00:00.000Z",
      reason: "Quen bam gio ra",
      requestedCheckOut: "2026-02-02T10:00:00.000Z",
    })).resolves.toEqual({ correctionRequestId: "correction-1" });

    // Khong gui employeeId -> yeu cau cho chinh minh.
    expect(api.post).toHaveBeenCalledWith("/attendance/correction-requests", {
      date: "2026-02-02T00:00:00.000Z",
      reason: "Quen bam gio ra",
      requestedCheckOut: "2026-02-02T10:00:00.000Z",
    });
  });

  it("duyet chinh cong la ap dung ngay: backend tra lai tong cong cua ngay", async () => {
    api.post.mockResolvedValueOnce({ data: { totalCong: 1 } });

    await expect(attendanceService.approveCorrection("correction-1", "OK")).resolves.toEqual({ totalCong: 1 });
    expect(api.post).toHaveBeenCalledWith("/attendance/correction-requests/correction-1/approve", { note: "OK" });
  });

  it("luoi cham cong ghep tu ba endpoint that, khong co endpoint grid", async () => {
    api.get
      .mockResolvedValueOnce({
        data: { records: [{ id: "record-1", employeeId: "emp-1", date: "2026-02-02T00:00:00.000Z", shiftId: "shift-1", checkIn: null, checkOut: null, status: "present", workHours: 8, lateMinutes: 0, earlyMinutes: 0, session: "full_day", congWeight: 1, source: "manual", note: null, leaveRequestId: null },
                    { id: "record-2", employeeId: "emp-ngoai-pham-vi", date: "2026-02-02T00:00:00.000Z", shiftId: "shift-1", checkIn: null, checkOut: null, status: "present", workHours: 8, lateMinutes: 0, earlyMinutes: 0, session: "full_day", congWeight: 1, source: "manual", note: null, leaveRequestId: null }] },
      })
      .mockResolvedValueOnce({ data: { employees: [{ id: "emp-1", code: "EMP-001", name: "Nhan Vien Mot", departmentId: "dept-1" }] } })
      .mockResolvedValueOnce({ data: { departments: [{ id: "dept-1", name: "Engineering" }] } })
      .mockResolvedValueOnce({ data: { shifts: [{ id: "shift-1", name: "Hanh chinh", startTime: "08:00", endTime: "17:00", breakMinutes: 60, status: "active" }] } });

    const grid = await attendanceService.adminGrid({ month: "2026-02" });

    expect(grid.employees).toEqual([{ _id: "emp-1", employeeCode: "EMP-001", fullName: "Nhan Vien Mot", departmentName: "Engineering" }]);
    // Ban ghi cua nguoi khong nam trong danh sach bi bo -> luoi khong hien du lieu la.
    expect(grid.records.map((record) => record._id)).toEqual(["record-1"]);
    expect(api.get).toHaveBeenNthCalledWith(1, "/attendance/records/visible", {
      params: { start: "2026-02-01T00:00:00.000Z", end: "2026-02-28T00:00:00.000Z" },
    });
  });

  it("nhan vien tu nop don nghi: KHONG gui employeeId, backend suy ra tu token", async () => {
    api.post.mockResolvedValueOnce({ data: { leaveRequestId: "leave-9" } });
    api.get.mockResolvedValueOnce({
      data: { id: "leave-9", employeeId: "emp-1", leaveType: "annual", startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-02-02T00:00:00.000Z", days: 2, halfDaySession: null, reason: "Viec rieng", status: "pending", approverId: null, approvedAt: null, rejectionReason: null, createdBy: "emp-1", createdAt: "2026-01-30T00:00:00.000Z" },
    });

    await expect(attendanceService.submitLeave({
      leaveType: "annual", startDate: "2026-02-01", endDate: "2026-02-02", reason: "Viec rieng",
    })).resolves.toMatchObject({ _id: "leave-9", status: "pending" });

    expect(api.post).toHaveBeenCalledWith("/attendance/leave-requests", {
      leaveType: "annual", startDate: "2026-02-01", endDate: "2026-02-02", reason: "Viec rieng",
    });
    expect(api.get).toHaveBeenCalledWith("/attendance/leave-requests/leave-9");
  });

  it("don nghi va so du cua chinh minh: goi endpoint chung, backend thu hep theo pham vi", async () => {
    api.get.mockResolvedValueOnce({
      data: { leaveRequests: [{ id: "leave-9", employeeId: "emp-1", leaveType: "annual", startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-02-02T00:00:00.000Z", days: 2, halfDaySession: null, reason: null, status: "pending", approverId: null, approvedAt: null, rejectionReason: null, createdBy: "emp-1", createdAt: "2026-01-30T00:00:00.000Z" }] },
    }).mockResolvedValueOnce({
      data: { balances: [{ id: "balance-1", employeeId: "emp-1", leaveType: "annual", year: 2026, entitled: 12, used: 2, remaining: 10 }] },
    });

    await expect(attendanceService.myLeaves()).resolves.toMatchObject([{ _id: "leave-9", employeeId: "emp-1" }]);
    await expect(attendanceService.myBalances(2026)).resolves.toMatchObject([{ _id: "balance-1", remaining: 10 }]);

    expect(api.get).toHaveBeenNthCalledWith(1, "/attendance/leave-requests");
    // Khong co employeeId trong params -> backend lay nhan vien cua chinh actor.
    expect(api.get).toHaveBeenNthCalledWith(2, "/attendance/leave-balances", { params: { year: 2026 } });
  });

  it("cancels a leave request through its backend resource endpoint", async () => {
    api.post.mockResolvedValueOnce({ data: undefined });
    api.get.mockResolvedValueOnce({
      data: { id: "leave-1", employeeId: "emp-1", leaveType: "annual", startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-02-01T00:00:00.000Z", days: 1, halfDaySession: null, reason: null, status: "cancelled", approverId: null, approvedAt: null, rejectionReason: null, createdBy: "emp-1", createdAt: "2026-01-30T00:00:00.000Z" },
    });

    await expect(attendanceService.cancelLeave("leave-1")).resolves.toMatchObject({ _id: "leave-1", status: "cancelled" });
    expect(api.post).toHaveBeenCalledWith("/attendance/leave-requests/leave-1/cancel", {});
    expect(api.get).toHaveBeenCalledWith("/attendance/leave-requests/leave-1");
  });
});
