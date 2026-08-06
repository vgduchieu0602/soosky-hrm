import { createDashboardHttpRouter } from "@modules/dashboard";
import GetDashboardOverviewUseCase from "@modules/dashboard/core/app/use-cases/GetDashboardOverviewUseCase";
import { DashboardSources } from "@modules/dashboard/core/app/ports/DashboardSources";
import { AuthenticatedActor } from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

const fakeVerifier: AccessTokenVerifier = {
    async verify(token: string) { return token ? new AuthenticatedActor(token) : undefined; },
};

function buildSources(scope: "all" | "team" | "self", permissions: string[] = []): DashboardSources {
    const granted = new Set(permissions);

    return {
        permissions: {
            resolveScope: async () => {
                if (permissions.includes("__deny__")) throw new AccessDeniedError();
                return scope;
            },
            hasPermission: async (_actor, key) => granted.has(key),
        },
        clock: { timezone: async () => "Asia/Ho_Chi_Minh" },
        employees: {
            listSummaries: async () => [
                { id: "emp-1", code: "EMP-001", name: "Nguyen Van A", departmentId: "dept-1", hireDate: new Date("2026-08-01T00:00:00.000Z"), status: "active" },
            ],
            listSummariesByIds: async () => [],
            findEmployeeIdByUserId: async () => "emp-1",
            listTeamEmployeeIds: async () => ["emp-1"],
        },
        departments: { listNames: async () => [{ id: "dept-1", name: "Engineering" }] },
        attendance: { countByDay: async () => [] },
        leaves: {
            listPending: async () => [],
            listUpcomingApproved: async () => [],
            countPendingCorrections: async () => 0,
        },
        payroll: {
            latestPeriodSnapshot: async () => undefined,
            latestPayslipOf: async () => undefined,
        },
        performance: {
            activeCycleProgress: async () => undefined,
            countReviewsToScore: async () => 0,
            latestReviewStatusOf: async () => undefined,
        },
        audit: { listRecent: async () => [] },
    };
}

function buildApp(sources: DashboardSources): Express {
    const app = express();
    app.use("/dashboard", createDashboardHttpRouter(
        { getDashboardOverview: new GetDashboardOverviewUseCase(sources) },
        fakeVerifier,
    ));
    return app;
}

describe("Dashboard HTTP", () => {
    let app: Express;

    beforeEach(() => { app = buildApp(buildSources("all", ["audit:read"])); });

    it("GET /dashboard/overview trả DTO TRỰC TIẾP, không bọc envelope", async () => {
        const response = await request(app).get("/dashboard/overview").set({ Authorization: "Bearer user-hr" }).expect(200);

        expect(response.body).not.toHaveProperty("data");
        expect(response.body.scope).toBe("all");
        expect(response.body.timezone).toBe("Asia/Ho_Chi_Minh");
        // Ngày dạng YYYY-MM-DD, mốc thời điểm dạng ISO.
        expect(response.body.attendanceToday.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(response.body.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("không có access token -> 401", async () => {
        await request(app).get("/dashboard/overview").expect(401);
    });

    it("thiếu quyền dashboard:read -> 403 với envelope { code, message }", async () => {
        const denied = buildApp(buildSources("all", ["__deny__"]));

        const response = await request(denied).get("/dashboard/overview").set({ Authorization: "Bearer user-x" }).expect(403);

        expect(response.body.code).toBe("ACCESS_DENIED");
        expect(response.body.message).toBeTypeOf("string");
    });

    it("endpoint KHÔNG nhận tham số phạm vi: query bịa thêm bị bỏ qua", async () => {
        const response = await request(app)
            .get("/dashboard/overview")
            .query({ scope: "all", employeeId: "emp-999" })
            .set({ Authorization: "Bearer user-emp" })
            .expect(200);

        // Phạm vi vẫn do backend quyết định, không phải theo query.
        expect(response.body.scope).toBe("all");
        expect(JSON.stringify(response.body)).not.toContain("emp-999");
    });

    it("nhánh không được phép trả null, không phải bỏ trường", async () => {
        const limited = buildApp(buildSources("self", []));

        const response = await request(limited).get("/dashboard/overview").set({ Authorization: "Bearer user-emp" }).expect(200);

        expect(response.body).toHaveProperty("headcount", null);
        expect(response.body).toHaveProperty("pendingApprovals", null);
        expect(response.body).toHaveProperty("payroll", null);
        expect(response.body).toHaveProperty("auditActivity", null);
        // Trường được xem nhưng rỗng thì là mảng rỗng, KHÔNG null.
        expect(response.body.upcomingLeaves).toEqual([]);
    });

    it("chỉ có duy nhất một route đọc: POST không tồn tại", async () => {
        await request(app).post("/dashboard/overview").set({ Authorization: "Bearer user-hr" }).expect(404);
    });
});
