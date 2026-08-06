import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import createTestApp, { TestApp } from "./support/testApp";

/**
 * SMOKE TEST luồng đưa nhân viên vào hệ thống + phân quyền thực tế:
 *
 *   HR tạo phòng ban/vị trí → tạo nhân viên (manager + 2 nhân viên) →
 *   nhập thêm nhân viên bằng CSV (preview → commit) →
 *   cấp account cho nhân viên → nhận mail (mật khẩu tạm + link kích hoạt) →
 *   kích hoạt → đăng nhập → BỊ CHẶN tới khi đổi mật khẩu → đổi mật khẩu →
 *   đăng nhập lại → chỉ xem được hồ sơ CỦA CHÍNH MÌNH.
 *
 * Kèm hai chốt bảo mật quan trọng nhất, kiểm bằng HTTP thật để chắc chắn
 * BACKEND enforce chứ không phải giao diện ẩn nút:
 *   - Employee không đọc được hồ sơ người khác (403).
 *   - Manager chỉ đọc được cấp dưới của mình.
 */
describe("HR onboarding + RBAC smoke", () => {
    let ctx: TestApp;

    let hrToken:       string;
    let departmentId:  string;
    let positionId:    string;
    let managerId:     string;
    let staffId:       string;
    let otherStaffId:  string;
    let staffToken:    string;
    let managerToken:  string;

    const asHr      = () => ({ Authorization: `Bearer ${hrToken}` });
    const asStaff   = () => ({ Authorization: `Bearer ${staffToken}` });
    const asManager = () => ({ Authorization: `Bearer ${managerToken}` });

    beforeAll(async () => {
        ctx = await createTestApp();

        const login = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: ctx.superAdmin.email, password: ctx.superAdmin.password })
            .expect(200);
        hrToken = login.body.accessToken;

        // Super admin tự đặt mật khẩu ở CLI → không bị buộc đổi.
        expect(login.body.mustChangePassword).toBe(false);
    });

    afterAll(async () => {
        await ctx?.dispose();
    });

    it("1. dựng master data: phòng ban + vị trí", async () => {
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

    it("2. tạo manager + 2 nhân viên, gán quản lý trực tiếp", async () => {
        const manager = await request(ctx.app)
            .post("/api/v1/employee/employees")
            .set(asHr())
            .send({
                code: "EMP-MGR", name: "Truong Nhom", email: "mgr@soosky.test",
                departmentId, positionId, hireDate: "2026-01-05T00:00:00.000Z", employeeType: "full_time",
            })
            .expect(201);
        managerId = manager.body.employeeId;

        const staff = await request(ctx.app)
            .post("/api/v1/employee/employees")
            .set(asHr())
            .send({
                code: "EMP-001", name: "Nhan Vien Mot", email: "nv1@soosky.test",
                departmentId, positionId, managerId, hireDate: "2026-01-06T00:00:00.000Z", employeeType: "full_time",
            })
            .expect(201);
        staffId = staff.body.employeeId;

        // Nhân viên KHÔNG thuộc nhóm của manager — dùng để chứng minh phạm vi team.
        const other = await request(ctx.app)
            .post("/api/v1/employee/employees")
            .set(asHr())
            .send({
                code: "EMP-002", name: "Nhan Vien Hai",
                departmentId, positionId, hireDate: "2026-01-06T00:00:00.000Z", employeeType: "full_time",
            })
            .expect(201);
        otherStaffId = other.body.employeeId;
    });

    it("3. chặn gán quản lý tạo vòng trong chuỗi báo cáo", async () => {
        // manager đang là cấp trên của staff → không cho staff làm quản lý của manager.
        const res = await request(ctx.app)
            .patch(`/api/v1/employee/employees/${managerId}`)
            .set(asHr())
            .send({ managerId: staffId })
            .expect(409);

        expect(res.body.code).toBe("MANAGER_CYCLE");
    });

    it("4. hồ sơ đính kèm: hợp đồng, ngân hàng, tài liệu, tài sản", async () => {
        await request(ctx.app)
            .post(`/api/v1/employee/employees/${staffId}/contracts`)
            .set(asHr())
            .send({
                contractType: "indefinite", employmentStatus: "official", contractNumber: "HD-001",
                startDate: "2026-01-06T00:00:00.000Z", baseSalary: 20_000_000, status: "active",
            })
            .expect(201);

        // Hợp đồng active thứ hai chồng khoảng thời gian → bị chặn.
        const overlap = await request(ctx.app)
            .post(`/api/v1/employee/employees/${staffId}/contracts`)
            .set(asHr())
            .send({
                contractType: "fixed_term", employmentStatus: "official", contractNumber: "HD-002",
                startDate: "2026-06-01T00:00:00.000Z", baseSalary: 25_000_000, status: "active",
            })
            .expect(409);
        expect(overlap.body.code).toBe("EMPLOYEE_CONTRACT_OVERLAP");

        await request(ctx.app)
            .post(`/api/v1/employee/employees/${staffId}/bank-accounts`)
            .set(asHr())
            .send({ bankName: "Vietcombank", accountNumber: "0011001", accountHolder: "NHAN VIEN MOT", isPrimary: true })
            .expect(201);

        // Đặt tài khoản thứ hai làm chính → tài khoản đầu tự mất cờ "chính".
        await request(ctx.app)
            .post(`/api/v1/employee/employees/${staffId}/bank-accounts`)
            .set(asHr())
            .send({ bankName: "Techcombank", accountNumber: "0022002", accountHolder: "NHAN VIEN MOT", isPrimary: true })
            .expect(201);

        const banks = await request(ctx.app)
            .get(`/api/v1/employee/employees/${staffId}/bank-accounts`)
            .set(asHr())
            .expect(200);
        expect(banks.body.bankAccounts.filter((b: { isPrimary: boolean }) => b.isPrimary)).toHaveLength(1);

        await request(ctx.app)
            .post(`/api/v1/employee/employees/${staffId}/documents`)
            .set(asHr())
            .send({ documentType: "id_card", documentNumber: "0790123456", issuedDate: "2020-05-01T00:00:00.000Z" })
            .expect(201);

        await request(ctx.app)
            .post(`/api/v1/employee/employees/${staffId}/assets`)
            .set(asHr())
            .send({ assetName: "Laptop Dell 5540", assetCode: "IT-LAP-001", assignedDate: "2026-01-06T00:00:00.000Z" })
            .expect(201);
    });

    it("5. nhập CSV: preview báo lỗi theo dòng, commit chỉ ghi dòng hợp lệ", async () => {
        const csv = [
            "code,name,email,departmentCode,positionCode,managerCode,hireDate,employeeType",
            "EMP-003,Nhan Vien Ba,nv3@soosky.test,ENG,BE-DEV,EMP-MGR,2026-02-01,full_time",
            "EMP-001,Trung Ma,,ENG,BE-DEV,,2026-02-01,full_time",          // trùng mã đã có
            "EMP-004,Sai Phong Ban,,SALES,BE-DEV,,2026-02-01,full_time",   // phòng ban không tồn tại
            "EMP-005,Sai Ngay,,ENG,BE-DEV,,01/02/2026,full_time",          // ngày sai định dạng
        ].join("\n");

        const preview = await request(ctx.app)
            .post("/api/v1/employee/imports/preview")
            .set(asHr())
            .send({ csv })
            .expect(200);

        expect(preview.body.summary).toEqual({ total: 4, ok: 1, error: 3 });
        expect(preview.body.rows[1].line).toBe(3);
        expect(preview.body.rows[1].errors[0]).toContain("đã tồn tại");

        // Sửa file rồi commit bằng checksum cũ → bị từ chối.
        const stale = await request(ctx.app)
            .post("/api/v1/employee/imports/commit")
            .set(asHr())
            .send({ csv: `${csv}\nEMP-006,Them Dong,,ENG,BE-DEV,,2026-02-01,full_time`, checksum: preview.body.checksum })
            .expect(409);
        expect(stale.body.code).toBe("EMPLOYEE_IMPORT_CHECKSUM_MISMATCH");

        const commit = await request(ctx.app)
            .post("/api/v1/employee/imports/commit")
            .set(asHr())
            .send({ csv, checksum: preview.body.checksum })
            .expect(200);

        expect(commit.body.created).toBe(1);
        expect(commit.body.skipped).toBe(3);

        // Nhập lại đúng file đó: không tạo thêm bản ghi nào (chống trùng).
        const again = await request(ctx.app)
            .post("/api/v1/employee/imports/commit")
            .set(asHr())
            .send({ csv, checksum: preview.body.checksum })
            .expect(200);
        expect(again.body.created).toBe(0);
    });

    it("6. cấp account cho nhân viên → mail mang mật khẩu tạm + token kích hoạt", async () => {
        const before = ctx.sentMails.length;

        const granted = await request(ctx.app)
            .post(`/api/v1/employee/employees/${staffId}/grant-login`)
            .set(asHr())
            .expect(201);

        expect(granted.body.credentialsSentTo).toBe("nv1@soosky.test");
        expect(ctx.sentMails).toHaveLength(before + 1);

        // Cấp lần hai bị chặn — tránh âm thầm cho hai người vào cùng một hồ sơ.
        const twice = await request(ctx.app)
            .post(`/api/v1/employee/employees/${staffId}/grant-login`)
            .set(asHr())
            .expect(409);
        expect(twice.body.code).toBe("EMPLOYEE_ALREADY_HAS_ACCOUNT");
    });

    it("7. nhân viên kích hoạt, đăng nhập, BỊ CHẶN tới khi đổi mật khẩu", async () => {
        const mail = ctx.sentMails.at(-1);
        if (mail == undefined) throw new Error("khong bat duoc mail kich hoat");

        await request(ctx.app)
            .post("/api/v1/auth/accounts/verification")
            .send({ token: mail.verificationToken })
            .expect(200);

        const firstLogin = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: mail.recipient, password: mail.temporaryPassword })
            .expect(200);

        expect(firstLogin.body.mustChangePassword).toBe(true);
        const tempToken = { Authorization: `Bearer ${firstLogin.body.accessToken}` };

        // Mọi endpoint khác bị chặn...
        const blocked = await request(ctx.app)
            .get("/api/v1/employee/employees")
            .set(tempToken)
            .expect(403);
        expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");

        // ...trừ nhóm cần thiết để tự thoát ra.
        await request(ctx.app).get("/api/v1/auth/me").set(tempToken).expect(200);

        await request(ctx.app)
            .put("/api/v1/auth/me/password")
            .set(tempToken)
            .send({ currentPassword: mail.temporaryPassword, newPassword: "NhanVien#2026" })
            .expect(200);

        const secondLogin = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: mail.recipient, password: "NhanVien#2026" })
            .expect(200);

        expect(secondLogin.body.mustChangePassword).toBe(false);
        staffToken = secondLogin.body.accessToken;
    });

    it("8. Employee chỉ đọc được hồ sơ của chính mình (backend enforce)", async () => {
        const list = await request(ctx.app)
            .get("/api/v1/employee/employees")
            .set(asStaff())
            .expect(200);

        expect(list.body.employees).toHaveLength(1);
        expect(list.body.employees[0].id).toBe(staffId);

        await request(ctx.app).get(`/api/v1/employee/employees/${staffId}`).set(asStaff()).expect(200);
        await request(ctx.app).get(`/api/v1/employee/employees/${otherStaffId}`).set(asStaff()).expect(403);

        // Kể cả dữ liệu nhạy cảm nhất cũng theo đúng phạm vi.
        await request(ctx.app).get(`/api/v1/employee/employees/${staffId}/contracts`).set(asStaff()).expect(200);
        await request(ctx.app).get(`/api/v1/employee/employees/${otherStaffId}/contracts`).set(asStaff()).expect(403);

        // Employee KHÔNG được tạo/sửa hồ sơ.
        await request(ctx.app)
            .post("/api/v1/employee/employees")
            .set(asStaff())
            .send({
                code: "EMP-HACK", name: "Tu Tao", departmentId, positionId,
                hireDate: "2026-03-01T00:00:00.000Z", employeeType: "full_time",
            })
            .expect(403);
    });

    it("9. Manager đọc được cấp dưới, không đọc được người ngoài nhóm", async () => {
        // Cấp account cho manager rồi nâng role lên `manager`.
        await request(ctx.app)
            .post(`/api/v1/employee/employees/${managerId}/grant-login`)
            .set(asHr())
            .expect(201);

        const mail = ctx.sentMails.at(-1);
        if (mail == undefined) throw new Error("khong bat duoc mail kich hoat");

        await request(ctx.app).post("/api/v1/auth/accounts/verification").send({ token: mail.verificationToken }).expect(200);

        const roles = await request(ctx.app).get("/api/v1/iam/roles").set(asHr()).expect(200);
        const managerRole = roles.body.roles.find((role: { key: string }) => role.key === "manager");
        expect(managerRole).toBeDefined();

        const accounts = await request(ctx.app).get("/api/v1/auth/accounts").set(asHr()).expect(200);
        const managerAccount = accounts.body.accounts.find((a: { email: string }) => a.email === "mgr@soosky.test");

        await request(ctx.app)
            .post(`/api/v1/iam/users/${managerAccount.id}/roles`)
            .set(asHr())
            .send({ roleId: managerRole.id })
            .expect(201);

        const firstLogin = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: mail.recipient, password: mail.temporaryPassword })
            .expect(200);

        await request(ctx.app)
            .put("/api/v1/auth/me/password")
            .set({ Authorization: `Bearer ${firstLogin.body.accessToken}` })
            .send({ currentPassword: mail.temporaryPassword, newPassword: "Manager#2026" })
            .expect(200);

        const login = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: mail.recipient, password: "Manager#2026" })
            .expect(200);
        managerToken = login.body.accessToken;

        const list = await request(ctx.app).get("/api/v1/employee/employees").set(asManager()).expect(200);
        const visibleIds = list.body.employees.map((e: { id: string }) => e.id);

        expect(visibleIds).toContain(managerId);
        expect(visibleIds).toContain(staffId);      // cấp dưới trực tiếp
        expect(visibleIds).not.toContain(otherStaffId);

        await request(ctx.app).get(`/api/v1/employee/employees/${staffId}`).set(asManager()).expect(200);
        await request(ctx.app).get(`/api/v1/employee/employees/${otherStaffId}`).set(asManager()).expect(403);
    });

    it("10. nhật ký audit ghi lại các thay đổi nhạy cảm", async () => {
        const res = await request(ctx.app)
            .get("/api/v1/iam/audit-logs")
            .set(asHr())
            .expect(200);

        const logs = res.body.auditLogs ?? res.body.logs ?? res.body.items;
        const keyOf = (log: { resource: string; action: string }) => `${log.resource}:${log.action}`;
        const recorded = new Set<string>(logs.map(keyOf));

        expect(recorded).toContain("employee_contract:create");
        expect(recorded).toContain("employee_bank_account:create");
        expect(recorded).toContain("employee_document:create");
        expect(recorded).toContain("employee_account:grant_login");
        expect(recorded).toContain("employee:import");

        // Nhật ký phải nêu rõ ai làm — không có dòng "không biết ai".
        expect(logs.every((log: { actorUserId: string | null }) => log.actorUserId != null)).toBe(true);
    });

    it("11. HR nạp hạn mức phép cho nhân viên", async () => {
        for (const employeeId of [staffId, otherStaffId]) {
            await request(ctx.app)
                .post("/api/v1/attendance/leave-balances")
                .set(asHr())
                .send({ employeeId, leaveType: "annual", year: 2026, entitled: 12 })
                .expect(200);
        }

        // Nhân viên tự tra được số dư của mình...
        const own = await request(ctx.app)
            .get("/api/v1/attendance/leave-balances")
            .query({ employeeId: staffId, year: 2026 })
            .set(asStaff())
            .expect(200);
        expect(own.body.balances[0].entitled).toBe(12);

        // ...nhưng không tra được của người khác.
        await request(ctx.app)
            .get("/api/v1/attendance/leave-balances")
            .query({ employeeId: otherStaffId, year: 2026 })
            .set(asStaff())
            .expect(403);
    });

    it("12. nhân viên TỰ nộp đơn nghỉ (không cần truyền employeeId)", async () => {
        const submitted = await request(ctx.app)
            .post("/api/v1/attendance/leave-requests")
            .set(asStaff())
            .send({ leaveType: "annual", startDate: "2026-05-04T00:00:00.000Z", endDate: "2026-05-05T00:00:00.000Z", reason: "Viec gia dinh" })
            .expect(201);

        const leaveRequestId = submitted.body.leaveRequestId;

        // Đơn phải thuộc đúng nhân viên suy ra từ token, không phải ai khác.
        const detail = await request(ctx.app)
            .get(`/api/v1/attendance/leave-requests/${leaveRequestId}`)
            .set(asStaff())
            .expect(200);
        expect(detail.body.employeeId).toBe(staffId);
        expect(detail.body.status).toBe("pending");

        // Nhân viên chỉ thấy đơn của chính mình.
        const list = await request(ctx.app).get("/api/v1/attendance/leave-requests").set(asStaff()).expect(200);
        expect(list.body.leaveRequests.every((r: { employeeId: string }) => r.employeeId === staffId)).toBe(true);

        // Không nộp thay người khác, không xem đơn người khác.
        await request(ctx.app)
            .post("/api/v1/attendance/leave-requests")
            .set(asStaff())
            .send({ employeeId: otherStaffId, leaveType: "annual", startDate: "2026-05-11T00:00:00.000Z", endDate: "2026-05-11T00:00:00.000Z" })
            .expect(403);

        await request(ctx.app)
            .get("/api/v1/attendance/leave-requests")
            .query({ employeeId: otherStaffId })
            .set(asStaff())
            .expect(403);

        // Nhân viên KHÔNG tự duyệt đơn của mình.
        await request(ctx.app)
            .post(`/api/v1/attendance/leave-requests/${leaveRequestId}/approve`)
            .set(asStaff())
            .expect(403);

        // Nhưng tự huỷ được đơn của mình.
        await request(ctx.app)
            .post(`/api/v1/attendance/leave-requests/${leaveRequestId}/cancel`)
            .set(asStaff())
            .send({ reason: "Doi ke hoach" })
            .expect(200);
    });

    it("13. HR nộp thay, Manager duyệt trong nhóm mình", async () => {
        const submitted = await request(ctx.app)
            .post("/api/v1/attendance/leave-requests")
            .set(asHr())
            .send({ employeeId: staffId, leaveType: "annual", startDate: "2026-05-11T00:00:00.000Z", endDate: "2026-05-12T00:00:00.000Z" })
            .expect(201);

        // Manager thấy và duyệt được đơn của cấp dưới.
        const teamList = await request(ctx.app).get("/api/v1/attendance/leave-requests").set(asManager()).expect(200);
        expect(teamList.body.leaveRequests.map((r: { id: string }) => r.id)).toContain(submitted.body.leaveRequestId);

        await request(ctx.app)
            .post(`/api/v1/attendance/leave-requests/${submitted.body.leaveRequestId}/approve`)
            .set(asManager())
            .expect(200);

        // Đơn của người ngoài nhóm: Manager không duyệt được.
        const outsiderRequest = await request(ctx.app)
            .post("/api/v1/attendance/leave-requests")
            .set(asHr())
            .send({ employeeId: otherStaffId, leaveType: "annual", startDate: "2026-05-11T00:00:00.000Z", endDate: "2026-05-11T00:00:00.000Z" })
            .expect(201);

        await request(ctx.app)
            .post(`/api/v1/attendance/leave-requests/${outsiderRequest.body.leaveRequestId}/approve`)
            .set(asManager())
            .expect(403);

        // Chấm công vẫn thuần HR: nhân viên và manager đều không chạm được.
        for (const token of [asStaff(), asManager()]) {
            await request(ctx.app)
                .post("/api/v1/attendance/records")
                .set(token)
                .send({ employeeId: staffId, date: "2026-05-18T00:00:00.000Z" })
                .expect(403);
        }
    });
});
