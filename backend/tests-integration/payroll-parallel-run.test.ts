import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import createTestApp, { TestApp } from "./support/testApp";

/**
 * CHẠY SONG SONG hai phiên bản công thức lương, trên MongoDB thật.
 *
 * Kịch bản dựng ra chênh lệch có thật: nhân viên thử việc (85%) tới 15/11, chính
 * thức từ 16/11, cộng một khoản truy lĩnh của kỳ trước. Engine cũ (`v1`) không
 * biết cả hai thứ đó, nên số phải lệch — và kỳ KHÔNG được đi tiếp cho tới khi
 * từng chênh lệch được giải thích và ký.
 */
describe("Bảng lương: chạy song song v1/v2 + ký xác nhận chênh lệch", () => {
    let ctx: TestApp;

    let hrToken:       string;
    let approverToken: string;
    let employeeId:    string;
    let octoberId:     string;
    let novemberId:    string;

    const asHr       = () => ({ Authorization: `Bearer ${hrToken}` });
    const asApprover = () => ({ Authorization: `Bearer ${approverToken}` });

    const PROBATION_BASE = 16_000_000;
    const OFFICIAL_BASE  = 20_000_000;
    const CLAIM_AMOUNT   =  1_500_000;

    function workDaysOf(year: number, monthIndex: number): string[] {
        const out: string[] = [];
        for (let day = 1; day <= 31; day += 1) {
            const date = new Date(Date.UTC(year, monthIndex, day));
            if (date.getUTCMonth() !== monthIndex) break;
            const weekday = date.getUTCDay();
            if (weekday === 0 || weekday === 6) continue;
            out.push(date.toISOString().slice(0, 10));
        }
        return out;
    }

    const OCT_DAYS = workDaysOf(2026, 9);
    const NOV_DAYS = workDaysOf(2026, 10);

    async function markAttendance(days: string[]): Promise<void> {
        for (const day of days) {
            await request(ctx.app)
                .post("/api/v1/attendance/records").set(asHr())
                .send({ employeeId, date: `${day}T03:00:00.000Z`,
                        checkIn: `${day}T01:00:00.000Z`, checkOut: `${day}T10:00:00.000Z` })
                .expect(200);
        }
    }

    async function createPeriod(name: string, start: string, end: string, pay: string, days: number): Promise<string> {
        return (await request(ctx.app)
            .post("/api/v1/payroll/periods").set(asHr())
            .send({ name, startDate: start, endDate: end, payDate: pay, standardWorkDays: days })
            .expect(201)).body.periodId;
    }

    async function runPeriod(periodId: string): Promise<void> {
        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/lock-attendance`).set(asHr()).expect(200);
        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/lock-evaluations`).set(asHr()).expect(200);
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

        const positionId = (await request(ctx.app)
            .post("/api/v1/department/positions").set(asHr())
            .send({ code: "BE-DEV", title: "Backend Developer", departmentId }).expect(201)).body.positionId;

        employeeId = (await request(ctx.app)
            .post("/api/v1/employee/employees").set(asHr())
            .send({ code: "EMP-001", name: "Nhan Vien Mot", email: "nv1@soosky.test",
                    departmentId, positionId, hireDate: "2026-08-01T00:00:00.000Z", employeeType: "full_time" })
            .expect(201)).body.employeeId;

        await request(ctx.app)
            .post("/api/v1/attendance/shifts").set(asHr())
            .send({ code: "HC", name: "Hanh chinh", startTime: "08:00", endTime: "17:00",
                    breakMinutes: 60, workingDays: [1, 2, 3, 4, 5] })
            .expect(201);

        await request(ctx.app)
            .post("/api/v1/payroll/policies").set(asHr())
            .send({ effectiveFrom: "2026-01-01T00:00:00.000Z", baseSalaryReference: OFFICIAL_BASE,
                    regionalMinWage: 4_960_000, socialInsuranceSalary: OFFICIAL_BASE, taxEnabled: true })
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

        // Hợp đồng thử việc tới 15/11, chính thức từ 16/11.
        const probationId = (await request(ctx.app)
            .post(`/api/v1/employee/employees/${employeeId}/contracts`).set(asHr())
            .send({ contractType: "fixed_term", employmentStatus: "probation", contractNumber: "HD-TV-001",
                    startDate: "2026-08-01T00:00:00.000Z", baseSalary: PROBATION_BASE, status: "active" })
            .expect(201)).body.contractId;

        await request(ctx.app)
            .patch(`/api/v1/employee/contracts/${probationId}`).set(asHr())
            .send({ endDate: "2026-11-15T00:00:00.000Z" })
            .expect(200);

        await request(ctx.app)
            .post(`/api/v1/employee/employees/${employeeId}/contracts`).set(asHr())
            .send({ contractType: "indefinite", employmentStatus: "official", contractNumber: "HD-CT-001",
                    startDate: "2026-11-16T00:00:00.000Z", baseSalary: OFFICIAL_BASE, status: "active" })
            .expect(201);

        await markAttendance(OCT_DAYS);
        await markAttendance(NOV_DAYS);

        octoberId  = await createPeriod("2026-10", "2026-10-01T00:00:00.000Z", "2026-10-31T00:00:00.000Z",
                                       "2026-11-05T00:00:00.000Z", OCT_DAYS.length);
        novemberId = await createPeriod("2026-11", "2026-11-01T00:00:00.000Z", "2026-11-30T00:00:00.000Z",
                                       "2026-12-05T00:00:00.000Z", NOV_DAYS.length);
    });

    afterAll(async () => {
        await ctx?.dispose();
    });

    it("1. kỳ 11 tính bằng engine hiện hành, có đổi hợp đồng + truy lĩnh kỳ 10", async () => {
        await runPeriod(octoberId);

        await request(ctx.app)
            .post("/api/v1/payroll/retro-adjustments").set(asHr())
            .send({ employeeId, kind: "claim", amount: CLAIM_AMOUNT,
                    originPeriodId: octoberId, payoutPeriodId: novemberId,
                    reason: "Thieu phu cap trach nhiem thang 10" })
            .expect(201);

        await runPeriod(novemberId);

        const payrolls = await request(ctx.app)
            .get("/api/v1/payroll/payrolls").query({ payrollPeriodId: novemberId }).set(asHr())
            .expect(200);
        const payslip = payrolls.body.payrolls[0];

        expect(payslip.inputs.engineVersion).toBe("v2");
        expect(payslip.segments).toHaveLength(2);
        expect(payslip.breakdown.totalRetroClaims).toBe(CLAIM_AMOUNT);
    });

    it("2. chưa đối soát: không có chênh lệch nào được ghi", async () => {
        const listed = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${novemberId}/reconciliation`).set(asHr())
            .expect(200);

        expect(listed.body.variances).toHaveLength(0);
        expect(listed.body.unsignedCount).toBe(0);
    });

    it("3. chạy song song v1: phát hiện chênh lệch, không chạm bảng lương thật", async () => {
        const before = (await request(ctx.app)
            .get("/api/v1/payroll/payrolls").query({ payrollPeriodId: novemberId }).set(asHr())
            .expect(200)).body.payrolls[0];

        const result = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/reconciliation`).set(asHr())
            .expect(200);

        expect(result.body.baselineEngine).toBe("v1");
        expect(result.body.targetEngine).toBe("v2");
        expect(result.body.comparedCount).toBe(1);
        expect(result.body.varianceCount).toBe(1);
        expect(result.body.unsignedCount).toBe(1);
        expect(result.body.errors).toHaveLength(0);

        // Dry-run: phiếu thật KHÔNG bị ghi lại (không tăng số lần tính lại).
        const after = (await request(ctx.app)
            .get("/api/v1/payroll/payrolls").query({ payrollPeriodId: novemberId }).set(asHr())
            .expect(200)).body.payrolls[0];
        expect(after.inputs.recomputeCount).toBe(before.inputs.recomputeCount);
        expect(after.breakdown.netSalary).toBe(before.breakdown.netSalary);
        expect(after.status).toBe("draft");
    });

    it("4. bảng đối soát chỉ ra ĐÚNG những ô lệch", async () => {
        const listed = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${novemberId}/reconciliation`).set(asHr())
            .expect(200);

        expect(listed.body.variances).toHaveLength(1);
        const variance = listed.body.variances[0];

        expect(variance.employeeId).toBe(employeeId);
        expect(variance.baselineEngine).toBe("v1");
        expect(variance.targetEngine).toBe("v2");
        expect(variance.signedAt).toBeNull();

        const changed = variance.fields.map((f: { field: string }) => f.field);
        expect(changed).toContain("proRatedBaseSalary");
        expect(changed).toContain("netSalary");
        expect(variance.diff).toBe(variance.targetNet - variance.baselineNet);
        expect(variance.diff).not.toBe(0);
    });

    it("5. còn chênh lệch chưa ký: HR không soát xong được -> kỳ đứng lại", async () => {
        const blocked = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/hr-review`).set(asHr())
            .expect(409);

        expect(blocked.body.code).toBe("PAYROLL_VARIANCE_UNSIGNED");
    });

    it("6. ký phải kèm giải thích thực chất", async () => {
        const tooShort = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/reconciliation/${employeeId}/sign`).set(asHr())
            .send({ explanation: "ok" })
            .expect(422);
        expect(tooShort.body.code).toBe("PAYROLL_VARIANCE_SIGNOFF_INVALID");

        const signed = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/reconciliation/${employeeId}/sign`).set(asHr())
            .send({ explanation: "Nua dau thang con thu viec 85% va co truy linh thang 10; engine cu khong biet ca hai" })
            .expect(200);

        expect(signed.body.signedBy).toBeTypeOf("string");
        expect(signed.body.signedAt).toBeTypeOf("string");

        // Ký hai lần bị chặn — một chênh lệch một chữ ký.
        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/reconciliation/${employeeId}/sign`).set(asHr())
            .send({ explanation: "Ky lai lan hai cho chac chan hon" })
            .expect(422);
    });

    it("7. ký xong: kỳ đi tiếp được tới duyệt (bốn mắt vẫn nguyên)", async () => {
        const reviewed = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/hr-review`).set(asHr())
            .expect(200);
        expect(reviewed.body.stage).toBe("hr_reviewed");

        const selfApprove = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/approve`).set(asHr()).send({}).expect(403);
        expect(selfApprove.body.code).toBe("PAYROLL_SELF_APPROVAL_FORBIDDEN");

        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/approve`).set(asApprover()).send({}).expect(200);
    });

    it("8. tính lại làm đổi số: chữ ký cũ mất hiệu lực, phải ký lại", async () => {
        // Hoàn phiếu về draft rồi bỏ khoản truy lĩnh -> chênh lệch còn nhưng khác số.
        const payrolls = await request(ctx.app)
            .get("/api/v1/payroll/payrolls").query({ payrollPeriodId: novemberId }).set(asHr())
            .expect(200);
        await request(ctx.app)
            .post(`/api/v1/payroll/payrolls/${payrolls.body.payrolls[0].id}/revert`).set(asHr())
            .expect(200);

        const retros = await request(ctx.app)
            .get("/api/v1/payroll/retro-adjustments").query({ payoutPeriodId: novemberId }).set(asHr())
            .expect(200);
        await request(ctx.app)
            .post(`/api/v1/payroll/retro-adjustments/${retros.body.retroAdjustments[0].id}/cancel`).set(asHr())
            .send({ reason: "Ke toan xac nhan da tra trong thang 10" })
            .expect(200);

        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/run/${employeeId}`).set(asHr()).expect(200);

        const result = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/reconciliation`).set(asHr())
            .expect(200);

        // Vẫn lệch (đoạn hợp đồng), nhưng số khác -> chữ ký cũ bị xoá.
        expect(result.body.varianceCount).toBe(1);
        expect(result.body.unsignedCount).toBe(1);

        const listed = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${novemberId}/reconciliation`).set(asHr())
            .expect(200);
        expect(listed.body.variances[0].signedAt).toBeNull();
        expect(listed.body.variances[0].explanation).toBeNull();
    });

    it("9. kỳ không có tính năng mới nào: hai engine khớp, không sinh chênh lệch", async () => {
        // Kỳ 10 chỉ có hợp đồng thử việc phủ cả kỳ, không hồi tố.
        const result = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${octoberId}/reconciliation`).set(asHr())
            .expect(200);

        expect(result.body.comparedCount).toBe(1);
        expect(result.body.varianceCount).toBe(0);
        expect(result.body.unsignedCount).toBe(0);

        // Không có chênh lệch thì không có cổng chặn nào.
        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${octoberId}/hr-review`).set(asHr()).expect(200);
    });
});
