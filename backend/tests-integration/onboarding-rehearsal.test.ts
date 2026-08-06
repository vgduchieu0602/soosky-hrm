import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import createTestApp, { TestApp } from "./support/testApp";

/**
 * DIỄN TẬP nghiệm thu: onboard 20 nhân viên mẫu bằng CSV, cấp tài khoản cho một
 * người, người đó tự kích hoạt và chỉ chạm được vào đúng dữ liệu được phép.
 *
 * Khác các file smoke test còn lại ở chỗ đây là bài chạy theo khối lượng thật
 * (20 dòng, không phải 1-2 dòng mẫu) và liệt kê tường minh MỌI thao tác nhân
 * viên KHÔNG được làm — phần dễ bị bỏ sót khi chỉ kiểm đường đi thuận lợi.
 */
describe("Diễn tập onboarding 20 nhân viên + tự phục vụ", () => {
    let ctx: TestApp;

    let hrToken:      string;
    let staffToken:   string;
    let departmentId: string;
    let positionId:   string;

    /** Mã nhân viên trong file CSV mẫu. */
    const CODES = Array.from({ length: 20 }, (_, index) => `EMP-${String(index + 1).padStart(3, "0")}`);

    const asHr    = () => ({ Authorization: `Bearer ${hrToken}` });
    const asStaff = () => ({ Authorization: `Bearer ${staffToken}` });

    /** Nhân viên được cấp tài khoản (người đầu tiên trong file) và một người khác để thử vượt rào. */
    let selfServiceEmployeeId: string;
    let otherEmployeeId:       string;

    beforeAll(async () => {
        ctx = await createTestApp();

        const login = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: ctx.superAdmin.email, password: ctx.superAdmin.password })
            .expect(200);
        hrToken = login.body.accessToken;

        const department = await request(ctx.app)
            .post("/api/v1/department/departments")
            .set(asHr())
            .send({ code: "ENG", name: "Engineering" })
            .expect(201);
        departmentId = department.body.departmentId;

        const position = await request(ctx.app)
            .post("/api/v1/department/positions")
            .set(asHr())
            .send({ code: "BE-DEV", title: "Backend Developer", departmentId })
            .expect(201);
        positionId = position.body.positionId;
    });

    afterAll(async () => {
        await ctx?.dispose();
    });

    it("1. nhập 20 nhân viên từ CSV: preview sạch lỗi rồi commit đủ 20", async () => {
        const csv = [
            "code,name,email,phone,dob,gender,departmentCode,positionCode,managerCode,hireDate,employeeType",
            ...CODES.map((code, index) =>
                [
                    code,
                    `Nhan Vien ${String(index + 1).padStart(2, "0")}`,
                    `nv${index + 1}@soosky.test`,
                    `09000000${String(index + 1).padStart(2, "0")}`,
                    "1996-04-15",
                    index % 2 === 0 ? "male" : "female",
                    "ENG",
                    "BE-DEV",
                    "",                       // quản lý gán sau, tránh phụ thuộc thứ tự trong file
                    "2026-03-02",
                    "full_time",
                ].join(","),
            ),
        ].join("\n");

        const preview = await request(ctx.app)
            .post("/api/v1/employee/imports/preview")
            .set(asHr())
            .send({ csv })
            .expect(200);

        expect(preview.body.summary).toEqual({ total: 20, ok: 20, error: 0 });

        const commit = await request(ctx.app)
            .post("/api/v1/employee/imports/commit")
            .set(asHr())
            .send({ csv, checksum: preview.body.checksum })
            .expect(200);

        expect(commit.body).toMatchObject({ created: 20, skipped: 0 });

        const list = await request(ctx.app).get("/api/v1/employee/employees").set(asHr()).expect(200);
        expect(list.body.employees).toHaveLength(20);

        const byCode = new Map<string, string>(list.body.employees.map((e: { code: string; id: string }) => [e.code, e.id]));
        selfServiceEmployeeId = byCode.get("EMP-001") as string;
        otherEmployeeId       = byCode.get("EMP-002") as string;

        // Nhập lại đúng file: không tạo thêm bản ghi nào.
        const again = await request(ctx.app)
            .post("/api/v1/employee/imports/commit")
            .set(asHr())
            .send({ csv, checksum: preview.body.checksum })
            .expect(200);
        expect(again.body).toMatchObject({ created: 0, skipped: 20 });
    });

    it("2. HR hoàn tất hồ sơ để nhân viên vào biên chế", async () => {
        await request(ctx.app)
            .post(`/api/v1/employee/employees/${selfServiceEmployeeId}/contracts`)
            .set(asHr())
            .send({
                contractType: "indefinite", employmentStatus: "official", contractNumber: "HD-001",
                startDate: "2026-03-02T00:00:00.000Z", baseSalary: 18_000_000, status: "active",
            })
            .expect(201);

        const detail = await request(ctx.app)
            .get(`/api/v1/employee/employees/${selfServiceEmployeeId}`)
            .set(asHr())
            .expect(200);
        expect(detail.body.status).toBe("active");

        await request(ctx.app)
            .post("/api/v1/attendance/leave-balances")
            .set(asHr())
            .send({ employeeId: selfServiceEmployeeId, leaveType: "annual", year: 2026, entitled: 12 })
            .expect(200);
    });

    it("3. nhân viên TỰ kích hoạt tài khoản và tự đổi mật khẩu", async () => {
        const granted = await request(ctx.app)
            .post(`/api/v1/employee/employees/${selfServiceEmployeeId}/grant-login`)
            .set(asHr())
            .expect(201);
        expect(granted.body.credentialsSentTo).toBe("nv1@soosky.test");

        const mail = ctx.sentMails.at(-1);
        if (mail == undefined) throw new Error("khong bat duoc mail kich hoat");

        // Chưa kích hoạt thì chưa đăng nhập được.
        await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: mail.recipient, password: mail.temporaryPassword })
            .expect(403);

        await request(ctx.app)
            .post("/api/v1/auth/accounts/verification")
            .send({ token: mail.verificationToken })
            .expect(200);

        const first = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: mail.recipient, password: mail.temporaryPassword })
            .expect(200);
        expect(first.body.mustChangePassword).toBe(true);

        const tempToken = { Authorization: `Bearer ${first.body.accessToken}` };
        const blocked = await request(ctx.app).get("/api/v1/employee/employees").set(tempToken).expect(403);
        expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");

        await request(ctx.app)
            .put("/api/v1/auth/me/password")
            .set(tempToken)
            .send({ currentPassword: mail.temporaryPassword, newPassword: "NhanVien#2026" })
            .expect(200);

        const second = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: mail.recipient, password: "NhanVien#2026" })
            .expect(200);
        expect(second.body.mustChangePassword).toBe(false);
        staffToken = second.body.accessToken;
    });

    it("4. nhân viên XEM được đúng phần của mình", async () => {
        const list = await request(ctx.app).get("/api/v1/employee/employees").set(asStaff()).expect(200);
        expect(list.body.employees).toHaveLength(1);
        expect(list.body.employees[0].id).toBe(selfServiceEmployeeId);

        await request(ctx.app).get("/api/v1/auth/me").set(asStaff()).expect(200);
        await request(ctx.app).get(`/api/v1/employee/employees/${selfServiceEmployeeId}`).set(asStaff()).expect(200);
        await request(ctx.app).get(`/api/v1/employee/employees/${selfServiceEmployeeId}/contracts`).set(asStaff()).expect(200);
        await request(ctx.app).get(`/api/v1/employee/employees/${selfServiceEmployeeId}/documents`).set(asStaff()).expect(200);
        await request(ctx.app).get("/api/v1/payroll/payrolls/me").set(asStaff()).expect(200);
        await request(ctx.app)
            .get("/api/v1/attendance/leave-balances")
            .query({ year: 2026 })
            .set(asStaff())
            .expect(200);
    });

    it("5. nhân viên SỬA được đúng phần của mình: mật khẩu, hồ sơ tài khoản, đơn nghỉ", async () => {
        await request(ctx.app)
            .patch("/api/v1/auth/me/profile")
            .set(asStaff())
            .send({ email: "nv1@soosky.test", fullName: "Nhan Vien Mot" })
            .expect(200);

        const submitted = await request(ctx.app)
            .post("/api/v1/attendance/leave-requests")
            .set(asStaff())
            .send({ leaveType: "annual", startDate: "2026-06-01T00:00:00.000Z", endDate: "2026-06-02T00:00:00.000Z", reason: "Viec rieng" })
            .expect(201);

        await request(ctx.app)
            .post(`/api/v1/attendance/leave-requests/${submitted.body.leaveRequestId}/cancel`)
            .set(asStaff())
            .send({ reason: "Doi ke hoach" })
            .expect(200);
    });

    it("6. nhân viên KHÔNG chạm được vào phần không được phép", async () => {
        const forbidden: [string, () => request.Test][] = [
            ["xem hồ sơ người khác",        () => request(ctx.app).get(`/api/v1/employee/employees/${otherEmployeeId}`).set(asStaff())],
            ["xem hợp đồng người khác",     () => request(ctx.app).get(`/api/v1/employee/employees/${otherEmployeeId}/contracts`).set(asStaff())],
            ["xem số dư phép người khác",   () => request(ctx.app).get("/api/v1/attendance/leave-balances").query({ employeeId: otherEmployeeId, year: 2026 }).set(asStaff())],
            ["xem đơn nghỉ người khác",     () => request(ctx.app).get("/api/v1/attendance/leave-requests").query({ employeeId: otherEmployeeId }).set(asStaff())],
            ["nộp đơn nghỉ thay người khác", () => request(ctx.app).post("/api/v1/attendance/leave-requests").set(asStaff())
                .send({ employeeId: otherEmployeeId, leaveType: "annual", startDate: "2026-06-08T00:00:00.000Z", endDate: "2026-06-08T00:00:00.000Z" })],
            ["tạo nhân viên",               () => request(ctx.app).post("/api/v1/employee/employees").set(asStaff())
                .send({ code: "EMP-999", name: "Tu Tao", departmentId, positionId, hireDate: "2026-06-01T00:00:00.000Z", employeeType: "full_time" })],
            ["sửa hồ sơ nhân sự của mình",  () => request(ctx.app).patch(`/api/v1/employee/employees/${selfServiceEmployeeId}`).set(asStaff()).send({ phone: "0900000999" })],
            ["tự tạo hợp đồng cho mình",    () => request(ctx.app).post(`/api/v1/employee/employees/${selfServiceEmployeeId}/contracts`).set(asStaff())
                .send({ contractType: "indefinite", employmentStatus: "official", contractNumber: "HD-999", startDate: "2026-07-01T00:00:00.000Z", baseSalary: 99_000_000 })],
            ["chấm công cho mình",          () => request(ctx.app).post("/api/v1/attendance/records").set(asStaff())
                .send({ employeeId: selfServiceEmployeeId, date: "2026-06-01T00:00:00.000Z" })],
            ["nạp hạn mức phép cho mình",   () => request(ctx.app).post("/api/v1/attendance/leave-balances").set(asStaff())
                .send({ employeeId: selfServiceEmployeeId, leaveType: "annual", year: 2026, entitled: 99 })],
            ["nhập CSV",                    () => request(ctx.app).post("/api/v1/employee/imports/preview").set(asStaff()).send({ csv: "code,name,departmentCode,positionCode,hireDate,employeeType" })],
            ["cấp tài khoản cho người khác", () => request(ctx.app).post(`/api/v1/employee/employees/${otherEmployeeId}/grant-login`).set(asStaff())],
            ["xem nhật ký audit",           () => request(ctx.app).get("/api/v1/iam/audit-logs").set(asStaff())],
            ["xem danh sách account",       () => request(ctx.app).get("/api/v1/auth/accounts").set(asStaff())],
            ["chạy bảng lương",             () => request(ctx.app).post("/api/v1/payroll/periods").set(asStaff())
                .send({ name: "2026-06", startDate: "2026-06-01T00:00:00.000Z", endDate: "2026-06-30T00:00:00.000Z", payDate: "2026-07-05T00:00:00.000Z" })],
            ["đổi phòng ban",               () => request(ctx.app).post("/api/v1/department/departments").set(asStaff()).send({ code: "HACK", name: "Hack" })],
        ];

        const results: string[] = [];
        for (const [label, call] of forbidden) {
            const res = await call();
            results.push(`${label}: ${res.status}`);
        }

        // Mọi thao tác trên phải bị chặn ở BACKEND, không phụ thuộc UI ẩn nút.
        expect(results.filter(line => !line.endsWith(": 403"))).toEqual([]);
    });

    it("7. HR vẫn làm được đầy đủ trên 20 nhân viên đó", async () => {
        const list = await request(ctx.app).get("/api/v1/employee/employees").set(asHr()).expect(200);
        expect(list.body.employees).toHaveLength(20);

        // Gán quản lý: EMP-002 báo cáo EMP-001.
        await request(ctx.app)
            .patch(`/api/v1/employee/employees/${otherEmployeeId}`)
            .set(asHr())
            .send({ managerId: selfServiceEmployeeId })
            .expect(200);

        const audit = await request(ctx.app).get("/api/v1/iam/audit-logs").set(asHr()).expect(200);
        const logs  = audit.body.auditLogs ?? audit.body.logs ?? audit.body.items;
        const keys  = new Set<string>(logs.map((log: { resource: string; action: string }) => `${log.resource}:${log.action}`));

        expect(keys).toContain("employee:import");
        expect(keys).toContain("employee_contract:create");
        expect(keys).toContain("employee_account:grant_login");
    });
});
