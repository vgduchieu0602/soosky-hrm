import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import createTestApp, { TestApp } from "./support/testApp";

/**
 * Đổi hợp đồng GIỮA KỲ + truy vết đầu vào, chạy trên MongoDB thật.
 *
 * Kịch bản: nhân viên thử việc (16tr, hưởng 85%) tới 15/11, chính thức (20tr) từ
 * 16/11. Bảng lương phải tách hai dòng theo hợp đồng, prorate theo ngày, và phiếu
 * phải lưu bản chụp đủ để sau này tái lập lại phép tính.
 */
describe("Bảng lương: đổi hợp đồng giữa kỳ + truy vết", () => {
    let ctx: TestApp;

    let hrToken:       string;
    let approverToken: string;
    let employeeId:    string;
    let probationContractId: string;
    let periodId:      string;

    const asHr       = () => ({ Authorization: `Bearer ${hrToken}` });
    const asApprover = () => ({ Authorization: `Bearer ${approverToken}` });

    const PERIOD_START = "2026-11-01T00:00:00.000Z";
    const PERIOD_END   = "2026-11-30T00:00:00.000Z";
    const PERIOD_PAY   = "2026-12-05T00:00:00.000Z";
    const SWITCH_DAY   = "2026-11-15T00:00:00.000Z";   // ngày cuối của hợp đồng thử việc

    const PROBATION_BASE = 16_000_000;
    const OFFICIAL_BASE  = 20_000_000;

    /** 21 ngày làm việc của tháng 11/2026 (bỏ T7/CN). */
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
                    departmentId, positionId, hireDate: "2026-09-01T00:00:00.000Z", employeeType: "full_time" })
            .expect(201)).body.employeeId;

        // Tài khoản duyệt riêng — người lập không tự duyệt được (bốn mắt).
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
    });

    afterAll(async () => {
        await ctx?.dispose();
    });

    it("1. hợp đồng thử việc, rồi chuyển chính thức từ giữa kỳ", async () => {
        probationContractId = (await request(ctx.app)
            .post(`/api/v1/employee/employees/${employeeId}/contracts`).set(asHr())
            .send({ contractType: "fixed_term", employmentStatus: "probation", contractNumber: "HD-TV-001",
                    startDate: "2026-09-01T00:00:00.000Z", baseSalary: PROBATION_BASE, status: "active" })
            .expect(201)).body.contractId;

        // Tạo hợp đồng mới CHỒNG khoảng với hợp đồng active cũ bị chặn — buộc HR
        // phải chốt ngày kết thúc hợp đồng cũ trước, nên không bao giờ có hai
        // hợp đồng active phủ cùng một ngày (sẽ trả lương hai lần).
        const overlap = await request(ctx.app)
            .post(`/api/v1/employee/employees/${employeeId}/contracts`).set(asHr())
            .send({ contractType: "indefinite", employmentStatus: "official", contractNumber: "HD-CT-001",
                    startDate: "2026-11-16T00:00:00.000Z", baseSalary: OFFICIAL_BASE, status: "active" })
            .expect(409);
        expect(overlap.body.code).toBe("EMPLOYEE_CONTRACT_OVERLAP");

        await request(ctx.app)
            .patch(`/api/v1/employee/contracts/${probationContractId}`).set(asHr())
            .send({ endDate: SWITCH_DAY })
            .expect(200);

        await request(ctx.app)
            .post(`/api/v1/employee/employees/${employeeId}/contracts`).set(asHr())
            .send({ contractType: "indefinite", employmentStatus: "official", contractNumber: "HD-CT-001",
                    startDate: "2026-11-16T00:00:00.000Z", baseSalary: OFFICIAL_BASE, status: "active" })
            .expect(201);
    });

    it("2. chấm công cả tháng + chính sách lương + kỳ lương", async () => {
        await request(ctx.app)
            .post("/api/v1/attendance/shifts").set(asHr())
            .send({ code: "HC", name: "Hanh chinh", startTime: "08:00", endTime: "17:00",
                    breakMinutes: 60, workingDays: [1, 2, 3, 4, 5] })
            .expect(201);

        await request(ctx.app)
            .post("/api/v1/payroll/policies").set(asHr())
            .send({ effectiveFrom: "2026-01-01T00:00:00.000Z", baseSalaryReference: OFFICIAL_BASE,
                    regionalMinWage: 4_960_000, socialInsuranceSalary: OFFICIAL_BASE })
            .expect(201);

        for (const day of WORK_DAYS) {
            await request(ctx.app)
                .post("/api/v1/attendance/records").set(asHr())
                .send({ employeeId, date: `${day}T03:00:00.000Z`,
                        checkIn: `${day}T01:00:00.000Z`, checkOut: `${day}T10:00:00.000Z` })
                .expect(200);
        }

        periodId = (await request(ctx.app)
            .post("/api/v1/payroll/periods").set(asHr())
            .send({ name: "2026-11", startDate: PERIOD_START, endDate: PERIOD_END,
                    payDate: PERIOD_PAY, standardWorkDays: WORK_DAYS.length })
            .expect(201)).body.periodId;
    });

    it("3. tính lương: TÁCH hai dòng theo hợp đồng, prorate theo ngày", async () => {
        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/lock-attendance`).set(asHr()).expect(200);
        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/lock-evaluations`).set(asHr()).expect(200);

        const payrolls = await request(ctx.app)
            .get("/api/v1/payroll/payrolls").query({ payrollPeriodId: periodId }).set(asHr())
            .expect(200);

        // Vẫn MỘT phiếu cho một nhân viên trong một kỳ; các đoạn nằm bên trong.
        expect(payrolls.body.payrolls).toHaveLength(1);
        const payslip = payrolls.body.payrolls[0];

        expect(payslip.segments).toHaveLength(2);

        const [probation, official] = payslip.segments;
        expect(probation.contractNumber).toBe("HD-TV-001");
        expect(probation.employmentStatus).toBe("probation");
        expect(probation.baseSalary).toBe(PROBATION_BASE);
        // Thử việc hưởng 85% theo chính sách mặc định.
        expect(probation.effectiveBase).toBe(Math.round(PROBATION_BASE * 0.85));

        expect(official.contractNumber).toBe("HD-CT-001");
        expect(official.employmentStatus).toBe("official");
        expect(official.effectiveBase).toBe(OFFICIAL_BASE);

        // Mỗi đoạn chỉ đếm ngày công NẰM TRONG đoạn đó; tổng đúng số ngày của kỳ.
        expect(probation.workDays + official.workDays).toBe(WORK_DAYS.length);
        expect(probation.workDays).toBeGreaterThan(0);
        expect(official.workDays).toBeGreaterThan(0);

        // Tổng các đoạn = lương theo công của phiếu (không phải số ước lượng).
        const segmentSum = payslip.segments.reduce(
            (sum: number, s: { proRatedBaseSalary: number }) => sum + s.proRatedBaseSalary, 0,
        );
        expect(segmentSum).toBe(payslip.breakdown.proRatedBaseSalary);

        // Nằm giữa hai mức: cao hơn nếu thử việc cả tháng, thấp hơn nếu chính thức cả tháng.
        expect(payslip.breakdown.proRatedBaseSalary).toBeGreaterThan(Math.round(PROBATION_BASE * 0.85));
        expect(payslip.breakdown.proRatedBaseSalary).toBeLessThan(OFFICIAL_BASE);
    });

    it("4. phiếu lưu BẢN CHỤP đủ để tái lập phép tính", async () => {
        const payrolls = await request(ctx.app)
            .get("/api/v1/payroll/payrolls").query({ payrollPeriodId: periodId }).set(asHr())
            .expect(200);
        const inputs = payrolls.body.payrolls[0].inputs;

        // v2 = phiên bản có tách đoạn hợp đồng + hồi tố (v1 giữ lại để đối soát song song).
        expect(inputs.engineVersion).toBe("v2");
        expect(inputs.salaryPolicyId).toBeTypeOf("string");
        expect(inputs.contractIds).toHaveLength(2);
        expect(inputs.contractIds).toContain(probationContractId);
        expect(inputs.computedBy).toBeTypeOf("string");
        expect(inputs.recomputeCount).toBe(0);
    });

    it("5. tính lại phiếu ghi nhận số lần tính lại (dấu vết sửa đầu vào)", async () => {
        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${periodId}/run/${employeeId}`).set(asHr())
            .expect(200);

        const payrolls = await request(ctx.app)
            .get("/api/v1/payroll/payrolls").query({ payrollPeriodId: periodId }).set(asHr())
            .expect(200);

        expect(payrolls.body.payrolls[0].inputs.recomputeCount).toBe(1);
    });

    it("6. bốn mắt: người lập không duyệt, người duyệt riêng thì được", async () => {
        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${periodId}/hr-review`).set(asHr()).expect(200);

        const selfApprove = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${periodId}/approve`).set(asHr()).send({}).expect(403);
        expect(selfApprove.body.code).toBe("PAYROLL_SELF_APPROVAL_FORBIDDEN");

        await request(ctx.app)
            .post(`/api/v1/payroll/periods/${periodId}/approve`).set(asApprover()).send({}).expect(200);

        const payrolls = await request(ctx.app)
            .get("/api/v1/payroll/payrolls").query({ payrollPeriodId: periodId }).set(asHr())
            .expect(200);
        expect(payrolls.body.payrolls[0].status).toBe("approved");
    });
});
