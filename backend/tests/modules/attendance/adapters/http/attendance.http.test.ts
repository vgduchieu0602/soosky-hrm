/// <reference types="jest" />
import { AttendanceHttpUseCases, createAttendanceHttpRouter } from "@modules/attendance";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import AttendanceSymbolRepo from "@modules/attendance/core/app/ports/AttendanceSymbolRepo";
import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";
import LeaveEntitlementService from "@modules/attendance/core/app/services/LeaveEntitlementService";
import ArchiveShiftUseCase from "@modules/attendance/core/app/use-cases/shift/ArchiveShiftUseCase";
import CreateShiftUseCase from "@modules/attendance/core/app/use-cases/shift/CreateShiftUseCase";
import DeleteShiftUseCase from "@modules/attendance/core/app/use-cases/shift/DeleteShiftUseCase";
import GetShiftUseCase from "@modules/attendance/core/app/use-cases/shift/GetShiftUseCase";
import ListShiftsUseCase from "@modules/attendance/core/app/use-cases/shift/ListShiftsUseCase";
import UpdateShiftUseCase from "@modules/attendance/core/app/use-cases/shift/UpdateShiftUseCase";
import CreateHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/CreateHolidayUseCase";
import DeleteHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/DeleteHolidayUseCase";
import GetHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/GetHolidayUseCase";
import ListHolidaysUseCase from "@modules/attendance/core/app/use-cases/holiday/ListHolidaysUseCase";
import UpdateHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/UpdateHolidayUseCase";
import CreateAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/CreateAttendanceSymbolUseCase";
import DeleteAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/DeleteAttendanceSymbolUseCase";
import GetAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/GetAttendanceSymbolUseCase";
import ListAttendanceSymbolsUseCase from "@modules/attendance/core/app/use-cases/symbol/ListAttendanceSymbolsUseCase";
import UpdateAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/UpdateAttendanceSymbolUseCase";
import DeleteAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/DeleteAttendanceUseCase";
import GetAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/GetAttendanceUseCase";
import ListAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/ListAttendanceUseCase";
import UpsertAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/UpsertAttendanceUseCase";
import ApproveLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/ApproveLeaveRequestUseCase";
import CancelLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/CancelLeaveRequestUseCase";
import GetLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/GetLeaveRequestUseCase";
import ListLeaveRequestsUseCase from "@modules/attendance/core/app/use-cases/leave/ListLeaveRequestsUseCase";
import RejectLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/RejectLeaveRequestUseCase";
import SubmitLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/SubmitLeaveRequestUseCase";
import AdjustLeaveBalanceUseCase from "@modules/attendance/core/app/use-cases/leave-balance/AdjustLeaveBalanceUseCase";
import GetLeaveBalanceUseCase from "@modules/attendance/core/app/use-cases/leave-balance/GetLeaveBalanceUseCase";
import ListLeaveBalancesUseCase from "@modules/attendance/core/app/use-cases/leave-balance/ListLeaveBalancesUseCase";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";
import AttendanceSymbol from "@modules/attendance/core/domain/entities/AttendanceSymbol";
import Holiday from "@modules/attendance/core/domain/entities/Holiday";
import LeaveBalance from "@modules/attendance/core/domain/entities/LeaveBalance";
import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";
import Shift from "@modules/attendance/core/domain/entities/Shift";
import AccessTokenVerifier, { AuthenticatedActor } from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import EventBus from "@shared/core/domain/EventBus";
import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

