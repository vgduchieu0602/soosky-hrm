import createTestApp, { TestApp } from "./support/testApp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * SMOKE TEST vòng đời HR — chuỗi nghiệp vụ tối thiểu phải chạy được thì hệ
 * thống mới coi là "sống":
 *
 *   đăng nhập → phòng ban → vị trí → nhân viên → hợp đồng → chấm công →
 *   kỳ lương → chốt chấm công + đánh giá → phiếu lương → duyệt
 *
 * Chạy trên MongoDB replica set THẬT qua HTTP thật (supertest) với đúng app
 * mà `server.ts` khởi động, nên nó bắt được cả lỗi nối dây (DI, prefix route,
 * transaction) mà unit test bỏ lọt.
 *
 * Các bước phụ thuộc nhau theo thứ tự nên gom trong MỘT `describe` tuần tự và
 * chia sẻ state qua biến ngoài — cố ý, không phải test độc lập.
 */
describe("HR lifecycle smoke", () => {
    let ctx:         TestApp;
    let accessToken: string;

    // State chảy qua các bước.
    let departmentId: string;
    let positionId:   string;
    let employeeId:   string;
    let contractId:   string;
    let periodId:     string;

    // Kỳ lương dùng tháng cố định để kết quả không phụ thuộc ngày chạy test.
    const PERIOD_NAME    = "2026-03";
    const PERIOD_START   = "2026-03-01T00:00:00.000Z";
    const PERIOD_END     = "2026-03-31T00:00:00.000Z";
    const PERIOD_PAY_DAY = "2026-04-05T00:00:00.000Z";
    const STANDARD_WORK_DAYS = 22;
    const BASE_SALARY        = 20_000_000;

    /** Ngày chấm công: 22 ngày làm việc trong kỳ (bỏ thứ 7/CN). */
    const WORK_DATES: string[] = (() => {
        const dates: string[] = [];
        for (let day = 1; dates.length < STANDARD_WORK_DAYS && day <= 31; day += 1) {
            const date = new Date(Date.UTC(2026, 2, day));
            const weekday = date.getUTCDay();
            if (weekday === 0 || weekday === 6) continue;
            dates.push(date.toISOString());
        }
        return dates;
    })();

    const auth = () => ({ Authorization: `Bearer ${accessToken}` });

    beforeAll(async () => {
        ctx = await createTestApp();
    });

    afterAll(async () => {
        await ctx?.dispose();
    });

    it("1. đăng nhập super admin và nhận access token", async () => {
        const res = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: ctx.superAdmin.email, password: ctx.superAdmin.password })
            .expect(200);

        expect(res.body.accessToken).toBeTypeOf("string");
        accessToken = res.body.accessToken;

        // Token vừa nhận phải mở được endpoint cần xác thực.
        await request(ctx.app).get("/api/v1/auth/me").set(auth()).expect(200);
    });

    it("2. tạo phòng ban", async () => {
        const res = await request(ctx.app)
            .post("/api/v1/department/departments")
            .set(auth())
            .send({ code: "ENG", name: "Engineering", description: "Khối kỹ thuật" })
            .expect(201);

        departmentId = res.body.departmentId;
        expect(departmentId).toBeTypeOf("string");

        const list = await request(ctx.app).get("/api/v1/department/departments").set(auth()).expect(200);
        expect(list.body.departments).toHaveLength(1);
    });

    it("3. tạo vị trí trong phòng ban", async () => {
        const res = await request(ctx.app)
            .post("/api/v1/department/positions")
            .set(auth())
            .send({ code: "BE-DEV", title: "Backend Developer", departmentId, level: 3 })
            .expect(201);

        positionId = res.body.positionId;
        expect(positionId).toBeTypeOf("string");
    });

    it("4. tạo nhân viên", async () => {
        const res = await request(ctx.app)
            .post("/api/v1/employee/employees")
            .set(auth())
            .send({
                code:         "EMP-0001",
                name:         "Nguyen Van A",
                email:        "nva@soosky.test",
                departmentId,
                positionId,
                hireDate:     "2026-01-06T00:00:00.000Z",
                employeeType: "full_time",
            })
            .expect(201);

        employeeId = res.body.employeeId;
        expect(employeeId).toBeTypeOf("string");

        // Nhân viên mới luôn bắt đầu ở `onboarding`; chỉ hợp đồng active mới
        // chuyển sang `active` (bước 5).
        const detail = await request(ctx.app).get(`/api/v1/employee/employees/${employeeId}`).set(auth()).expect(200);
        expect(detail.body.status).toBe("onboarding");
    });

    it("5. tạo hợp đồng lao động active", async () => {
        const res = await request(ctx.app)
            .post(`/api/v1/employee/employees/${employeeId}/contracts`)
            .set(auth())
            .send({
                contractType:     "indefinite",
                employmentStatus: "official",
                contractNumber:   "HD-2026-0001",
                startDate:        "2026-01-06T00:00:00.000Z",
                baseSalary:       BASE_SALARY,
                currency:         "VND",
                status:           "active",
            })
            .expect(201);

        contractId = res.body.contractId;
        expect(contractId).toBeTypeOf("string");

        // Có hợp đồng active → nhân viên vào biên chế. Không có bước này thì
        // payroll (chỉ quét nhân viên `active`) sẽ không tính lương cho ai.
        const detail = await request(ctx.app).get(`/api/v1/employee/employees/${employeeId}`).set(auth()).expect(200);
        expect(detail.body.status).toBe("active");
    });

    it("6. tạo ca làm việc (chấm công cần ca áp dụng cho ngày đó)", async () => {
        await request(ctx.app)
            .post("/api/v1/attendance/shifts")
            .set(auth())
            .send({
                code:         "HC",
                name:         "Hành chính",
                startTime:    "08:00",
                endTime:      "17:00",
                breakMinutes: 60,
                workingDays:  [1, 2, 3, 4, 5],
            })
            .expect(201);
    });

    it("7. chấm công đủ ngày công tiêu chuẩn của kỳ", async () => {
        for (const date of WORK_DATES) {
            const day = date.slice(0, 10);
            await request(ctx.app)
                .post("/api/v1/attendance/records")
                .set(auth())
                .send({
                    employeeId,
                    date,
                    checkIn:  `${day}T01:00:00.000Z`,  // 08:00 giờ VN
                    checkOut: `${day}T10:00:00.000Z`,  // 17:00 giờ VN
                })
                .expect(200);
        }

        const list = await request(ctx.app)
            .get("/api/v1/attendance/records")
            .query({ employeeId, start: PERIOD_START, end: PERIOD_END })
            .set(auth())
            .expect(200);

        expect(list.body.records.length).toBe(WORK_DATES.length);
    });

    it("8. tạo chính sách lương hiệu lực cho kỳ", async () => {
        await request(ctx.app)
            .post("/api/v1/payroll/policies")
            .set(auth())
            .send({
                effectiveFrom:         "2026-01-01T00:00:00.000Z",
                baseSalaryReference:   BASE_SALARY,
                regionalMinWage:       4_960_000,
                socialInsuranceSalary: BASE_SALARY,
            })
            .expect(201);
    });

    it("9. tạo kỳ lương", async () => {
        const res = await request(ctx.app)
            .post("/api/v1/payroll/periods")
            .set(auth())
            .send({
                name:             PERIOD_NAME,
                startDate:        PERIOD_START,
                endDate:          PERIOD_END,
                payDate:          PERIOD_PAY_DAY,
                standardWorkDays: STANDARD_WORK_DAYS,
            })
            .expect(201);

        periodId = res.body.periodId;
        expect(periodId).toBeTypeOf("string");
    });

    it("10. chốt chấm công + chốt đánh giá → tự chạy lương cả kỳ", async () => {
        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/lock-attendance`).set(auth()).expect(200);

        // Chốt cái thứ hai làm kỳ "fully locked" → use-case tự chạy lương ngay
        // trong request (đồng bộ), nên ngay sau đây phiếu lương phải tồn tại.
        const res = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${periodId}/lock-evaluations`)
            .set(auth())
            .expect(200);

        expect(res.body.autoRunning).toBe(true);
    });

    it("11. phiếu lương được tính đúng cho nhân viên", async () => {
        const res = await request(ctx.app)
            .get("/api/v1/payroll/payrolls")
            .query({ payrollPeriodId: periodId })
            .set(auth())
            .expect(200);

        const payrolls = res.body.payrolls;
        expect(payrolls).toHaveLength(1);

        const payslip = payrolls[0];
        expect(payslip.employeeId).toBe(employeeId);
        expect(payslip.status).toBe("draft");
        expect(payslip.breakdown.grossSalary).toBeGreaterThan(0);
        expect(payslip.breakdown.netSalary).toBeGreaterThan(0);
        // Net = gross trừ BHXH + thuế + công đoàn + khấu trừ khác.
        expect(payslip.breakdown.netSalary).toBeLessThanOrEqual(payslip.breakdown.grossSalary);
        // Đi làm đủ ngày công tiêu chuẩn → chuyên cần tối đa, chưa có đánh giá
        // nên điểm mặc định 100/100.
        expect(payslip.workdays.actualWorkDays).toBe(STANDARD_WORK_DAYS);
        expect(payslip.attendanceRatio).toBe(1);
        expect(payslip.performanceRatio).toBe(100);
        expect(payslip.goalRatio).toBe(100);
    });

    it("12. người LẬP lương không tự duyệt được (nguyên tắc bốn mắt)", async () => {
        // HR soát bảng lương thử trước — không có bước này thì duyệt trả 409
        // PAYROLL_STAGE_INVALID (quy trình 7 bước).
        const reviewed = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${periodId}/hr-review`).set(auth())
            .expect(200);
        expect(reviewed.body.stage).toBe("hr_reviewed");

        const res = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${periodId}/approve`).set(auth())
            .expect(403);

        expect(res.body.code).toBe("PAYROLL_SELF_APPROVAL_FORBIDDEN");
    });

    it("13. người duyệt riêng (có payroll:approve) duyệt được bảng lương", async () => {
        // Dựng một tài khoản duyệt riêng: HR tạo account, kích hoạt, đổi mật khẩu
        // tạm, rồi được gán role `admin` (role duy nhất giữ quyền duyệt lương).
        await request(ctx.app)
            .post("/api/v1/auth/accounts").set(auth())
            .send({ email: "approver@soosky.test", fullName: "Ke Toan Truong" })
            .expect(201);

        const mail = ctx.sentMails.at(-1);
        if (mail == undefined) throw new Error("khong bat duoc mail kich hoat");

        await request(ctx.app)
            .post("/api/v1/auth/accounts/verification").send({ token: mail.verificationToken }).expect(200);

        const first = await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: mail.recipient, password: mail.temporaryPassword })
            .expect(200);

        await request(ctx.app)
            .put("/api/v1/auth/me/password")
            .set({ Authorization: `Bearer ${first.body.accessToken}` })
            .send({ currentPassword: mail.temporaryPassword, newPassword: "Approver#2026" })
            .expect(200);

        const roles     = await request(ctx.app).get("/api/v1/iam/roles").set(auth()).expect(200);
        const adminRole = roles.body.roles.find((role: { key: string }) => role.key === "admin");
        const accounts  = await request(ctx.app).get("/api/v1/auth/accounts").set(auth()).expect(200);
        const account   = accounts.body.accounts.find((a: { email: string }) => a.email === "approver@soosky.test");

        await request(ctx.app)
            .post(`/api/v1/iam/users/${account.id}/roles`).set(auth())
            .send({ roleId: adminRole.id }).expect(201);

        const approverToken = (await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: mail.recipient, password: "Approver#2026" })
            .expect(200)).body.accessToken;
        const approverAuth = () => ({ Authorization: `Bearer ${approverToken}` });

        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/approve`).set(approverAuth()).expect(200);

        const res = await request(ctx.app)
            .get("/api/v1/payroll/payrolls")
            .query({ payrollPeriodId: periodId })
            .set(auth())
            .expect(200);

        const payrolls = res.body.payrolls;
        expect(payrolls[0].status).toBe("approved");
    });
});
