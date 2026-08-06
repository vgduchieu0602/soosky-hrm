import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import createTestApp, { TestApp } from "./support/testApp";

/**
 * File chuyển lương theo mẫu ngân hàng do Admin/HR tự cấu hình, trên MongoDB thật.
 *
 * Điều được kiểm: không hard-code ngân hàng nào — đổi cấu hình cột/dấu phân cách
 * là file đổi theo; và người LẬP lương không xuất được lệnh chi (bốn mắt tới cả
 * chỗ tiền ra khỏi công ty).
 */
describe("Bảng lương: file chuyển khoản theo cấu hình ngân hàng", () => {
    let ctx: TestApp;

    let hrToken:       string;
    let approverToken: string;
    let employeeId:    string;
    let employeeNoBankId: string;
    let periodId:      string;
    let profileId:     string;

    const asHr       = () => ({ Authorization: `Bearer ${hrToken}` });
    const asApprover = () => ({ Authorization: `Bearer ${approverToken}` });

    const BASE_SALARY = 20_000_000;

    const WORK_DAYS: string[] = (() => {
        const out: string[] = [];
        for (let day = 1; day <= 30; day += 1) {
            const date = new Date(Date.UTC(2026, 10, day));
            const weekday = date.getUTCDay();
            if (weekday === 0 || weekday === 6) continue;
            out.push(date.toISOString().slice(0, 10));
        }
        return out;
    })();

    async function createEmployee(code: string, email: string): Promise<string> {
        const department = await request(ctx.app)
            .get("/api/v1/department/departments").set(asHr()).expect(200);
        const departmentId = department.body.departments[0].id;
        const positions = await request(ctx.app)
            .get("/api/v1/department/positions").set(asHr()).expect(200);
        const positionId = positions.body.positions[0].id;

        const created = await request(ctx.app)
            .post("/api/v1/employee/employees").set(asHr())
            .send({ code, name: `Nhan Vien ${code}`, email,
                    departmentId, positionId, hireDate: "2026-08-01T00:00:00.000Z", employeeType: "full_time" })
            .expect(201);

        await request(ctx.app)
            .post(`/api/v1/employee/employees/${created.body.employeeId}/contracts`).set(asHr())
            .send({ contractType: "indefinite", employmentStatus: "official", contractNumber: `HD-${code}`,
                    startDate: "2026-08-01T00:00:00.000Z", baseSalary: BASE_SALARY, status: "active" })
            .expect(201);

        return created.body.employeeId;
    }

    beforeAll(async () => {
        ctx = await createTestApp();

        hrToken = (await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: ctx.superAdmin.email, password: ctx.superAdmin.password })
            .expect(200)).body.accessToken;

        const departmentId = (await request(ctx.app)
            .post("/api/v1/department/departments").set(asHr())
            .send({ code: "ENG", name: "Engineering" }).expect(201)).body.departmentId;

        await request(ctx.app)
            .post("/api/v1/department/positions").set(asHr())
            .send({ code: "BE-DEV", title: "Backend Developer", departmentId }).expect(201);

        employeeId       = await createEmployee("EMP-001", "nv1@soosky.test");
        employeeNoBankId = await createEmployee("EMP-002", "nv2@soosky.test");

        // Chỉ nhân viên 1 có tài khoản ngân hàng.
        await request(ctx.app)
            .post(`/api/v1/employee/employees/${employeeId}/bank-accounts`).set(asHr())
            .send({ bankName: "Vietcombank", branch: "Ha Noi", accountNumber: "1021000123456",
                    accountHolder: "NGUYEN VAN A", isPrimary: true })
            .expect(201);

        await request(ctx.app)
            .post("/api/v1/attendance/shifts").set(asHr())
            .send({ code: "HC", name: "Hanh chinh", startTime: "08:00", endTime: "17:00",
                    breakMinutes: 60, workingDays: [1, 2, 3, 4, 5] })
            .expect(201);

        await request(ctx.app)
            .post("/api/v1/payroll/policies").set(asHr())
            .send({ effectiveFrom: "2026-01-01T00:00:00.000Z", baseSalaryReference: BASE_SALARY,
                    regionalMinWage: 4_960_000, socialInsuranceSalary: BASE_SALARY })
            .expect(201);

        // Người duyệt riêng (bốn mắt).
        await request(ctx.app)
            .post("/api/v1/auth/accounts").set(asHr())
            .send({ email: "approver@soosky.test", fullName: "Ke Toan Truong" }).expect(201);

        const mail = ctx.sentMails.at(-1);
        if (mail == undefined) throw new Error("khong bat duoc mail kich hoat");

        await request(ctx.app).post("/api/v1/auth/accounts/verification").send({ token: mail.verificationToken }).expect(200);

        const firstLogin = await request(ctx.app)
            .post("/api/v1/auth/sessions").send({ email: mail.recipient, password: mail.temporaryPassword }).expect(200);

        await request(ctx.app)
            .put("/api/v1/auth/me/password")
            .set({ Authorization: `Bearer ${firstLogin.body.accessToken}` })
            .send({ currentPassword: mail.temporaryPassword, newPassword: "Approver#2026" })
            .expect(200);

        const roles     = await request(ctx.app).get("/api/v1/iam/roles").set(asHr()).expect(200);
        const adminRole = roles.body.roles.find((role: { key: string }) => role.key === "admin");
        const accounts  = await request(ctx.app).get("/api/v1/auth/accounts").set(asHr()).expect(200);
        const account   = accounts.body.accounts.find((a: { email: string }) => a.email === "approver@soosky.test");

        await request(ctx.app)
            .post(`/api/v1/iam/users/${account.id}/roles`).set(asHr())
            .send({ roleId: adminRole.id }).expect(201);

        approverToken = (await request(ctx.app)
            .post("/api/v1/auth/sessions").send({ email: mail.recipient, password: "Approver#2026" }).expect(200)).body.accessToken;

        for (const day of WORK_DAYS) {
            for (const id of [employeeId, employeeNoBankId]) {
                await request(ctx.app)
                    .post("/api/v1/attendance/records").set(asHr())
                    .send({ employeeId: id, date: `${day}T03:00:00.000Z`,
                            checkIn: `${day}T01:00:00.000Z`, checkOut: `${day}T10:00:00.000Z` })
                    .expect(200);
            }
        }

        periodId = (await request(ctx.app)
            .post("/api/v1/payroll/periods").set(asHr())
            .send({ name: "2026-11", startDate: "2026-11-01T00:00:00.000Z", endDate: "2026-11-30T00:00:00.000Z",
                    payDate: "2026-12-05T00:00:00.000Z", standardWorkDays: WORK_DAYS.length })
            .expect(201)).body.periodId;
    });

    afterAll(async () => {
        await ctx?.dispose();
    });

    it("1. chưa cấu hình ngân hàng: xuất file báo lỗi chỉ đúng chỗ cần làm", async () => {
        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/lock-attendance`).set(asHr()).expect(200);
        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/lock-evaluations`).set(asHr()).expect(200);

        const missing = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${periodId}/bank-file`).set(asApprover())
            .expect(409);
        expect(missing.body.code).toBe("PAYROLL_BANK_PROFILE_MISSING");
    });

    it("2. Admin cấu hình mẫu file của ngân hàng, kiểm tính hợp lệ của cột", async () => {
        // Thiếu cột số tiền -> file không dùng để chuyển khoản được.
        const invalid = await request(ctx.app)
            .post("/api/v1/setting/bank-profiles").set(asHr())
            .send({ code: "BAD", bankName: "Ngan hang X",
                    columns: [{ header: "STK", source: "bank_account_number" }] })
            .expect(422);
        expect(invalid.body.code).toBe("BANK_TRANSFER_PROFILE_INVALID");

        const created = await request(ctx.app)
            .post("/api/v1/setting/bank-profiles").set(asHr())
            .send({
                code: "vcb", bankName: "Vietcombank", delimiter: ",", includeHeader: true,
                amountFormat: "plain", dateFormat: "dd/MM/yyyy",
                columns: [
                    { header: "STT", source: "sequence" },
                    { header: "So tai khoan", source: "bank_account_number" },
                    { header: "Ten nguoi nhan", source: "bank_account_holder" },
                    { header: "So tien", source: "net_salary" },
                    { header: "Ngay chi", source: "pay_date" },
                    { header: "Noi dung", source: "static", staticValue: "Thanh toan luong" },
                ],
            })
            .expect(201);

        profileId = created.body.id;
        expect(created.body.code).toBe("VCB");
        // Hồ sơ mới KHÔNG tự bật — bật là hành động riêng.
        expect(created.body.isActive).toBe(false);

        const stillMissing = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${periodId}/bank-file`).set(asApprover())
            .expect(409);
        expect(stillMissing.body.code).toBe("PAYROLL_BANK_PROFILE_MISSING");

        const activated = await request(ctx.app)
            .post(`/api/v1/setting/bank-profiles/${profileId}/activate`).set(asHr())
            .expect(200);
        expect(activated.body.isActive).toBe(true);
    });

    it("3. người chỉ có payroll:prepare (role hr) KHÔNG xuất được lệnh chi", async () => {
        // File chuyển khoản là LỆNH CHI, nên khoá là `payroll:approve`. Role `hr`
        // chỉ có `prepare` -> bốn mắt còn hiệu lực tới đúng chỗ tiền ra khỏi công ty.
        await request(ctx.app)
            .post("/api/v1/auth/accounts").set(asHr())
            .send({ email: "preparer@soosky.test", fullName: "Nhan Vien Tinh Luong" }).expect(201);

        const mail = ctx.sentMails.at(-1);
        if (mail == undefined) throw new Error("khong bat duoc mail kich hoat");

        await request(ctx.app).post("/api/v1/auth/accounts/verification").send({ token: mail.verificationToken }).expect(200);

        const firstLogin = await request(ctx.app)
            .post("/api/v1/auth/sessions").send({ email: mail.recipient, password: mail.temporaryPassword }).expect(200);

        await request(ctx.app)
            .put("/api/v1/auth/me/password")
            .set({ Authorization: `Bearer ${firstLogin.body.accessToken}` })
            .send({ currentPassword: mail.temporaryPassword, newPassword: "Preparer#2026" })
            .expect(200);

        const roles    = await request(ctx.app).get("/api/v1/iam/roles").set(asHr()).expect(200);
        const hrRole   = roles.body.roles.find((role: { key: string }) => role.key === "hr");
        const accounts = await request(ctx.app).get("/api/v1/auth/accounts").set(asHr()).expect(200);
        const account  = accounts.body.accounts.find((a: { email: string }) => a.email === "preparer@soosky.test");

        await request(ctx.app)
            .post(`/api/v1/iam/users/${account.id}/roles`).set(asHr())
            .send({ roleId: hrRole.id }).expect(201);

        const preparerToken = (await request(ctx.app)
            .post("/api/v1/auth/sessions").send({ email: mail.recipient, password: "Preparer#2026" }).expect(200)).body.accessToken;

        const denied = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${periodId}/bank-file`)
            .set({ Authorization: `Bearer ${preparerToken}` })
            .expect(403);
        expect(denied.body.code).toBe("ACCESS_DENIED");
    });

    it("4. file sinh theo ĐÚNG cấu hình; ai bị loại phải nêu rõ", async () => {
        const result = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${periodId}/bank-file`).set(asApprover())
            .expect(200);

        // Phiếu còn draft -> không vào lệnh chi.
        expect(result.body.rowCount).toBe(0);
        expect(result.body.skipped).toHaveLength(2);
        expect(result.body.skipped.every((row: { reason: string }) => row.reason.includes("draft"))).toBe(true);

        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/hr-review`).set(asHr()).expect(200);
        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/approve`).set(asApprover()).send({}).expect(200);

        const approved = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${periodId}/bank-file`).set(asApprover())
            .expect(200);

        expect(approved.body.bankCode).toBe("VCB");
        expect(approved.body.bankName).toBe("Vietcombank");
        expect(approved.body.fileName).toBe("bank-transfer_VCB_2026-11.csv");
        expect(approved.body.rowCount).toBe(1);

        // Nhân viên chưa khai tài khoản bị loại kèm lý do, không tự điền gì.
        expect(approved.body.skipped).toHaveLength(1);
        expect(approved.body.skipped[0].employeeId).toBe(employeeNoBankId);
        expect(approved.body.skipped[0].reason).toContain("bank account");

        const lines = (approved.body.content as string).replace(/^﻿/, "").split("\r\n");
        expect(lines[0]).toBe("STT,So tai khoan,Ten nguoi nhan,So tien,Ngay chi,Noi dung");

        const cells = (lines[1] ?? "").split(",");
        expect(cells[0]).toBe("1");
        expect(cells[1]).toBe("1021000123456");
        expect(cells[2]).toBe("NGUYEN VAN A");
        expect(Number(cells[3])).toBe(approved.body.totalAmount);
        expect(cells[4]).toBe("05/12/2026");
        expect(cells[5]).toBe("Thanh toan luong");
    });

    it("5. đổi cấu hình: dấu phân cách, định dạng số/ngày, bỏ header — file đổi theo", async () => {
        await request(ctx.app)
            .patch(`/api/v1/setting/bank-profiles/${profileId}`).set(asHr())
            .send({
                delimiter: ";", includeHeader: false, amountFormat: "grouped", dateFormat: "yyyy-MM-dd",
                columns: [
                    { header: "So tai khoan", source: "bank_account_number" },
                    { header: "So tien", source: "net_salary" },
                    { header: "Ky luong", source: "period_name" },
                    { header: "Ngay chi", source: "pay_date" },
                ],
            })
            .expect(200);

        const result = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${periodId}/bank-file`).set(asApprover())
            .expect(200);

        const lines = (result.body.content as string).replace(/^﻿/, "").split("\r\n");
        // Không header -> dòng đầu đã là dữ liệu.
        expect(lines).toHaveLength(1);

        const cells = (lines[0] ?? "").split(";");
        expect(cells[0]).toBe("1021000123456");
        expect(cells[1]).toBe(result.body.totalAmount.toLocaleString("en-US"));
        expect(cells[2]).toBe("2026-11");
        expect(cells[3]).toBe("2026-12-05");
    });

    it("6. hồ sơ đang bật không xoá được — xoá là làm chết luồng xuất file", async () => {
        const blocked = await request(ctx.app)
            .delete(`/api/v1/setting/bank-profiles/${profileId}`).set(asHr())
            .expect(422);
        expect(blocked.body.code).toBe("BANK_TRANSFER_PROFILE_INVALID");

        // Mã hồ sơ trùng cũng bị chặn.
        const conflict = await request(ctx.app)
            .post("/api/v1/setting/bank-profiles").set(asHr())
            .send({ code: "VCB", bankName: "Vietcombank 2",
                    columns: [
                        { header: "STK", source: "bank_account_number" },
                        { header: "So tien", source: "net_salary" },
                    ] })
            .expect(409);
        expect(conflict.body.code).toBe("BANK_TRANSFER_PROFILE_CODE_CONFLICT");
    });

    it("7. bật hồ sơ khác thì hồ sơ cũ tự tắt — luôn đúng một mẫu đang dùng", async () => {
        const second = await request(ctx.app)
            .post("/api/v1/setting/bank-profiles").set(asHr())
            .send({ code: "ACB", bankName: "ACB", delimiter: "|",
                    columns: [
                        { header: "STK", source: "bank_account_number" },
                        { header: "So tien", source: "net_salary" },
                    ] })
            .expect(201);

        await request(ctx.app)
            .post(`/api/v1/setting/bank-profiles/${second.body.id}/activate`).set(asHr())
            .expect(200);

        const listed = await request(ctx.app)
            .get("/api/v1/setting/bank-profiles").set(asHr())
            .expect(200);

        const active = listed.body.bankProfiles.filter((row: { isActive: boolean }) => row.isActive);
        expect(active).toHaveLength(1);
        expect(active[0].code).toBe("ACB");

        const result = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${periodId}/bank-file`).set(asApprover())
            .expect(200);
        expect(result.body.bankCode).toBe("ACB");
        expect((result.body.content as string)).toContain("1021000123456|");
    });
});
