import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";
import LeaveType from "@modules/attendance/core/domain/value-objects/LeaveType";
import { describe, expect, it } from "vitest";

function d(y: number, m: number, day: number): Date {
    return new Date(Date.UTC(y, m - 1, day));
}

function baseInput(overrides: Partial<Parameters<typeof LeaveRequest.create>[0]> = {}) {
    return {
        id:             "id-1",
        employeeId:     "emp-1",
        leaveType:      LeaveType.ANNUAL,
        startDate:      d(2026, 1, 5),
        endDate:        d(2026, 1, 6),
        days:           2,
        halfDaySession: null,
        reason:         null,
        createdBy:      "user-1",
        ...overrides,
    };
}

describe("LeaveRequest.create", () => {
    it("chặn ngày kết thúc trước ngày bắt đầu", () => {
        expect(() => LeaveRequest.create(baseInput({ startDate: d(2026, 1, 10), endDate: d(2026, 1, 5) })))
            .toThrow(/end date/i);
    });

    it("chặn nghỉ nửa ngày trải nhiều ngày", () => {
        expect(() => LeaveRequest.create(baseInput({
            startDate: d(2026, 1, 5), endDate: d(2026, 1, 6), halfDaySession: "morning", days: 0.5,
        }))).toThrow(/half-day/i);
    });

    it("chặn khoảng nghỉ không có ngày làm việc nào", () => {
        expect(() => LeaveRequest.create(baseInput({ days: 0 }))).toThrow(/no working day/i);
    });

    it("tạo thành công với dữ liệu hợp lệ, trạng thái pending", () => {
        const leaveRequest = LeaveRequest.create(baseInput());
        expect(leaveRequest.status.isPending).toBe(true);
    });
});
