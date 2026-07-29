import createCorsMiddleware from "@infra/server/createCorsMiddleware";
import { AttendanceHttpUseCases, createAttendanceHttpRouter } from "@modules/attendance";
import { AuthHttpUseCases, createAuthHttpRouter } from "@modules/auth";
import { createDepartmentHttpRouter, DepartmentHttpUseCases } from "@modules/department";
import { createEmployeeHttpRouter, EmployeeHttpUseCases } from "@modules/employee";
import { createIamHttpRouter, IamHttpUseCases } from "@modules/iam";
import { createPayrollHttpRouter, PayrollHttpUseCases } from "@modules/payroll";
import { createSettingHttpRouter, SettingHttpUseCases } from "@modules/setting";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import express, { Express } from "express";

/**
 * Lắp ráp ứng dụng Express: endpoint kiểm tra sức khoẻ và router HTTP của
 * từng module. Router của mỗi module tự mang prefix (`/auth`, `/iam`) trong
 * danh sách route nên gắn ở cấp gốc.
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
    settingUseCases:     SettingHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
    corsOrigins:         string[] = [],
): Express {
    const app = express();

    if (corsOrigins.length > 0) {
        app.use(createCorsMiddleware(corsOrigins));
    }

    app.get("/", (_req, res) => {
        res.json({ status: "Hello, World! This is Soosky HRM API." });
    });

    app.use("/auth", createAuthHttpRouter(authUseCases, accessTokenVerifier));
    app.use("/iam", createIamHttpRouter(iamUseCases, accessTokenVerifier));
    app.use("/department", createDepartmentHttpRouter(departmentUseCases, accessTokenVerifier));
    app.use("/employee", createEmployeeHttpRouter(employeeUseCases, accessTokenVerifier));
    app.use("/attendance", createAttendanceHttpRouter(attendanceUseCases, accessTokenVerifier));
    app.use("/payroll", createPayrollHttpRouter(payrollUseCases, accessTokenVerifier));
    app.use("/setting", createSettingHttpRouter(settingUseCases, accessTokenVerifier));

    return app;
}
