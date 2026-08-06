import LeaveOverlapError from "@modules/attendance/core/app/errors/LeaveOverlapError";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import LeaveAccessScope from "@modules/attendance/core/app/services/LeaveAccessScope";
import LeaveDecisionAuthorizer from "@modules/attendance/core/app/services/LeaveDecisionAuthorizer";
import LeaveEntitlementService from "@modules/attendance/core/app/services/LeaveEntitlementService";
import ApproveLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/ApproveLeaveRequestUseCase";
import SubmitLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/SubmitLeaveRequestUseCase";
import LeaveBalance from "@modules/attendance/core/domain/entities/LeaveBalance";
import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";
import LeaveType from "@modules/attendance/core/domain/value-objects/LeaveType";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import EventBus from "@shared/core/domain/EventBus";
import { beforeEach, describe, expect, it } from "vitest";
import { mock, MockProxy } from "vitest-mock-extended";

function d(y: number, m: number, day: number): Date {
    return new Date(Date.UTC(y, m - 1, day));
}

describe("SubmitLeaveRequestUseCase", () => {
    let permissions: MockProxy<PermissionChecker>;
    let leaveRequestRepo: MockProxy<LeaveRequestRepo>;
    let holidayRepo: MockProxy<HolidayRepo>;
    let employeeDirectory: MockProxy<EmployeeDirectory>;
    let leaveBalanceRepo: MockProxy<LeaveBalanceRepo>;
    let eventBus: MockProxy<EventBus>;
    let useCase: SubmitLeaveRequestUseCase;

    beforeEach(() => {
        permissions       = mock<PermissionChecker>();
        leaveRequestRepo  = mock<LeaveRequestRepo>();
        holidayRepo       = mock<HolidayRepo>();
        employeeDirectory = mock<EmployeeDirectory>();
        leaveBalanceRepo  = mock<LeaveBalanceRepo>();
        eventBus          = mock<EventBus>();

        useCase = new SubmitLeaveRequestUseCase(
            new LeaveAccessScope(permissions, employeeDirectory), leaveRequestRepo, holidayRepo, employeeDirectory,
            new LeaveEntitlementService(leaveBalanceRepo), eventBus,
        );

        // Actor mac dinh la HR: pham vi `all` -> nop thay cho ai cung duoc.
        permissions.resolveScope.mockResolvedValue("all");
        employeeDirectory.employeeExists.mockResolvedValue(true);
        holidayRepo.listOverlapping.mockResolvedValue([]);
        leaveRequestRepo.listOverlapping.mockResolvedValue([]);
        leaveBalanceRepo.listInYearWindow.mockResolvedValue([
            LeaveBalance.create({ id: "b1", employeeId: "emp-1", leaveType: LeaveType.ANNUAL, year: 2026, entitled: 12 }),
        ]);
    });

    it("từ chối khi không có quyền nộp đơn", async () => {
        permissions.resolveScope.mockRejectedValue(new AccessDeniedError());

        await expect(useCase.execute({
            employeeId:  "emp-1",
            leaveType:   "annual",
            startDate:   d(2026, 1, 5), // Mon
            endDate:     d(2026, 1, 6), // Tue
            actorUserId: "user-1",
        })).rejects.toBeInstanceOf(AccessDeniedError);

        expect(leaveRequestRepo.save).not.toHaveBeenCalled();
    });

    it("chặn khi trùng đơn khác đang chờ/duyệt", async () => {
        permissions.assertPermission.mockResolvedValue(undefined);
        leaveRequestRepo.listOverlapping.mockResolvedValue([
            LeaveRequest.create({
                id: "other", employeeId: "emp-1", leaveType: LeaveType.ANNUAL,
                startDate: d(2026, 1, 5), endDate: d(2026, 1, 6), days: 2,
                halfDaySession: null, reason: null, createdBy: "user-1",
            }),
        ]);

        await expect(useCase.execute({
            employeeId: "emp-1", leaveType: "annual",
            startDate: d(2026, 1, 5), endDate: d(2026, 1, 6), actorUserId: "user-1",
        })).rejects.toBeInstanceOf(LeaveOverlapError);
    });

    it("nộp đơn thành công và phát sự kiện submitted", async () => {
        permissions.assertPermission.mockResolvedValue(undefined);

        const output = await useCase.execute({
            employeeId: "emp-1", leaveType: "annual",
            startDate: d(2026, 1, 5), endDate: d(2026, 1, 6), actorUserId: "user-1",
        });

        expect(output.leaveRequestId).toBeTruthy();
        expect(leaveRequestRepo.save).toHaveBeenCalledOnce();
        expect(eventBus.publish).toHaveBeenCalledOnce();
    });
});

