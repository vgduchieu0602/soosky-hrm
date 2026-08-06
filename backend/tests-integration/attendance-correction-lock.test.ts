import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import createTestApp, { TestApp } from "./support/testApp";

/**
 * Chấm công + chỉnh công + chốt kỳ, chạy trên MongoDB thật:
 *
 *   HR nhập công → nhân viên xem bảng công CỦA MÌNH → nhân viên yêu cầu chỉnh
 *   công (quên bấm giờ ra) → quản lý duyệt → công được tính lại ngay →
 *   HR chốt kỳ → mọi thao tác ghi bị chặn → HR mở khoá kèm LÝ DO → ghi lại được.
 */
describe("Chấm công, chỉnh công và chốt kỳ", () => {
    let ctx: TestApp;

    let hrToken:      string;
    let staffToken:   string;
    let managerToken: string;

    let departmentId: string;
    let positionId:   string;
    let managerId:    string;
    let staffId:      string;
    let otherId:      string;
    let periodId:     string;

    const asHr      = () => ({ Authorization: `Bearer ${hrToken}` });
    const asStaff   = () => ({ Authorization: `Bearer ${staffToken}` });
    const asManager = () => ({ Authorization: `Bearer ${managerToken}` });

    // 2026-09-07 là thứ Hai. Giờ VN = UTC+7 → 08:00 VN = 01:00 UTC.
    const WORK_DAY  = "2026-09-07T03:00:00.000Z";
    const IN_08_00  = "2026-09-07T01:00:00.000Z";
    const OUT_17_00 = "2026-09-07T10:00:00.000Z";

    /** Cấp account cho một nhân viên rồi kích hoạt + đổi mật khẩu, trả về access token. */
    async function loginAs(employeeId: string, password: string): Promise<string> {
        await request(ctx.app).post(`/api/v1/employee/employees/${employeeId}/grant-login`).set(asHr()).expect(201);

        const mail = ctx.sentMails.at(-1);
        if (mail == undefined) throw new Error("khong bat duoc mail kich hoat");

        await request(ctx.app).post("/api/v1/auth/accounts/verification").send({ token: mail.verificationToken }).expect(200);

        const first = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: mail.recipient, password: mail.temporaryPassword })
            .expect(200);

        await request(ctx.app)
            .put("/api/v1/auth/me/password")
            .set({ Authorization: `Bearer ${first.body.accessToken}` })
            .send({ currentPassword: mail.temporaryPassword, newPassword: password })
            .expect(200);

        const second = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: mail.recipient, password })
            .expect(200);
        return second.body.accessToken;
    }

    beforeAll(async () => {
        ctx = await createTestApp();

        const login = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: ctx.superAdmin.email, password: ctx.superAdmin.password })
            .expect(200);
        hrToken = login.body.accessToken;

        const department = await request(ctx.app)
            .post("/api/v1/department/departments").set(asHr())
            .send({ code: "ENG", name: "Engineering" }).expect(201);
        departmentId = department.body.departmentId;

        const position = await request(ctx.app)
            .post("/api/v1/department/positions").set(asHr())
            .send({ code: "BE-DEV", title: "Backend Developer", departmentId }).expect(201);
        positionId = position.body.positionId;

        const manager = await request(ctx.app)
            .post("/api/v1/employee/employees").set(asHr())
            .send({ code: "EMP-MGR", name: "Truong Nhom", email: "mgr@soosky.test",
                    departmentId, positionId, hireDate: "2026-01-05T00:00:00.000Z", employeeType: "full_time" })
            .expect(201);
        managerId = manager.body.employeeId;

        const staff = await request(ctx.app)
            .post("/api/v1/employee/employees").set(asHr())
            .send({ code: "EMP-001", name: "Nhan Vien Mot", email: "nv1@soosky.test",
                    departmentId, positionId, managerId, hireDate: "2026-01-06T00:00:00.000Z", employeeType: "full_time" })
            .expect(201);
        staffId = staff.body.employeeId;

        const other = await request(ctx.app)
            .post("/api/v1/employee/employees").set(asHr())
            .send({ code: "EMP-002", name: "Nguoi Ngoai Nhom", email: "nv2@soosky.test",
                    departmentId, positionId, hireDate: "2026-01-06T00:00:00.000Z", employeeType: "full_time" })
            .expect(201);
        otherId = other.body.employeeId;

        // Hợp đồng active để nhân viên vào biên chế; ca hành chính thứ 2–6.
        for (const employeeId of [managerId, staffId, otherId]) {
            await request(ctx.app)
                .post(`/api/v1/employee/employees/${employeeId}/contracts`).set(asHr())
                .send({ contractType: "indefinite", employmentStatus: "official", contractNumber: `HD-${employeeId.slice(-4)}`,
                        startDate: "2026-01-06T00:00:00.000Z", baseSalary: 18_000_000, status: "active" })
                .expect(201);
        }

        await request(ctx.app)
            .post("/api/v1/attendance/shifts").set(asHr())
            .send({ code: "HC", name: "Hanh chinh", startTime: "08:00", endTime: "17:00", breakMinutes: 60, workingDays: [1, 2, 3, 4, 5] })
            .expect(201);

        staffToken   = await loginAs(staffId, "NhanVien#2026");
        managerToken = await loginAs(managerId, "Manager#2026");

        // Nâng role manager cho trưởng nhóm.
        const roles       = await request(ctx.app).get("/api/v1/iam/roles").set(asHr()).expect(200);
        const managerRole = roles.body.roles.find((role: { key: string }) => role.key === "manager");
        const accounts    = await request(ctx.app).get("/api/v1/auth/accounts").set(asHr()).expect(200);
        const account     = accounts.body.accounts.find((a: { email: string }) => a.email === "mgr@soosky.test");

        await request(ctx.app)
            .post(`/api/v1/iam/users/${account.id}/roles`).set(asHr())
            .send({ roleId: managerRole.id }).expect(201);

        // Đăng nhập lại để token mang role mới (quyền nằm ở DB, nhưng lấy token
        // mới cho chắc chắn không phụ thuộc thứ tự).
        managerToken = (await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: "mgr@soosky.test", password: "Manager#2026" })
            .expect(200)).body.accessToken;
    });

    afterAll(async () => {
        await ctx?.dispose();
    });

    it("1. HR nhập công: thiếu giờ ra → incomplete, không tính công", async () => {
        const res = await request(ctx.app)
            .post("/api/v1/attendance/records").set(asHr())
            .send({ employeeId: staffId, date: WORK_DAY, checkIn: IN_08_00 })
            .expect(200);

        expect(res.body.totalCong).toBe(0);
        expect(res.body.records[0].status).toBe("incomplete");
    });

    it("2. nhân viên xem bảng công CỦA MÌNH mà không cần gửi employeeId", async () => {
        const mine = await request(ctx.app)
            .get("/api/v1/attendance/records")
            .query({ start: "2026-09-01T00:00:00.000Z", end: "2026-09-30T00:00:00.000Z" })
            .set(asStaff())
            .expect(200);

        expect(mine.body.records).toHaveLength(1);
        expect(mine.body.records[0].employeeId).toBe(staffId);

        // Không xem được bảng công người ngoài phạm vi.
        await request(ctx.app)
            .get("/api/v1/attendance/records")
            .query({ employeeId: otherId, start: "2026-09-01T00:00:00.000Z", end: "2026-09-30T00:00:00.000Z" })
            .set(asStaff())
            .expect(403);

        // Nhân viên vẫn KHÔNG ghi được bảng công.
        await request(ctx.app)
            .post("/api/v1/attendance/records").set(asStaff())
            .send({ employeeId: staffId, date: WORK_DAY, checkIn: IN_08_00, checkOut: OUT_17_00 })
            .expect(403);
    });

    it("3. nhân viên gửi yêu cầu chỉnh công, quản lý duyệt → công tính lại ngay", async () => {
        const submitted = await request(ctx.app)
            .post("/api/v1/attendance/correction-requests").set(asStaff())
            .send({ date: WORK_DAY, requestedCheckIn: IN_08_00, requestedCheckOut: OUT_17_00, reason: "Quen bam gio ra" })
            .expect(201);

        const correctionId = submitted.body.correctionRequestId;

        // Gửi trùng cho cùng ngày bị chặn.
        await request(ctx.app)
            .post("/api/v1/attendance/correction-requests").set(asStaff())
            .send({ date: WORK_DAY, requestedCheckIn: IN_08_00, requestedCheckOut: OUT_17_00, reason: "Gui lai" })
            .expect(409);

        // Thiếu lý do → 400 (validation), không nêu giờ nào → 422 (domain).
        await request(ctx.app)
            .post("/api/v1/attendance/correction-requests").set(asStaff())
            .send({ date: "2026-09-08T03:00:00.000Z", requestedCheckIn: IN_08_00 })
            .expect(400);
        await request(ctx.app)
            .post("/api/v1/attendance/correction-requests").set(asStaff())
            .send({ date: "2026-09-08T03:00:00.000Z", reason: "Khong neu gio nao" })
            .expect(422);

        // Nhân viên KHÔNG tự duyệt yêu cầu của mình.
        await request(ctx.app)
            .post(`/api/v1/attendance/correction-requests/${correctionId}/approve`).set(asStaff())
            .expect(403);

        // Quản lý thấy yêu cầu trong hàng chờ của nhóm mình.
        const queue = await request(ctx.app)
            .get("/api/v1/attendance/correction-requests").query({ status: "pending" }).set(asManager())
            .expect(200);
        expect(queue.body.correctionRequests.map((r: { id: string }) => r.id)).toContain(correctionId);

        const approved = await request(ctx.app)
            .post(`/api/v1/attendance/correction-requests/${correctionId}/approve`).set(asManager())
            .send({ note: "Da xac nhan voi bao ve" })
            .expect(200);
        expect(approved.body.totalCong).toBe(1);

        // Bảng công đổi ngay: đủ công, đúng giờ.
        const after = await request(ctx.app)
            .get("/api/v1/attendance/records")
            .query({ start: "2026-09-01T00:00:00.000Z", end: "2026-09-30T00:00:00.000Z" })
            .set(asStaff())
            .expect(200);
        expect(after.body.records[0].status).toBe("present");
        expect(after.body.records[0].source).toBe("correction");

        // Duyệt lại lần hai bị chặn (yêu cầu đã quyết định).
        await request(ctx.app)
            .post(`/api/v1/attendance/correction-requests/${correctionId}/approve`).set(asManager())
            .expect(422);
    });

    it("4. quản lý không duyệt được yêu cầu ngoài nhóm", async () => {
        const outside = await request(ctx.app)
            .post("/api/v1/attendance/correction-requests").set(asHr())
            .send({ employeeId: otherId, date: "2026-09-09T03:00:00.000Z",
                    requestedCheckIn: "2026-09-09T01:00:00.000Z", requestedCheckOut: "2026-09-09T10:00:00.000Z",
                    reason: "HR nhap thay" })
            .expect(201);

        await request(ctx.app)
            .post(`/api/v1/attendance/correction-requests/${outside.body.correctionRequestId}/approve`).set(asManager())
            .expect(403);

        // HR duyệt được, kèm lý do từ chối thì cũng phải nêu lý do.
        await request(ctx.app)
            .post(`/api/v1/attendance/correction-requests/${outside.body.correctionRequestId}/reject`).set(asHr())
            .send({})
            .expect(400);

        await request(ctx.app)
            .post(`/api/v1/attendance/correction-requests/${outside.body.correctionRequestId}/reject`).set(asHr())
            .send({ reason: "Khong co chung tu" })
            .expect(200);
    });

    it("5. chốt kỳ công: mọi thao tác ghi bảng công bị chặn", async () => {
        const period = await request(ctx.app)
            .post("/api/v1/payroll/periods").set(asHr())
            .send({ name: "2026-09", startDate: "2026-09-01T00:00:00.000Z", endDate: "2026-09-30T00:00:00.000Z",
                    payDate: "2026-10-05T00:00:00.000Z", standardWorkDays: 22 })
            .expect(201);
        periodId = period.body.periodId;

        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/lock-attendance`).set(asHr()).expect(200);

        // HR nhập công: chặn.
        const blocked = await request(ctx.app)
            .post("/api/v1/attendance/records").set(asHr())
            .send({ employeeId: staffId, date: WORK_DAY, checkIn: IN_08_00, checkOut: OUT_17_00 })
            .expect(409);
        expect(blocked.body.code).toBe("ATTENDANCE_PERIOD_LOCKED");

        // Gửi yêu cầu chỉnh công cho ngày đã chốt: chặn ngay từ khâu gửi.
        await request(ctx.app)
            .post("/api/v1/attendance/correction-requests").set(asStaff())
            .send({ date: "2026-09-10T03:00:00.000Z", requestedCheckIn: "2026-09-10T01:00:00.000Z", reason: "Sau khi chot" })
            .expect(409);

        // Duyệt đơn nghỉ trong kỳ đã chốt: chặn (duyệt sinh bản ghi chấm công).
        await request(ctx.app)
            .post("/api/v1/attendance/leave-balances").set(asHr())
            .send({ employeeId: staffId, leaveType: "annual", year: 2026, entitled: 12 })
            .expect(200);

        const leave = await request(ctx.app)
            .post("/api/v1/attendance/leave-requests").set(asHr())
            .send({ employeeId: staffId, leaveType: "annual",
                    startDate: "2026-09-14T00:00:00.000Z", endDate: "2026-09-14T00:00:00.000Z" })
            .expect(201);

        await request(ctx.app)
            .post(`/api/v1/attendance/leave-requests/${leave.body.leaveRequestId}/approve`).set(asHr())
            .expect(409);
    });

    it("6. mở khoá BẮT BUỘC nêu lý do, và lý do vào nhật ký audit", async () => {
        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${periodId}/unlock-attendance`).set(asHr())
            .send({})
            .expect(400);

        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${periodId}/unlock-attendance`).set(asHr())
            .send({ reason: "Bo sung cong ngay 07/09 theo bien ban" })
            .expect(200);

        // Mở khoá rồi ghi lại được.
        const rewritten = await request(ctx.app)
            .post("/api/v1/attendance/records").set(asHr())
            .send({ employeeId: staffId, date: WORK_DAY, checkIn: IN_08_00, checkOut: OUT_17_00 })
            .expect(200);
        expect(rewritten.body.totalCong).toBe(1);

        const audit = await request(ctx.app).get("/api/v1/iam/audit-logs").set(asHr()).expect(200);
        const logs  = audit.body.auditLogs ?? audit.body.logs ?? audit.body.items;
        const keys  = new Set<string>(logs.map((log: { resource: string; action: string }) => `${log.resource}:${log.action}`));

        expect(keys).toContain("attendance_correction:submit");
        expect(keys).toContain("attendance_correction:approve");
        expect(keys).toContain("attendance_correction:reject");
        expect(keys).toContain("payroll_period:unlock_attendance");

        const unlockLog = logs.find((log: { action: string }) => log.action === "unlock_attendance");
        expect(unlockLog.changes.reason).toBe("Bo sung cong ngay 07/09 theo bien ban");
    });

    it("7. số dư phép trả kèm bể phép năm cộng dồn", async () => {
        const res = await request(ctx.app)
            .get("/api/v1/attendance/leave-balances").query({ year: 2026 }).set(asStaff())
            .expect(200);

        expect(res.body.employeeId).toBe(staffId);
        expect(res.body.carryoverYears).toBe(3);
        expect(res.body.annualRemaining).toBeGreaterThan(0);
    });
});
