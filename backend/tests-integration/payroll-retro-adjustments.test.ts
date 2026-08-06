import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import createTestApp, { TestApp } from "./support/testApp";

/**
 * Truy lĩnh / truy thu hồi tố, chạy trên MongoDB thật.
 *
 * Kịch bản: kỳ 10 tính thiếu 1.2tr phụ cấp và trả thừa 800k cho cùng nhân viên.
 * Kỳ 10 đã CHỐT — không mở lại. Cả hai khoản được sửa ở kỳ 11 bằng bản ghi hồi tố
 * có tham chiếu kỳ gốc, và phiếu lương kỳ 11 phải phản ánh đúng chiều tiền:
 * truy lĩnh vào gross (chịu thuế), truy thu khấu trừ sau thuế.
 */
describe("Bảng lương: điều chỉnh hồi tố (truy lĩnh/truy thu)", () => {
    let ctx: TestApp;

    let hrToken:       string;
    let approverToken: string;
    let employeeId: string;
    let octoberId:  string;
    let novemberId: string;

    /** Số kỳ 11 khi CHƯA có hồi tố — mốc để đo tác động của từng khoản. */
    let baseline: { grossSalary: number; netSalary: number; tax: number; totalDeductions: number };

    const asHr       = () => ({ Authorization: `Bearer ${hrToken}` });
    const asApprover = () => ({ Authorization: `Bearer ${approverToken}` });

    const CLAIM_AMOUNT    = 1_200_000;
    const CLAWBACK_AMOUNT =   800_000;

    /** Ngày làm việc (bỏ T7/CN) của một tháng UTC. */
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

    async function createPeriod(name: string, start: string, end: string, pay: string, standardWorkDays: number): Promise<string> {
        const response = await request(ctx.app)
            .post("/api/v1/payroll/periods").set(asHr())
            .send({ name, startDate: start, endDate: end, payDate: pay, standardWorkDays })
            .expect(201);
        return response.body.periodId;
    }

    async function markAttendance(days: string[]): Promise<void> {
        for (const day of days) {
            await request(ctx.app)
                .post("/api/v1/attendance/records").set(asHr())
                .send({ employeeId, date: `${day}T03:00:00.000Z`,
                        checkIn: `${day}T01:00:00.000Z`, checkOut: `${day}T10:00:00.000Z` })
                .expect(200);
        }
    }

    async function runPeriod(periodId: string): Promise<void> {
        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/lock-attendance`).set(asHr()).expect(200);
        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/lock-evaluations`).set(asHr()).expect(200);
    }

    async function payslipOf(periodId: string) {
        const response = await request(ctx.app)
            .get("/api/v1/payroll/payrolls").query({ payrollPeriodId: periodId }).set(asHr())
            .expect(200);
        return response.body.payrolls[0];
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
            .post(`/api/v1/employee/employees/${employeeId}/contracts`).set(asHr())
            .send({ contractType: "indefinite", employmentStatus: "official", contractNumber: "HD-CT-001",
                    startDate: "2026-08-01T00:00:00.000Z", baseSalary: 20_000_000, status: "active" })
            .expect(201);

        await request(ctx.app)
            .post("/api/v1/attendance/shifts").set(asHr())
            .send({ code: "HC", name: "Hanh chinh", startTime: "08:00", endTime: "17:00",
                    breakMinutes: 60, workingDays: [1, 2, 3, 4, 5] })
            .expect(201);

        await request(ctx.app)
            .post("/api/v1/payroll/policies").set(asHr())
            .send({ effectiveFrom: "2026-01-01T00:00:00.000Z", baseSalaryReference: 20_000_000,
                    regionalMinWage: 4_960_000, socialInsuranceSalary: 20_000_000, taxEnabled: true })
            .expect(201);

        // Người duyệt riêng — bốn mắt: người lập lương không tự duyệt/chốt kỳ được.
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

        await markAttendance(OCT_DAYS);
        await markAttendance(NOV_DAYS);

        octoberId = await createPeriod("2026-10", "2026-10-01T00:00:00.000Z", "2026-10-31T00:00:00.000Z",
                                      "2026-11-05T00:00:00.000Z", OCT_DAYS.length);
        novemberId = await createPeriod("2026-11", "2026-11-01T00:00:00.000Z", "2026-11-30T00:00:00.000Z",
                                       "2026-12-05T00:00:00.000Z", NOV_DAYS.length);
    });

    afterAll(async () => {
        await ctx?.dispose();
    });

    it("1. kỳ 10 chạy rồi CHỐT — sai sót sẽ phải sửa mà không mở lại kỳ", async () => {
        await runPeriod(octoberId);
        // Chốt kỳ đòi không còn phiếu draft, và cả duyệt lẫn chốt đều là quyền
        // `payroll:approve` của người KHÁC người lập.
        await request(ctx.app).post(`/api/v1/payroll/periods/${octoberId}/hr-review`).set(asHr()).expect(200);
        await request(ctx.app).post(`/api/v1/payroll/periods/${octoberId}/approve`).set(asApprover()).send({}).expect(200);
        await request(ctx.app).post(`/api/v1/payroll/periods/${octoberId}/close`).set(asApprover()).expect(200);

        const october = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${octoberId}`).set(asHr()).expect(200);
        expect(october.body.status).toBe("closed");
    });

    it("2. kỳ 11 tính thử để lấy số gốc (chưa có hồi tố)", async () => {
        await runPeriod(novemberId);

        const payslip = await payslipOf(novemberId);
        baseline = {
            grossSalary:     payslip.breakdown.grossSalary,
            netSalary:       payslip.breakdown.netSalary,
            tax:             payslip.breakdown.tax,
            totalDeductions: payslip.breakdown.totalDeductions,
        };

        expect(baseline.grossSalary).toBeGreaterThan(0);
        expect(baseline.tax).toBeGreaterThan(0);
        expect(payslip.inputs.retroIds).toHaveLength(0);
    });

    it("3. từ chối bản ghi vô nghĩa: kỳ gốc trùng kỳ chi trả, số tiền âm", async () => {
        const sameperiod = await request(ctx.app)
            .post("/api/v1/payroll/retro-adjustments").set(asHr())
            .send({ employeeId, kind: "claim", amount: CLAIM_AMOUNT,
                    originPeriodId: novemberId, payoutPeriodId: novemberId, reason: "Sai ky" })
            .expect(422);
        expect(sameperiod.body.code).toBe("RETRO_ADJUSTMENT_INVALID");

        const negative = await request(ctx.app)
            .post("/api/v1/payroll/retro-adjustments").set(asHr())
            .send({ employeeId, kind: "clawback", amount: -CLAWBACK_AMOUNT,
                    originPeriodId: octoberId, payoutPeriodId: novemberId, reason: "So am" })
            .expect(422);
        expect(negative.body.code).toBe("RETRO_ADJUSTMENT_INVALID");

        const badKind = await request(ctx.app)
            .post("/api/v1/payroll/retro-adjustments").set(asHr())
            .send({ employeeId, kind: "bonus", amount: CLAIM_AMOUNT,
                    originPeriodId: octoberId, payoutPeriodId: novemberId, reason: "Sai kind" })
            .expect(400);
        expect(badKind.body.code).toBe("INVALID_REQUEST");
    });

    it("4. tạo truy lĩnh cho kỳ 10, chi trả ở kỳ 11 — kỳ gốc vẫn đang chốt", async () => {
        const created = await request(ctx.app)
            .post("/api/v1/payroll/retro-adjustments").set(asHr())
            .send({ employeeId, kind: "claim", amount: CLAIM_AMOUNT,
                    originPeriodId: octoberId, payoutPeriodId: novemberId,
                    reason: "Thieu phu cap trach nhiem thang 10" })
            .expect(201);

        expect(created.body.kind).toBe("claim");
        expect(created.body.amount).toBe(CLAIM_AMOUNT);
        expect(created.body.originPeriodId).toBe(octoberId);
        expect(created.body.status).toBe("active");

        // Kỳ gốc không bị mở lại — số đã hạch toán/báo thuế của kỳ 10 giữ nguyên.
        const october = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${octoberId}`).set(asHr()).expect(200);
        expect(october.body.status).toBe("closed");
    });

    it("5. truy lĩnh vào gross và CHỊU thuế ở kỳ nhận tiền", async () => {
        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/run/${employeeId}`).set(asHr()).expect(200);

        const payslip = await payslipOf(novemberId);

        expect(payslip.breakdown.totalRetroClaims).toBe(CLAIM_AMOUNT);
        expect(payslip.breakdown.grossSalary).toBe(baseline.grossSalary + CLAIM_AMOUNT);
        expect(payslip.breakdown.tax).toBeGreaterThan(baseline.tax);
        expect(payslip.inputs.retroIds).toHaveLength(1);
    });

    it("6. truy thu khấu trừ SAU thuế: thuế không đổi, net giảm đúng số", async () => {
        await request(ctx.app)
            .post("/api/v1/payroll/retro-adjustments").set(asHr())
            .send({ employeeId, kind: "clawback", amount: CLAWBACK_AMOUNT,
                    originPeriodId: octoberId, payoutPeriodId: novemberId,
                    reason: "Tra thua tien com thang 10" })
            .expect(201);

        const before = await payslipOf(novemberId);

        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/run/${employeeId}`).set(asHr()).expect(200);

        const after = await payslipOf(novemberId);

        expect(after.breakdown.totalRetroClawbacks).toBe(CLAWBACK_AMOUNT);
        expect(after.breakdown.grossSalary).toBe(before.breakdown.grossSalary);
        expect(after.breakdown.tax).toBe(before.breakdown.tax);
        expect(after.breakdown.netSalary).toBe(before.breakdown.netSalary - CLAWBACK_AMOUNT);
        expect(after.inputs.retroIds).toHaveLength(2);
    });

    it("7. huỷ khoản hồi tố khi phiếu còn draft — bản ghi ở lại kèm lý do", async () => {
        const list = await request(ctx.app)
            .get("/api/v1/payroll/retro-adjustments").query({ payoutPeriodId: novemberId }).set(asHr())
            .expect(200);
        const clawback = list.body.retroAdjustments.find((row: { kind: string }) => row.kind === "clawback");

        await request(ctx.app)
            .post(`/api/v1/payroll/retro-adjustments/${clawback.id}/cancel`).set(asHr())
            .send({ reason: "Nham nhan vien" })
            .expect(200);

        const after = await request(ctx.app)
            .get("/api/v1/payroll/retro-adjustments").query({ payoutPeriodId: novemberId }).set(asHr())
            .expect(200);
        const cancelled = after.body.retroAdjustments.find((row: { id: string }) => row.id === clawback.id);

        // Không xoá: kiểm toán phải đọc được "khoản này từng tồn tại rồi bị huỷ vì sao".
        expect(cancelled.status).toBe("cancelled");
        expect(cancelled.cancelReason).toBe("Nham nhan vien");
        expect(cancelled.cancelledBy).toBeTypeOf("string");

        // Tính lại: khoản đã huỷ không còn vào lương.
        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${novemberId}/run/${employeeId}`).set(asHr()).expect(200);

        const payslip = await payslipOf(novemberId);
        expect(payslip.breakdown.totalRetroClawbacks).toBe(0);
        expect(payslip.breakdown.netSalary).toBeGreaterThan(baseline.netSalary);
        expect(payslip.inputs.retroIds).toHaveLength(1);
    });

    it("8. kỳ chi trả đã chốt thì không nhận thêm hồi tố", async () => {
        const closedPayout = await request(ctx.app)
            .post("/api/v1/payroll/retro-adjustments").set(asHr())
            .send({ employeeId, kind: "claim", amount: 500_000,
                    originPeriodId: novemberId, payoutPeriodId: octoberId, reason: "Ky chi tra da chot" })
            .expect(409);
        expect(closedPayout.body.code).toBe("PAYROLL_PERIOD_LOCKED");
    });
});