describe("ApproveLeaveRequestUseCase", () => {
    let permissions: MockProxy<PermissionChecker>;
    let employees: MockProxy<EmployeeDirectory>;
    let decisionAuthorizer: LeaveDecisionAuthorizer;
    let leaveRequestRepo: MockProxy<LeaveRequestRepo>;
    let leaveBalanceRepo: MockProxy<LeaveBalanceRepo>;
    let attendanceRepo: MockProxy<AttendanceRepo>;
    let holidayRepo: MockProxy<HolidayRepo>;
    let eventBus: MockProxy<EventBus>;
    let useCase: ApproveLeaveRequestUseCase;

    function pendingRequest(): LeaveRequest {
        return LeaveRequest.create({
            id: "lr-1", employeeId: "emp-1", leaveType: LeaveType.ANNUAL,
            startDate: d(2026, 1, 5), endDate: d(2026, 1, 6), days: 2,
            halfDaySession: null, reason: null, createdBy: "user-1",
        });
    }

    beforeEach(() => {
        permissions      = mock<PermissionChecker>();
        leaveRequestRepo = mock<LeaveRequestRepo>();
        leaveBalanceRepo = mock<LeaveBalanceRepo>();
        attendanceRepo   = mock<AttendanceRepo>();
        holidayRepo      = mock<HolidayRepo>();
        eventBus         = mock<EventBus>();

        employees        = mock<EmployeeDirectory>();
        decisionAuthorizer = new LeaveDecisionAuthorizer(permissions, employees);

        useCase = new ApproveLeaveRequestUseCase(
            decisionAuthorizer, leaveRequestRepo, leaveBalanceRepo, attendanceRepo, holidayRepo,
            new LeaveEntitlementService(leaveBalanceRepo), eventBus,
            // Kỳ công mở — trường hợp kỳ đã chốt có test riêng.
            { async findLockedPeriodCovering() { return undefined; } },
        );

        permissions.resolveScope.mockResolvedValue("all");
        employees.isManagedBy.mockResolvedValue(true);
        leaveRequestRepo.getById.mockResolvedValue(pendingRequest());
        leaveRequestRepo.listOverlapping.mockResolvedValue([]);
        holidayRepo.listOverlapping.mockResolvedValue([]);
        leaveBalanceRepo.listInYearWindow.mockResolvedValue([
            LeaveBalance.create({ id: "b1", employeeId: "emp-1", leaveType: LeaveType.ANNUAL, year: 2026, entitled: 12 }),
        ]);
        leaveBalanceRepo.getOne.mockResolvedValue(undefined);
    });

    it("từ chối khi không có quyền duyệt đơn (leave:approve)", async () => {
        permissions.resolveScope.mockRejectedValue(new AccessDeniedError());
        await expect(useCase.execute({ leaveRequestId: "lr-1", actorUserId: "user-1" }))
            .rejects.toBeInstanceOf(AccessDeniedError);
        expect(leaveBalanceRepo.save).not.toHaveBeenCalled();
    });

    it("duyệt đơn: cộng used vào số dư phép năm và sinh chấm công", async () => {
        await useCase.execute({ leaveRequestId: "lr-1", actorUserId: "user-1" });

        expect(leaveRequestRepo.save).toHaveBeenCalledOnce();
        expect(leaveBalanceRepo.save).toHaveBeenCalledOnce();
        const savedBalance = leaveBalanceRepo.save.mock.calls[0]![0];
        expect(savedBalance.used).toBe(2);

        // 2 ngày làm việc (Mon+Tue) => 2 bản ghi chấm công "leave"
        expect(attendanceRepo.save).toHaveBeenCalledTimes(2);
        expect(eventBus.publish).toHaveBeenCalledOnce();
    });
});
