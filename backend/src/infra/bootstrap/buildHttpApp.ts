import { AppConfig } from "@infra/config";
import createAccountProvisioner from "@infra/di/createAccountProvisioner";
import createAttendanceHttpUseCases from "@infra/di/createAttendanceHttpUseCases";
import createAuthHttpUseCases from "@infra/di/createAuthHttpUseCases";
import createDashboardHttpUseCases from "@infra/di/createDashboardHttpUseCases";
import createDepartmentHttpUseCases from "@infra/di/createDepartmentHttpUseCases";
import createEmployeeHttpUseCases from "@infra/di/createEmployeeHttpUseCases";
import createIamEventUseCases from "@infra/di/createIamEventUseCases";
import createIamHttpUseCases from "@infra/di/createIamHttpUseCases";
import createPayrollHttpUseCases from "@infra/di/createPayrollHttpUseCases";
import createPerformanceHttpUseCases from "@infra/di/createPerformanceHttpUseCases";
import createSettingHttpUseCases from "@infra/di/createSettingHttpUseCases";
import InProcessEventBus from "@infra/events/InProcessEventBus";
import createExpressServer from "@infra/server/createExpressServer";
import DevAccessTokenIssuer from "@infra/server/DevAccessTokenIssuer";
import DevAccessTokenVerifier from "@infra/server/DevAccessTokenVerifier";
import JwtAccessTokenVerifier from "@infra/server/JwtAccessTokenVerifier";
import SmtpVerificationMailer from "@modules/auth/adapters/driven/mail/SmtpVerificationMailer";
import JwtAccessTokenIssuer from "@modules/auth/adapters/driven/security/JwtAccessTokenIssuer";
import AccessTokenIssuer from "@modules/auth/core/app/ports/AccessTokenIssuer";
import VerificationMailer from "@modules/auth/core/app/ports/VerificationMailer";
import { subscribeIamEventConsumer } from "@modules/iam";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { Express } from "express";
import { Db as MongoDb, MongoClient } from "mongodb";

/**
 * Chọn trình xác minh access token theo cấu hình: có `AUTH_JWT_SECRET` thì
 * xác minh JWT thật; vắng mặt (chỉ ngoài production — config đã chặn) thì
 * rơi về DevAccessTokenVerifier kèm cảnh báo.
 */
function createAccessTokenVerifier(config: AppConfig): AccessTokenVerifier {
    if (config.auth.jwtSecret != undefined) {
        return new JwtAccessTokenVerifier(config.auth.jwtSecret);
    }
    console.warn("AUTH_JWT_SECRET is not set — using DevAccessTokenVerifier (bearer token = userId). NOT ALLOWED in production.");
    return new DevAccessTokenVerifier();
}

/**
 * Chọn trình phát hành access token theo cấu hình — đối xứng với
 * `createAccessTokenVerifier`: có `AUTH_JWT_SECRET` thì ký JWT thật; vắng mặt
 * (chỉ ngoài production — config đã chặn) thì rơi về DevAccessTokenIssuer
 * (token = accountId) để cặp issue/verify dev khớp nhau.
 */
function createAccessTokenIssuer(config: AppConfig): AccessTokenIssuer {
    if (config.auth.jwtSecret != undefined) {
        return new JwtAccessTokenIssuer(config.auth.jwtSecret);
    }
    console.warn("AUTH_JWT_SECRET is not set — using DevAccessTokenIssuer (access token = accountId). NOT ALLOWED in production.");
    return new DevAccessTokenIssuer();
}

/**
 * Lắp mailer gửi mail xác minh account qua SMTP theo cấu hình. Dev không đặt
 * `SMTP_HOST` thì config đã trỏ về localhost:1025 (Mailpit/MailHog).
 */
function createVerificationMailer(config: AppConfig): VerificationMailer {
    return new SmtpVerificationMailer({
        ...config.mail.smtp,
        from:                config.mail.from,
        verificationBaseUrl: config.auth.accountVerificationBaseUrl,
    });
}

/**
 * Lắp ráp TOÀN BỘ ứng dụng HTTP từ hạ tầng đã kết nối sẵn: event bus, bộ
 * use-case của mọi module, rồi Express app.
 *
 * Tách khỏi `server.ts` để hai đường vào dùng chung một cách nối dây duy
 * nhất: tiến trình production (`server.ts` — thêm listen + graceful shutdown)
 * và test tích hợp (supertest gọi thẳng vào `Express` trả về đây). Nhờ vậy
 * test tích hợp chạy đúng app thật, không phải bản dựng lại gần giống.
 */
export interface BuildHttpAppOverrides {
    /**
     * Thay mailer thật bằng bản khác. Dùng cho test tích hợp: mật khẩu tạm và
     * token kích hoạt chỉ đi qua email, mà token lưu trong DB đã bị băm nên
     * không đọc lại được — muốn kiểm thử trọn luồng "cấp account → kích hoạt →
     * đăng nhập" thì phải bắt được nội dung mail.
     */
    verificationMailer?: VerificationMailer;
}

export default function buildHttpApp(
    config:      AppConfig,
    mongoClient: MongoClient,
    mongoDb:     MongoDb,
    overrides:   BuildHttpAppOverrides = {},
): Express {
    // Bus sự kiện liên-module: auth publish các sự kiện account; iam đăng ký
    // consumer tại đây — TRƯỚC khi lắp ráp use-case HTTP của auth để không bỏ
    // lỡ sự kiện nào phát ra ngay trong lúc khởi động.
    const eventBus = new InProcessEventBus();
    subscribeIamEventConsumer(eventBus, createIamEventUseCases(mongoDb));

    const accessTokenIssuer  = createAccessTokenIssuer(config);
    const tokenVerifier      = createAccessTokenVerifier(config);
    const verificationMailer = overrides.verificationMailer ?? createVerificationMailer(config);

    const authUseCases       = createAuthHttpUseCases(mongoClient, mongoDb, eventBus, accessTokenIssuer, verificationMailer);
    const iamUseCases        = createIamHttpUseCases(mongoClient, mongoDb);
    const departmentUseCases = createDepartmentHttpUseCases(mongoDb);

    // Employee cấp tài khoản đăng nhập bằng cách uỷ quyền cho use-case của Auth.
    // Tái dùng đúng instance đã dựng cho HTTP -> một đường code duy nhất tạo
    // account, dù gọi từ endpoint Auth hay từ endpoint grant-login của Employee.
    const employeeUseCases   = createEmployeeHttpUseCases(mongoDb, createAccountProvisioner(authUseCases.registerMemberAccount));
    const attendanceUseCases = createAttendanceHttpUseCases(mongoDb, eventBus);
    const payrollUseCases    = createPayrollHttpUseCases(mongoClient, mongoDb, eventBus);
    const settingUseCases    = createSettingHttpUseCases(mongoDb);
    const performanceUseCases = createPerformanceHttpUseCases(mongoDb);
    // Dashboard là module CHỈ ĐỌC: nó không có repo riêng, chỉ nối cổng sang sáu
    // module nghiệp vụ ở đúng factory này.
    const dashboardUseCases   = createDashboardHttpUseCases(mongoDb);

    return createExpressServer(
        authUseCases,
        iamUseCases,
        departmentUseCases,
        employeeUseCases,
        attendanceUseCases,
        payrollUseCases,
        performanceUseCases,
        settingUseCases,
        dashboardUseCases,
        tokenVerifier,
        config.http.corsOrigins,
    );
}