class InMemoryShiftRepo implements ShiftRepo {
    private readonly _store = new Map<string, Shift>();
    async getById(id: string) { return this._store.get(id); }
    async getByCode(code: string) { return [...this._store.values()].find(s => s.code.value === code); }
    async listAll() { return [...this._store.values()]; }
    async listActive() { return [...this._store.values()].filter(s => s.status.isActive); }
    async save(s: Shift) { this._store.set(s.id, s); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryHolidayRepo implements HolidayRepo {
    private readonly _store = new Map<string, Holiday>();
    async getById(id: string) { return this._store.get(id); }
    async listAll() { return [...this._store.values()]; }
    async listOverlapping() { return [...this._store.values()]; }
    async save(h: Holiday) { this._store.set(h.id, h); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemorySymbolRepo implements AttendanceSymbolRepo {
    private readonly _store = new Map<string, AttendanceSymbol>();
    async getById(id: string) { return this._store.get(id); }
    async getByCode(code: string) { return [...this._store.values()].find(s => s.code.value === code); }
    async listAll() { return [...this._store.values()]; }
    async save(s: AttendanceSymbol) { this._store.set(s.id, s); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryAttendanceRepo implements AttendanceRepo {
    private readonly _store = new Map<string, Attendance>();
    async getById(id: string) { return this._store.get(id); }
    async getBySlot(employeeId: string, date: Date, shiftId: string) {
        return [...this._store.values()].find(a => a.employeeId === employeeId && a.date.getTime() === date.getTime() && a.shiftId === shiftId);
    }
    async listByEmployeeAndRange(employeeId: string, start: Date, end: Date) {
        return [...this._store.values()].filter(a => a.employeeId === employeeId && a.date >= start && a.date <= end);
    }
    async findFullDayLeave(employeeId: string, date: Date) {
        return [...this._store.values()].find(a => a.employeeId === employeeId && a.date.getTime() === date.getTime() && a.source === "leave" && a.session.value === "full_day");
    }
    async save(a: Attendance) { this._store.set(a.id, a); }
    async deleteById(id: string) { this._store.delete(id); }
    async deleteByLeaveRequestId(leaveRequestId: string) {
        for (const [id, a] of this._store) if (a.leaveRequestId === leaveRequestId) this._store.delete(id);
    }
}

class InMemoryLeaveRequestRepo implements LeaveRequestRepo {
    private readonly _store = new Map<string, LeaveRequest>();
    async getById(id: string) { return this._store.get(id); }
    async listByEmployee(employeeId: string) { return [...this._store.values()].filter(r => r.employeeId === employeeId); }
    async listAll() { return [...this._store.values()]; }
    async listOverlapping(employeeId: string, start: Date, end: Date, statuses: string[]) {
        return [...this._store.values()].filter(r =>
            r.employeeId === employeeId && statuses.includes(r.status.value) &&
            r.startDate <= end && r.endDate >= start);
    }
    async save(r: LeaveRequest) { this._store.set(r.id, r); }
}

class InMemoryLeaveBalanceRepo implements LeaveBalanceRepo {
    private readonly _store = new Map<string, LeaveBalance>();
    async getById(id: string) { return this._store.get(id); }
    async getOne(employeeId: string, leaveType: string, year: number) {
        return [...this._store.values()].find(b => b.employeeId === employeeId && b.leaveType.value === leaveType && b.year === year);
    }
    async listInYearWindow(employeeId: string, leaveType: string, from: number, to: number) {
        return [...this._store.values()].filter(b => b.employeeId === employeeId && b.leaveType.value === leaveType && b.year >= from && b.year <= to);
    }
    async listByEmployeeYear(employeeId: string, year: number) {
        return [...this._store.values()].filter(b => b.employeeId === employeeId && b.year === year);
    }
    async save(b: LeaveBalance) { this._store.set(b.id, b); }
}

const allowAllPermissions: PermissionChecker = {
    async assertPermission() { /* allow all in test */ },
};

const allowAllEmployeeDirectory: EmployeeDirectory = {
    async employeeExists() { return true; },
};

const noopEventBus: EventBus = {
    async publish() { /* no-op in test */ },
    subscribe() { /* no-op in test */ },
};

function buildUseCases(): { useCases: AttendanceHttpUseCases; leaveBalanceRepo: InMemoryLeaveBalanceRepo } {
    const shiftRepo         = new InMemoryShiftRepo();
    const holidayRepo       = new InMemoryHolidayRepo();
    const symbolRepo        = new InMemorySymbolRepo();
    const attendanceRepo    = new InMemoryAttendanceRepo();
    const leaveRequestRepo  = new InMemoryLeaveRequestRepo();
    const leaveBalanceRepo  = new InMemoryLeaveBalanceRepo();
    const entitlement       = new LeaveEntitlementService(leaveBalanceRepo);

    const useCases: AttendanceHttpUseCases = {
        createShift:  new CreateShiftUseCase(allowAllPermissions, shiftRepo),
        updateShift:  new UpdateShiftUseCase(allowAllPermissions, shiftRepo),
        getShift:     new GetShiftUseCase(shiftRepo),
        listShifts:   new ListShiftsUseCase(shiftRepo),
        archiveShift: new ArchiveShiftUseCase(allowAllPermissions, shiftRepo),
        deleteShift:  new DeleteShiftUseCase(allowAllPermissions, shiftRepo),

        createHoliday: new CreateHolidayUseCase(allowAllPermissions, holidayRepo),
        updateHoliday: new UpdateHolidayUseCase(allowAllPermissions, holidayRepo),
        getHoliday:    new GetHolidayUseCase(holidayRepo),
        listHolidays:  new ListHolidaysUseCase(holidayRepo),
        deleteHoliday: new DeleteHolidayUseCase(allowAllPermissions, holidayRepo),

        createAttendanceSymbol: new CreateAttendanceSymbolUseCase(allowAllPermissions, symbolRepo),
        updateAttendanceSymbol: new UpdateAttendanceSymbolUseCase(allowAllPermissions, symbolRepo),
        getAttendanceSymbol:    new GetAttendanceSymbolUseCase(symbolRepo),
        listAttendanceSymbols:  new ListAttendanceSymbolsUseCase(symbolRepo),
        deleteAttendanceSymbol: new DeleteAttendanceSymbolUseCase(allowAllPermissions, symbolRepo),

        upsertAttendance: new UpsertAttendanceUseCase(allowAllPermissions, attendanceRepo, shiftRepo, allowAllEmployeeDirectory),
        getAttendance:    new GetAttendanceUseCase(attendanceRepo),
        listAttendance:   new ListAttendanceUseCase(attendanceRepo),
        deleteAttendance: new DeleteAttendanceUseCase(allowAllPermissions, attendanceRepo),

        submitLeaveRequest:  new SubmitLeaveRequestUseCase(allowAllPermissions, leaveRequestRepo, holidayRepo, allowAllEmployeeDirectory, entitlement, noopEventBus),
        approveLeaveRequest: new ApproveLeaveRequestUseCase(allowAllPermissions, leaveRequestRepo, leaveBalanceRepo, attendanceRepo, holidayRepo, entitlement, noopEventBus),
        rejectLeaveRequest:  new RejectLeaveRequestUseCase(allowAllPermissions, leaveRequestRepo, noopEventBus),
        cancelLeaveRequest:  new CancelLeaveRequestUseCase(allowAllPermissions, leaveRequestRepo, leaveBalanceRepo, attendanceRepo),
        getLeaveRequest:     new GetLeaveRequestUseCase(leaveRequestRepo),
        listLeaveRequests:   new ListLeaveRequestsUseCase(leaveRequestRepo),

        adjustLeaveBalance: new AdjustLeaveBalanceUseCase(allowAllPermissions, leaveBalanceRepo, allowAllEmployeeDirectory),
        getLeaveBalance:    new GetLeaveBalanceUseCase(leaveBalanceRepo, entitlement),
        listLeaveBalances:  new ListLeaveBalancesUseCase(leaveBalanceRepo),
    };

    return { useCases, leaveBalanceRepo };
}

const fakeVerifier: AccessTokenVerifier = {
    async verify(token: string) { return token ? new AuthenticatedActor(token) : undefined; },
};

function buildApp(): { app: Express; leaveBalanceRepo: InMemoryLeaveBalanceRepo } {
    const { useCases, leaveBalanceRepo } = buildUseCases();
    const app = express();
    app.use("/attendance", createAttendanceHttpRouter(useCases, fakeVerifier));
    return { app, leaveBalanceRepo };
}

describe("Attendance HTTP", () => {
    let app: Express;
    let leaveBalanceRepo: InMemoryLeaveBalanceRepo;

    beforeEach(() => {
        const built = buildApp();
        app = built.app;
        leaveBalanceRepo = built.leaveBalanceRepo;
    });

    const auth = { Authorization: "Bearer user-1" };

    it("401 khi thiếu token", async () => {
        await request(app).get("/attendance/shifts").expect(401);
    });

    it("flow: tạo ca -> chấm công -> nộp đơn nghỉ -> duyệt đơn nghỉ", async () => {
        // 2026-01-05 (Mon) .. 2026-01-09 (Fri)
        const shift = await request(app).post("/attendance/shifts").set(auth).send({
            code: "FULL", name: "Full day", startTime: "08:00", endTime: "17:00",
            breakMinutes: 60, workingDays: [1, 2, 3, 4, 5],
        }).expect(201);
        expect(shift.body.shiftId).toBeTruthy();

        const upserted = await request(app).post("/attendance/records").set(auth).send({
            employeeId: "emp-1",
            date:       "2026-01-05T00:00:00.000Z",
            checkIn:    "2026-01-05T01:00:00.000Z", // 08:00 VN
            checkOut:   "2026-01-05T10:00:00.000Z", // 17:00 VN
        }).expect(200);
        expect(upserted.body.totalCong).toBe(1);
        expect(upserted.body.records).toHaveLength(1);

        await request(app).post("/attendance/leave-balances").set(auth).send({
            employeeId: "emp-1", leaveType: "annual", year: 2026, entitled: 12,
        }).expect(200);

        const submitted = await request(app).post("/attendance/leave-requests").set(auth).send({
            employeeId: "emp-1", leaveType: "annual",
            startDate: "2026-01-06T00:00:00.000Z", endDate: "2026-01-07T00:00:00.000Z",
        }).expect(201);
        const leaveRequestId = submitted.body.leaveRequestId;
        expect(leaveRequestId).toBeTruthy();

        await request(app).post(`/attendance/leave-requests/${leaveRequestId}/approve`).set(auth).expect(200);

        const approved = await request(app).get(`/attendance/leave-requests/${leaveRequestId}`).set(auth).expect(200);
        expect(approved.body.status).toBe("approved");

        const balance = await leaveBalanceRepo.getOne("emp-1", "annual", 2026);
        expect(balance?.used).toBe(2);
    });

    it("409 khi mã ca trùng", async () => {
        await request(app).post("/attendance/shifts").set(auth)
            .send({ code: "FULL", name: "A", startTime: "08:00", endTime: "12:00", breakMinutes: 0, workingDays: [1] })
            .expect(201);
        await request(app).post("/attendance/shifts").set(auth)
            .send({ code: "FULL", name: "B", startTime: "13:00", endTime: "17:00", breakMinutes: 0, workingDays: [1] })
            .expect(409).expect(res => expect(res.body.code).toBe("SHIFT_CODE_CONFLICT"));
    });
});
