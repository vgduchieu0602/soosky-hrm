import createCorsMiddleware from "@infra/server/createCorsMiddleware";
import { AttendanceHttpUseCases, createAttendanceHttpRouter } from "@modules/attendance";
import { AuthHttpUseCases, createAuthHttpRouter } from "@modules/auth";
import { createDashboardHttpRouter, DashboardHttpUseCases } from "@modules/dashboard";
import { createDepartmentHttpRouter, DepartmentHttpUseCases } from "@modules/department";
import { createEmployeeHttpRouter, EmployeeHttpUseCases } from "@modules/employee";
import { createIamHttpRouter, IamHttpUseCases } from "@modules/iam";
import { createPayrollHttpRouter, PayrollHttpUseCases } from "@modules/payroll";
import { createPerformanceHttpRouter, PerformanceHttpUseCases } from "@modules/performance";
import { createSettingHttpRouter, SettingHttpUseCases } from "@modules/setting";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import express, { Express, Request, Response } from "express";

/**
 * Prefix chung của toàn bộ API. Frontend (`VITE_API_BASE_URL`) và reverse
 * proxy (nginx `location /api/v1/`) dùng đúng chuỗi này — đổi ở đây thì phải
 * đổi đồng bộ cả hai nơi.
 */
export const API_PREFIX = "/api/v1";

/**
 * Lắp ráp ứng dụng Express: endpoint kiểm tra sức khoẻ và router HTTP của
 * từng module. Router của mỗi module tự mang prefix (`/auth`, `/iam`) trong
 * danh sách route nên gắn dưới `API_PREFIX`.
 *
 * `corsOrigins` rỗng → không gắn middleware CORS, API chỉ phục vụ
 * same-origin (hoặc sau reverse proxy cùng domain).
 */
export default function createExpressServer(
    authUseCases:        AuthHttpUseCases,
    iamUseCases:         IamHttpUseCases,
    departmentUseCases:  DepartmentHttpUseCases,
    employeeUseCases:    EmployeeHttpUseCases,
    attendanceUseCases:  AttendanceHttpUseCases,
    payrollUseCases:     PayrollHttpUseCases,
    performanceUseCases: PerformanceHttpUseCases,
    settingUseCases:     SettingHttpUseCases,
    dashboardUseCases:   DashboardHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
    corsOrigins:         string[] = [],
): Express {
    const app = express();

    if (corsOrigins.length > 0) {
        app.use(createCorsMiddleware(corsOrigins));
    }

    // Healthcheck: cả ở gốc (docker healthcheck, reverse proxy) và dưới prefix
    // (frontend / uptime monitor gọi qua cùng một đường /api/v1).
    const health = (_req: Request, res: Response): void => {
        res.json({ status: "Hello, World! This is Soosky HRM API." });
    };
    app.get("/", health);
    app.get(`${API_PREFIX}/health`, health);

    app.use(`${API_PREFIX}/auth`, createAuthHttpRouter(authUseCases, accessTokenVerifier));
    app.use(`${API_PREFIX}/iam`, createIamHttpRouter(iamUseCases, accessTokenVerifier));
    app.use(`${API_PREFIX}/department`, createDepartmentHttpRouter(departmentUseCases, accessTokenVerifier));
    app.use(`${API_PREFIX}/employee`, createEmployeeHttpRouter(employeeUseCases, accessTokenVerifier));
    app.use(`${API_PREFIX}/attendance`, createAttendanceHttpRouter(attendanceUseCases, accessTokenVerifier));
    app.use(`${API_PREFIX}/payroll`, createPayrollHttpRouter(payrollUseCases, accessTokenVerifier));
    app.use(`${API_PREFIX}/performance`, createPerformanceHttpRouter(performanceUseCases, accessTokenVerifier));
    app.use(`${API_PREFIX}/setting`, createSettingHttpRouter(settingUseCases, accessTokenVerifier));
    app.use(`${API_PREFIX}/dashboard`, createDashboardHttpRouter(dashboardUseCases, accessTokenVerifier));

    return app;
}
