import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import createTestApp, { TestApp } from "./support/testApp";

/**
 * Vòng đời đánh giá đầy đủ, chạy trên MongoDB thật, tới tận bảng lương:
 *
 *   bộ tiêu chí (v1) → chu kỳ gắn kỳ lương → mở chu kỳ (tự phân công) →
 *   quản lý chấm → HR duyệt → nhân viên khiếu nại → HR cho chấm lại →
 *   chấm lại → duyệt → nhân viên xác nhận → HR KHOÁ (chụp điểm sang lương) →
 *   phát hành tiêu chí v2 (lịch sử KHÔNG đổi) → chốt kỳ → lương dùng ĐÚNG điểm đã khoá.
 */
describe("Đánh giá hiệu suất → bảng lương", () => {
    let ctx: TestApp;

    let hrToken:      string;
    let staffToken:   string;
    let managerToken: string;

    let departmentId: string;
    let positionId:   string;
    let managerId:    string;
    let staffId:      string;

    let criteriaSetId: string;
    let cycleId:       string;
    let periodId:      string;
    let staffReviewId: string;
    let criteria: { id: string; code: string; kind: string; weight: number }[] = [];

    const asHr      = () => ({ Authorization: `Bearer ${hrToken}` });
    const asStaff   = () => ({ Authorization: `Bearer ${staffToken}` });
    const asManager = () => ({ Authorization: `Bearer ${managerToken}` });

    const PERIOD_START = "2026-11-01T00:00:00.000Z";
    const PERIOD_END   = "2026-11-30T00:00:00.000Z";
    const PERIOD_PAY   = "2026-12-05T00:00:00.000Z";

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

        hrToken = (await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: ctx.superAdmin.email, password: ctx.superAdmin.password })
            .expect(200)).body.accessToken;

        departmentId = (await request(ctx.app)
            .post("/api/v1/department/departments").set(asHr())
            .send({ code: "ENG", name: "Engineering" }).expect(201)).body.departmentId;

        positionId = (await request(ctx.app)
            .post("/api/v1/department/positions").set(asHr())
            .send({ code: "BE-DEV", title: "Backend Developer", departmentId }).expect(201)).body.positionId;

        managerId = (await request(ctx.app)
            .post("/api/v1/employee/employees").set(asHr())
            .send({ code: "EMP-MGR", name: "Truong Nhom", email: "mgr@soosky.test",
                    departmentId, positionId, hireDate: "2026-01-05T00:00:00.000Z", employeeType: "full_time" })
            .expect(201)).body.employeeId;

        staffId = (await request(ctx.app)
            .post("/api/v1/employee/employees").set(asHr())
            .send({ code: "EMP-001", name: "Nhan Vien Mot", email: "nv1@soosky.test",
                    departmentId, positionId, managerId, hireDate: "2026-01-06T00:00:00.000Z", employeeType: "full_time" })
            .expect(201)).body.employeeId;

        for (const employeeId of [managerId, staffId]) {
            await request(ctx.app)
                .post(`/api/v1/employee/employees/${employeeId}/contracts`).set(asHr())
                .send({ contractType: "indefinite", employmentStatus: "official", contractNumber: `HD-${employeeId.slice(-4)}`,
                        startDate: "2026-01-06T00:00:00.000Z", baseSalary: 20_000_000, status: "active" })
                .expect(201);
        }

        staffToken   = await loginAs(staffId, "NhanVien#2026");
        managerToken = await loginAs(managerId, "Manager#2026");

        // Nâng role manager để có `performance:review:team`.
        const roles       = await request(ctx.app).get("/api/v1/iam/roles").set(asHr()).expect(200);
        const managerRole = roles.body.roles.find((role: { key: string }) => role.key === "manager");
        const accounts    = await request(ctx.app).get("/api/v1/auth/accounts").set(asHr()).expect(200);
        const account     = accounts.body.accounts.find((a: { email: string }) => a.email === "mgr@soosky.test");

        await request(ctx.app)
            .post(`/api/v1/iam/users/${account.id}/roles`).set(asHr())
            .send({ roleId: managerRole.id }).expect(201);

        managerToken = (await request(ctx.app)
            .post("/api/v1/auth/sessions")
            .send({ email: "mgr@soosky.test", password: "Manager#2026" })
            .expect(200)).body.accessToken;
    });

    afterAll(async () => {
        await ctx?.dispose();
    });

    it("1. HR tạo bộ tiêu chí và phát hành phiên bản 1", async () => {
        criteriaSetId = (await request(ctx.app)
            .post("/api/v1/performance/criteria-sets").set(asHr())
            .send({ name: "Bo tieu chi 2026", description: "Ap dung toan cong ty" })
            .expect(201)).body.criteriaSetId;

        // Tổng trọng số mỗi nhóm phải bằng 100 — sai thì bị chặn.
        await request(ctx.app)
            .post(`/api/v1/performance/criteria-sets/${criteriaSetId}/versions`).set(asHr())
            .send({ criteria: [{ code: "KPI-1", name: "Doanh so", kind: "kpi", weight: 60 }] })
            .expect(422);

        const published = await request(ctx.app)
            .post(`/api/v1/performance/criteria-sets/${criteriaSetId}/versions`).set(asHr())
            .send({
                criteria: [
                    { code: "KPI-1",  name: "Doanh so",     kind: "kpi",         weight: 60 },
                    { code: "KPI-2",  name: "Chat luong",   kind: "kpi",         weight: 40 },
                    { code: "GOAL-1", name: "Muc tieu quy", kind: "goal",        weight: 100 },
                    { code: "PERF-1", name: "Thai do",      kind: "performance", weight: 100 },
                ],
            })
            .expect(201);
        expect(published.body.version).toBe(1);

        const sets = await request(ctx.app).get("/api/v1/performance/criteria-sets").set(asHr()).expect(200);
        criteria = sets.body.criteriaSets[0].versions[0].criteria;
        expect(criteria).toHaveLength(4);
    });

    it("2. HR tạo kỳ lương + chu kỳ đánh giá, mở chu kỳ để phân công người chấm", async () => {
        periodId = (await request(ctx.app)
            .post("/api/v1/payroll/periods").set(asHr())
            .send({ name: "2026-11", startDate: PERIOD_START, endDate: PERIOD_END, payDate: PERIOD_PAY, standardWorkDays: 22 })
            .expect(201)).body.periodId;

        const created = await request(ctx.app)
            .post("/api/v1/performance/cycles").set(asHr())
            .send({ name: "Danh gia 2026-11", payrollPeriodId: periodId, criteriaSetId })
            .expect(201);
        cycleId = created.body.cycleId;
        expect(created.body.criteriaVersion).toBe(1);

        // Một kỳ lương chỉ được MỘT chu kỳ.
        await request(ctx.app)
            .post("/api/v1/performance/cycles").set(asHr())
            .send({ name: "Trung ky luong", payrollPeriodId: periodId, criteriaSetId })
            .expect(409);

        const activated = await request(ctx.app)
            .post(`/api/v1/performance/cycles/${cycleId}/activate`).set(asHr())
            .expect(200);

        // Phiếu được tạo cho MỌI nhân viên active (manager + staff).
        expect(activated.body.assigned).toBe(2);

        const reviews = await request(ctx.app)
            .get("/api/v1/performance/reviews").query({ cycleId }).set(asHr())
            .expect(200);
        expect(reviews.body.reviews).toHaveLength(2);

        const staffReview = reviews.body.reviews.find((r: { employeeId: string }) => r.employeeId === staffId);
        staffReviewId = staffReview.id;
        expect(staffReview.status).toBe("draft");
        expect(staffReview.criteriaVersion).toBe(1);
    });

    it("3. phân quyền: nhân viên không chấm được, quản lý không tự chấm cho mình", async () => {
        const scores = criteria.map(c => ({ criterionId: c.id, score: 80 }));

        // Nhân viên không có quyền chấm.
        await request(ctx.app)
            .put(`/api/v1/performance/reviews/${staffReviewId}/scores`).set(asStaff())
            .send({ scores })
            .expect(403);

        // Quản lý không tự chấm phiếu CỦA CHÍNH MÌNH (xung đột lợi ích).
        const reviews = await request(ctx.app)
            .get("/api/v1/performance/reviews").query({ cycleId }).set(asHr()).expect(200);
        const ownReviewId = reviews.body.reviews.find((r: { employeeId: string }) => r.employeeId === managerId).id;

        await request(ctx.app)
            .put(`/api/v1/performance/reviews/${ownReviewId}/scores`).set(asManager())
            .send({ scores })
            .expect(403);

        // Nhân viên cũng không tự duyệt/khoá được.
        await request(ctx.app).post(`/api/v1/performance/reviews/${staffReviewId}/approve`).set(asStaff()).expect(403);
        await request(ctx.app).post(`/api/v1/performance/reviews/${staffReviewId}/lock`).set(asStaff()).expect(403);
    });

    it("4. quản lý chấm — điểm tổng hợp do BACKEND tính theo trọng số", async () => {
        const scoreOf = (code: string): number =>
            code === "KPI-1" ? 100 : code === "KPI-2" ? 50 : code === "GOAL-1" ? 80 : 90;

        // Thiếu điểm một tiêu chí → chặn.
        await request(ctx.app)
            .put(`/api/v1/performance/reviews/${staffReviewId}/scores`).set(asManager())
            .send({ scores: [{ criterionId: criteria[0]!.id, score: 90 }] })
            .expect(422);

        const scored = await request(ctx.app)
            .put(`/api/v1/performance/reviews/${staffReviewId}/scores`).set(asManager())
            .send({
                scores: criteria.map(c => ({ criterionId: c.id, score: scoreOf(c.code) })),
                managerNote: "Hoan thanh tot",
                strengths:   "Chu dong",
            })
            .expect(200);

        // KPI = 100*60% + 50*40% = 80 (bình quân thường sẽ ra 75).
        expect(scored.body.totals).toEqual({ kpiScore: 80, goalScore: 80, performanceScore: 90 });
    });

    it("5. HR duyệt → nhân viên khiếu nại → HR cho chấm lại → chấm lại → duyệt → xác nhận", async () => {
        await request(ctx.app).post(`/api/v1/performance/reviews/${staffReviewId}/approve`).set(asHr()).expect(200);

        // Khiếu nại phải có lý do.
        await request(ctx.app)
            .post(`/api/v1/performance/reviews/${staffReviewId}/appeal`).set(asStaff())
            .send({}).expect(400);

        await request(ctx.app)
            .post(`/api/v1/performance/reviews/${staffReviewId}/appeal`).set(asStaff())
            .send({ reason: "Muc tieu quy chua tinh du an X" })
            .expect(200);

        // Người khác KHÔNG khiếu nại thay được: phiếu không thuộc actor -> 403,
        // kiểm quyền chạy trước cả kiểm trạng thái.
        await request(ctx.app)
            .post(`/api/v1/performance/reviews/${staffReviewId}/appeal`).set(asManager())
            .send({ reason: "Khong phai phieu cua toi" })
            .expect(403);

        await request(ctx.app)
            .post(`/api/v1/performance/reviews/${staffReviewId}/resolve-appeal`).set(asHr())
            .send({ hrNote: "Da doi chieu, cho cham lai", rescore: true })
            .expect(200);

        const afterResolve = await request(ctx.app)
            .get(`/api/v1/performance/reviews/${staffReviewId}`).set(asHr()).expect(200);
        expect(afterResolve.body.status).toBe("draft");
        // Lý do khiếu nại KHÔNG bị xoá — dấu vết cho tranh chấp về sau.
        expect(afterResolve.body.appealNote).toBe("Muc tieu quy chua tinh du an X");

        const rescored = await request(ctx.app)
            .put(`/api/v1/performance/reviews/${staffReviewId}/scores`).set(asManager())
            .send({ scores: criteria.map(c => ({ criterionId: c.id, score: c.code === "GOAL-1" ? 95 : 90 })) })
            .expect(200);
        expect(rescored.body.totals).toEqual({ kpiScore: 90, goalScore: 95, performanceScore: 90 });

        await request(ctx.app).post(`/api/v1/performance/reviews/${staffReviewId}/approve`).set(asHr()).expect(200);

        // HR KHÔNG xác nhận thay nhân viên được.
        await request(ctx.app).post(`/api/v1/performance/reviews/${staffReviewId}/acknowledge`).set(asHr()).expect(403);

        await request(ctx.app).post(`/api/v1/performance/reviews/${staffReviewId}/acknowledge`).set(asStaff()).expect(200);
    });

    it("6. chưa khoá đủ điểm thì KHÔNG đóng chu kỳ và KHÔNG chốt đánh giá được", async () => {
        const readiness = await request(ctx.app)
            .get(`/api/v1/performance/cycles/${cycleId}/readiness`).set(asHr()).expect(200);

        expect(readiness.body.ready).toBe(false);
        expect(readiness.body.totalActiveEmployees).toBe(2);
        expect(readiness.body.lockedCount).toBe(0);

        await request(ctx.app).post(`/api/v1/performance/cycles/${cycleId}/close`).set(asHr()).expect(409);

        const blocked = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${periodId}/lock-evaluations`).set(asHr()).expect(409);
        expect(blocked.body.code).toBe("PAY_EVALUATION_INCOMPLETE");
    });

    it("7. HR khoá điểm → chụp sang kỳ lương, phiếu bất biến", async () => {
        const locked = await request(ctx.app)
            .post(`/api/v1/performance/reviews/${staffReviewId}/lock`).set(asHr()).expect(200);
        expect(locked.body.totals).toEqual({ kpiScore: 90, goalScore: 95, performanceScore: 90 });

        // Đã khoá thì không chấm lại, không khoá lại.
        await request(ctx.app)
            .put(`/api/v1/performance/reviews/${staffReviewId}/scores`).set(asManager())
            .send({ scores: criteria.map(c => ({ criterionId: c.id, score: 10 })) })
            .expect(409);
        await request(ctx.app).post(`/api/v1/performance/reviews/${staffReviewId}/lock`).set(asHr()).expect(409);

        // Khoá phiếu còn lại (của quản lý) để chu kỳ đủ điểm.
        const reviews = await request(ctx.app)
            .get("/api/v1/performance/reviews").query({ cycleId }).set(asHr()).expect(200);
        const managerReviewId = reviews.body.reviews.find((r: { employeeId: string }) => r.employeeId === managerId).id;

        await request(ctx.app)
            .put(`/api/v1/performance/reviews/${managerReviewId}/scores`).set(asHr())
            .send({ scores: criteria.map(c => ({ criterionId: c.id, score: 70 })) })
            .expect(200);
        await request(ctx.app).post(`/api/v1/performance/reviews/${managerReviewId}/approve`).set(asHr()).expect(200);
        await request(ctx.app).post(`/api/v1/performance/reviews/${managerReviewId}/acknowledge`).set(asManager()).expect(200);
        await request(ctx.app).post(`/api/v1/performance/reviews/${managerReviewId}/lock`).set(asHr()).expect(200);

        const readiness = await request(ctx.app)
            .get(`/api/v1/performance/cycles/${cycleId}/readiness`).set(asHr()).expect(200);
        expect(readiness.body.ready).toBe(true);
        expect(readiness.body.lockedCount).toBe(2);
    });

    it("8. sửa tiêu chí (phát hành v2) KHÔNG đổi lịch sử đã khoá", async () => {
        const published = await request(ctx.app)
            .post(`/api/v1/performance/criteria-sets/${criteriaSetId}/versions`).set(asHr())
            .send({ criteria: [{ code: "KPI-NEW", name: "Chi tieu moi", kind: "kpi", weight: 100 }] })
            .expect(201);
        expect(published.body.version).toBe(2);

        // Phiếu đã khoá vẫn trỏ v1 và giữ nguyên điểm.
        const review = await request(ctx.app)
            .get(`/api/v1/performance/reviews/${staffReviewId}`).set(asHr()).expect(200);
        expect(review.body.criteriaVersion).toBe(1);
        expect(review.body.totals).toEqual({ kpiScore: 90, goalScore: 95, performanceScore: 90 });
        expect(review.body.status).toBe("locked");

        // Chu kỳ cũng giữ v1 — không tự nhảy sang bản mới nhất.
        const cycles = await request(ctx.app).get("/api/v1/performance/cycles").set(asHr()).expect(200);
        expect(cycles.body.cycles.find((c: { id: string }) => c.id === cycleId).criteriaVersion).toBe(1);

        await request(ctx.app).post(`/api/v1/performance/cycles/${cycleId}/close`).set(asHr()).expect(200);
    });

    it("9. bảng lương dùng ĐÚNG điểm đã khoá", async () => {
        // Chuẩn bị đủ đầu vào lương: ca, chấm công, chính sách lương.
        await request(ctx.app)
            .post("/api/v1/attendance/shifts").set(asHr())
            .send({ code: "HC", name: "Hanh chinh", startTime: "08:00", endTime: "17:00", breakMinutes: 60, workingDays: [1, 2, 3, 4, 5] })
            .expect(201);

        await request(ctx.app)
            .post("/api/v1/payroll/policies").set(asHr())
            .send({ effectiveFrom: "2026-01-01T00:00:00.000Z", baseSalaryReference: 20_000_000,
                    regionalMinWage: 4_960_000, socialInsuranceSalary: 20_000_000 })
            .expect(201);

        // 22 ngày làm việc của tháng 11/2026.
        const workDates: string[] = [];
        for (let day = 1; workDates.length < 22 && day <= 30; day += 1) {
            const date = new Date(Date.UTC(2026, 10, day));
            const weekday = date.getUTCDay();
            if (weekday === 0 || weekday === 6) continue;
            workDates.push(date.toISOString().slice(0, 10));
        }

        for (const day of workDates) {
            for (const employeeId of [staffId, managerId]) {
                await request(ctx.app)
                    .post("/api/v1/attendance/records").set(asHr())
                    .send({ employeeId, date: `${day}T03:00:00.000Z`, checkIn: `${day}T01:00:00.000Z`, checkOut: `${day}T10:00:00.000Z` })
                    .expect(200);
            }
        }

        await request(ctx.app).post(`/api/v1/payroll/periods/${periodId}/lock-attendance`).set(asHr()).expect(200);

        const readiness = await request(ctx.app)
            .get(`/api/v1/payroll/periods/${periodId}/evaluation-readiness`).set(asHr()).expect(200);
        expect(readiness.body.appraisalCycleId).toBe(cycleId);
        expect(readiness.body.employeesNoEvaluation).toBe(0);

        const locked = await request(ctx.app)
            .post(`/api/v1/payroll/periods/${periodId}/lock-evaluations`).set(asHr()).expect(200);
        expect(locked.body.autoRunning).toBe(true);

        const payrolls = await request(ctx.app)
            .get("/api/v1/payroll/payrolls").query({ payrollPeriodId: periodId }).set(asHr())
            .expect(200);

        const staffPayslip = payrolls.body.payrolls.find((p: { employeeId: string }) => p.employeeId === staffId);
        // ĐÚNG điểm đã khoá, không phải mặc định 100.
        expect(staffPayslip.performanceRatio).toBe(90);
        expect(staffPayslip.goalRatio).toBe(95);

        const managerPayslip = payrolls.body.payrolls.find((p: { employeeId: string }) => p.employeeId === managerId);
        expect(managerPayslip.performanceRatio).toBe(70);
        expect(managerPayslip.goalRatio).toBe(70);

        // Điểm khác nhau -> lương khác nhau, dù cùng lương cơ bản và cùng ngày công.
        expect(staffPayslip.breakdown.netSalary).not.toBe(managerPayslip.breakdown.netSalary);
    });

    it("10. audit ghi lại toàn bộ mốc quan trọng của đánh giá", async () => {
        const audit = await request(ctx.app).get("/api/v1/iam/audit-logs").set(asHr()).expect(200);
        const logs  = audit.body.auditLogs ?? audit.body.logs ?? audit.body.items;
        const keys  = new Set<string>(logs.map((log: { resource: string; action: string }) => `${log.resource}:${log.action}`));

        expect(keys).toContain("performance_criteria_set:create");
        expect(keys).toContain("performance_criteria_version:publish");
        expect(keys).toContain("performance_cycle:create");
        expect(keys).toContain("performance_cycle:activate");
        expect(keys).toContain("performance_cycle:close");
        expect(keys).toContain("performance_review:score");
        expect(keys).toContain("performance_review:approve");
        expect(keys).toContain("performance_review:appeal");
        expect(keys).toContain("performance_review:resolve_appeal");
        expect(keys).toContain("performance_review:acknowledge");
        expect(keys).toContain("performance_review:lock");

        // Bản ghi khoá điểm phải nêu rõ bản chụp đã đẩy sang kỳ lương nào.
        const lockLog = logs.find((log: { resource: string; action: string }) =>
            log.resource === "performance_review" && log.action === "lock");
        expect(lockLog.changes.payrollPeriodId).toBe(periodId);
        expect(lockLog.changes.criteriaVersion).toBe(1);
    });
});
