import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import createTestApp, { TestApp } from "./support/testApp";

/**
 * `GET /dashboard/overview` với BỐN vai, trên MongoDB thật.
 *
 * Điều được chứng minh: không rò dữ liệu qua phạm vi. Manager không thấy nhân
 * viên ngoài nhóm và không thấy tổng lương; nhân viên chỉ thấy chính mình; nhật
 * ký chỉ hiện cho ai có `audit:read`.
 */
describe("Bảng điều khiển: phạm vi all/team/self", () => {
    let ctx: TestApp;

    let adminToken:    string;   // super admin (`*`)
    let hrToken:       string;
    let managerToken:  string;
    let staffToken:    string;

    let managerEmployeeId: string;
    let staffEmployeeId:   string;
    let outsiderEmployeeId: string;

    const asAdmin   = () => ({ Authorization: `Bearer ${adminToken}` });
    const asHr      = () => ({ Authorization: `Bearer ${hrToken}` });
    const asManager = () => ({ Authorization: `Bearer ${managerToken}` });
    const asStaff   = () => ({ Authorization: `Bearer ${staffToken}` });

    /** Cấp tài khoản cho một nhân viên, gán role, trả access token đã đổi mật khẩu. */
    async function provision(employeeId: string, roleKey: string, newPassword: string): Promise<string> {
        await request(ctx.app)
            .post(`/api/v1/employee/employees/${employeeId}/grant-login`).set(asAdmin())
            .send({}).expect(201);

        const mail = ctx.sentMails.at(-1);
        if (mail == undefined) throw new Error("khong bat duoc mail kich hoat");

        await request(ctx.app).post("/api/v1/auth/accounts/verification").send({ token: mail.verificationToken }).expect(200);

        const roles = await request(ctx.app).get("/api/v1/iam/roles").set(asAdmin()).expect(200);
        const role  = roles.body.roles.find((row: { key: string }) => row.key === roleKey);

        const accounts = await request(ctx.app).get("/api/v1/auth/accounts").set(asAdmin()).expect(200);
        const account  = accounts.body.accounts.find((row: { email: string }) => row.email === mail.recipient);

        // User mới đã tự nhận role `employee` lúc xác minh account, nên gán lại
        // chính role đó trả 409 — chấp nhận cả hai mã, cái cần là user CÓ role.
        const assign = await request(ctx.app)
            .post(`/api/v1/iam/users/${account.id}/roles`).set(asAdmin())
            .send({ roleId: role.id });
        expect([201, 409]).toContain(assign.status);

        const firstLogin = await request(ctx.app)
            .post("/api/v1/auth/sessions").send({ email: mail.recipient, password: mail.temporaryPassword }).expect(200);

        await request(ctx.app)
            .put("/api/v1/auth/me/password")
            .set({ Authorization: `Bearer ${firstLogin.body.accessToken}` })
            .send({ currentPassword: mail.temporaryPassword, newPassword })
            .expect(200);

        const login = await request(ctx.app)
            .post("/api/v1/auth/sessions").send({ email: mail.recipient, password: newPassword }).expect(200);

        return login.body.accessToken;
    }

    beforeAll(async () => {
        ctx = await createTestApp();

        adminToken = (await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: ctx.superAdmin.email, password: ctx.superAdmin.password })
            .expect(200)).body.accessToken;

        const departmentId = (await request(ctx.app)
            .post("/api/v1/department/departments").set(asAdmin())
            .send({ code: "ENG", name: "Engineering" }).expect(201)).body.departmentId;

        const positionId = (await request(ctx.app)
            .post("/api/v1/department/positions").set(asAdmin())
            .send({ code: "BE-DEV", title: "Backend Developer", departmentId }).expect(201)).body.positionId;

        const create = async (code: string, name: string, email: string, managerId?: string): Promise<string> => {
            const response = await request(ctx.app)
                .post("/api/v1/employee/employees").set(asAdmin())
                .send({
                    code, name, email, departmentId, positionId,
                    ...(managerId == undefined ? {} : { managerId }),
                    hireDate: "2026-01-05T00:00:00.000Z", employeeType: "full_time",
                })
                .expect(201);
            return response.body.employeeId;
        };

        const hrEmployeeId = await create("EMP-HR", "Nhan Su", "hr@soosky.test");
        managerEmployeeId  = await create("EMP-MGR", "Quan Ly", "mgr@soosky.test");
        staffEmployeeId    = await create("EMP-001", "Nhan Vien Mot", "nv1@soosky.test", managerEmployeeId);
        // Người NGOÀI nhóm của manager — dùng để chứng minh phạm vi team.
        outsiderEmployeeId = await create("EMP-002", "Nguoi Ngoai Nhom", "nv2@soosky.test");

        hrToken      = await provision(hrEmployeeId, "hr", "HrPass#2026");
        managerToken = await provision(managerEmployeeId, "manager", "MgrPass#2026");
        staffToken   = await provision(staffEmployeeId, "employee", "StaffPass#2026");

        // Hợp đồng active mới chuyển nhân viên từ `onboarding` sang `active` — KPI
        // "đang làm việc" của bảng điều khiển đếm đúng trạng thái đó.
        for (const [employeeId, contractNumber] of [[staffEmployeeId, "HD-001"], [outsiderEmployeeId, "HD-002"]]) {
            await request(ctx.app)
                .post(`/api/v1/employee/employees/${employeeId}/contracts`).set(asAdmin())
                .send({
                    contractType: "indefinite", employmentStatus: "official", contractNumber,
                    startDate: "2026-01-05T00:00:00.000Z", baseSalary: 20_000_000, status: "active",
                })
                .expect(201);
        }

        // Chấm công hôm nay cho staff + người ngoài nhóm.
        const today = new Date().toISOString().slice(0, 10);
        await request(ctx.app)
            .post("/api/v1/attendance/shifts").set(asAdmin())
            .send({ code: "HC", name: "Hanh chinh", startTime: "08:00", endTime: "17:00", breakMinutes: 60, workingDays: [1, 2, 3, 4, 5] })
            .expect(201);

        for (const employeeId of [staffEmployeeId, outsiderEmployeeId]) {
            await request(ctx.app)
                .post("/api/v1/attendance/records").set(asAdmin())
                .send({ employeeId, date: `${today}T03:00:00.000Z`, checkIn: `${today}T01:00:00.000Z`, checkOut: `${today}T10:00:00.000Z` })
                .expect(200);
        }

        // Nghỉ phép năm cần số dư -> cấp trước, nếu không tạo đơn bị 409 LEAVE_QUOTA_EXCEEDED.
        for (const employeeId of [staffEmployeeId, outsiderEmployeeId]) {
            await request(ctx.app)
                .post("/api/v1/attendance/leave-balances").set(asAdmin())
                .send({ employeeId, leaveType: "annual", year: 2026, entitled: 12 })
                .expect(200);
        }

        // Đơn nghỉ chờ duyệt: một của staff (trong nhóm manager), một của người ngoài nhóm.
        await request(ctx.app)
            .post("/api/v1/attendance/leave-requests").set(asAdmin())
            .send({ employeeId: staffEmployeeId, leaveType: "annual", startDate: "2026-12-10T00:00:00.000Z", endDate: "2026-12-10T00:00:00.000Z", reason: "Viec rieng cua staff" })
            .expect(201);

        await request(ctx.app)
            .post("/api/v1/attendance/leave-requests").set(asAdmin())
            .send({ employeeId: outsiderEmployeeId, leaveType: "annual", startDate: "2026-12-11T00:00:00.000Z", endDate: "2026-12-11T00:00:00.000Z", reason: "Ly do rieng cua nguoi ngoai" })
            .expect(201);
    });

    afterAll(async () => {
        await ctx?.dispose();
    });

    it("1. admin: phạm vi all, có tổng nhân sự và nhật ký", async () => {
        const response = await request(ctx.app).get("/api/v1/dashboard/overview").set(asAdmin()).expect(200);

        expect(response.body.scope).toBe("all");
        expect(response.body.timezone).toBeTypeOf("string");
        // 4 nhân viên đã tạo; 2 người có hợp đồng active nên mới tính là "đang làm việc"
        // (HR/manager chưa có hợp đồng -> vẫn `onboarding`).
        expect(response.body.headcount.total).toBe(4);
        expect(response.body.headcount.active).toBe(2);
        expect(response.body.headcount.byDepartment).toEqual([{ departmentId: expect.any(String), name: "Engineering", count: 2 }]);
        expect(response.body.auditActivity).not.toBeNull();
        expect(response.body.attendanceTrend.last7Days).toHaveLength(7);
        expect(response.body.attendanceTrend.last30Days).toHaveLength(30);
    });

    it("2. HR: phạm vi all, thấy cả hai đơn chờ duyệt, KHÔNG có lý do nghỉ", async () => {
        const response = await request(ctx.app).get("/api/v1/dashboard/overview").set(asHr()).expect(200);

        expect(response.body.scope).toBe("all");
        expect(response.body.pendingApprovals.leaveRequests).toBe(2);

        const payload = JSON.stringify(response.body);
        expect(payload).not.toContain("Viec rieng cua staff");
        expect(payload).not.toContain("Ly do rieng cua nguoi ngoai");
        // HR có `payroll:prepare` nhưng chưa có kỳ lương nào -> null, không phải số 0.
        expect(response.body.payroll).toBeNull();
    });

    it("3. manager: phạm vi team — KHÔNG thấy người ngoài nhóm", async () => {
        const response = await request(ctx.app).get("/api/v1/dashboard/overview").set(asManager()).expect(200);

        expect(response.body.scope).toBe("team");
        // Chính mình + staff = 2 người; người ngoài nhóm không được tính.
        expect(response.body.headcount.total).toBe(2);

        const payload = JSON.stringify(response.body);
        expect(payload).not.toContain(outsiderEmployeeId);
        expect(payload).not.toContain("Nguoi Ngoai Nhom");
        expect(payload).not.toContain("EMP-002");

        // Chỉ đơn của cấp dưới nằm trong hàng chờ.
        expect(response.body.pendingApprovals.leaveRequests).toBe(1);
        expect(response.body.pendingApprovals.leaveItems[0].employeeId).toBe(staffEmployeeId);
    });

    it("4. manager: KHÔNG có tổng lương và KHÔNG có nhật ký audit", async () => {
        const response = await request(ctx.app).get("/api/v1/dashboard/overview").set(asManager()).expect(200);

        expect(response.body.payroll).toBeNull();
        expect(response.body.auditActivity).toBeNull();
        // Phần đánh giá chỉ là SỐ phiếu phải chấm.
        expect(response.body.performance == null || "reviewsToScore" in response.body.performance).toBe(true);
    });

    it("5. nhân viên: chỉ dữ liệu của chính mình", async () => {
        const response = await request(ctx.app).get("/api/v1/dashboard/overview").set(asStaff()).expect(200);

        expect(response.body.scope).toBe("self");
        expect(response.body.headcount).toBeNull();
        expect(response.body.pendingApprovals).toBeNull();
        expect(response.body.payroll).toBeNull();
        expect(response.body.auditActivity).toBeNull();

        const payload = JSON.stringify(response.body);
        expect(payload).not.toContain(outsiderEmployeeId);
        expect(payload).not.toContain(managerEmployeeId);
        expect(payload).not.toContain("Quan Ly");
    });

    it("6. nhân viên: chấm công hôm nay là của CHÍNH họ, không phải của cả công ty", async () => {
        const [staffView, hrView] = await Promise.all([
            request(ctx.app).get("/api/v1/dashboard/overview").set(asStaff()).expect(200),
            request(ctx.app).get("/api/v1/dashboard/overview").set(asHr()).expect(200),
        ]);

        const staffToday = staffView.body.attendanceToday;
        const hrToday    = hrView.body.attendanceToday;

        // HR thấy cả hai người có bản ghi; nhân viên chỉ thấy phần của mình.
        expect(hrToday.present + hrToday.late).toBeGreaterThanOrEqual(staffToday.present + staffToday.late);
        expect(staffToday.present + staffToday.late).toBeLessThanOrEqual(1);
    });

    it("7. tài khoản KHÔNG có khoá dashboard:read nào -> 403 ACCESS_DENIED", async () => {
        // Dựng một account không gắn nhân viên và thu hồi role mặc định `employee`.
        await request(ctx.app)
            .post("/api/v1/auth/accounts").set(asAdmin())
            .send({ email: "khong-quyen@soosky.test", fullName: "Khong Quyen" }).expect(201);

        const mail = ctx.sentMails.at(-1);
        if (mail == undefined) throw new Error("khong bat duoc mail kich hoat");

        await request(ctx.app).post("/api/v1/auth/accounts/verification").send({ token: mail.verificationToken }).expect(200);

        const accounts = await request(ctx.app).get("/api/v1/auth/accounts").set(asAdmin()).expect(200);
        const account  = accounts.body.accounts.find((row: { email: string }) => row.email === mail.recipient);

        const userRoles = await request(ctx.app).get(`/api/v1/iam/users/${account.id}/roles`).set(asAdmin()).expect(200);
        for (const userRole of userRoles.body.userRoles) {
            await request(ctx.app)
                .delete(`/api/v1/iam/users/${account.id}/roles/${userRole.roleId}`).set(asAdmin())
                .expect(204);
        }

        const firstLogin = await request(ctx.app)
            .post("/api/v1/auth/sessions").send({ email: mail.recipient, password: mail.temporaryPassword }).expect(200);

        await request(ctx.app)
            .put("/api/v1/auth/me/password")
            .set({ Authorization: `Bearer ${firstLogin.body.accessToken}` })
            .send({ currentPassword: mail.temporaryPassword, newPassword: "NoRole#2026" })
            .expect(200);

        const login = await request(ctx.app)
            .post("/api/v1/auth/sessions").send({ email: mail.recipient, password: "NoRole#2026" }).expect(200);

        const denied = await request(ctx.app)
            .get("/api/v1/dashboard/overview")
            .set({ Authorization: `Bearer ${login.body.accessToken}` })
            .expect(403);

        expect(denied.body.code).toBe("ACCESS_DENIED");
    });
});
