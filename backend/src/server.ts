import loadAppConfig, { AppConfig } from "@infra/config";
import connectMongo from "@infra/db/connectMongo";
import createAttendanceHttpUseCases from "@infra/di/createAttendanceHttpUseCases";
import createAuthHttpUseCases from "@infra/di/createAuthHttpUseCases";
import createDepartmentHttpUseCases from "@infra/di/createDepartmentHttpUseCases";
import createEmployeeHttpUseCases from "@infra/di/createEmployeeHttpUseCases";
import createIamEventUseCases from "@infra/di/createIamEventUseCases";
import createIamHttpUseCases from "@infra/di/createIamHttpUseCases";
import createPayrollHttpUseCases from "@infra/di/createPayrollHttpUseCases";
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
import { Server } from "http";
import { MongoClient } from "mongodb";

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
 * Tạo handler cho tín hiệu dừng tiến trình, đóng HTTP server trước rồi mới
 * ngắt kết nối MongoDB.
 */
function createShutdownSignalHandler(server: Server, mongoClient: MongoClient): (signal: NodeJS.Signals) => void {
    return function(signal: NodeJS.Signals): void {
        console.log(`Received ${signal}, shutting down...`);
        server.close(() => {
            mongoClient.close()
                .catch(error => console.error("Error while closing MongoDB connection:", error))
                .finally(() => process.exit(0));
        });
    }
}

/**
 * Điểm khởi động ứng dụng: đọc cấu hình, kết nối MongoDB, lắp ráp use-case
 * và HTTP server, rồi lắng nghe cho tới khi nhận tín hiệu dừng tiến trình.
 */
async function main(): Promise<void> {
    const config = loadAppConfig();

    const { mongoClient, mongoDb } = await connectMongo(config);
    console.log(`Connected to MongoDB at ${config.mongodb.uri} (db: ${config.mongodb.dbName})`);

    // Bus sự kiện liên-module: auth publish các sự kiện account; iam đăng ký
    // consumer tại đây — TRƯỚC khi lắp ráp use-case HTTP của auth để không bỏ
    // lỡ sự kiện nào phát ra ngay trong lúc khởi động.
    const eventBus = new InProcessEventBus();
    subscribeIamEventConsumer(eventBus, createIamEventUseCases(mongoDb));

    const accessTokenIssuer  = createAccessTokenIssuer(config);
    const tokenVerifier      = createAccessTokenVerifier(config);
    const verificationMailer = createVerificationMailer(config);

    const authUseCases       = createAuthHttpUseCases(mongoClient, mongoDb, eventBus, accessTokenIssuer, verificationMailer);
    const iamUseCases        = createIamHttpUseCases(mongoClient, mongoDb);
    const departmentUseCases = createDepartmentHttpUseCases(mongoDb);
    const employeeUseCases   = createEmployeeHttpUseCases(mongoDb);
    const attendanceUseCases = createAttendanceHttpUseCases(mongoDb, eventBus);
    const payrollUseCases    = createPayrollHttpUseCases(mongoClient, mongoDb, eventBus);
    const settingUseCases    = createSettingHttpUseCases(mongoDb);

    const expressServer = createExpressServer(authUseCases, iamUseCases, departmentUseCases, employeeUseCases, attendanceUseCases, payrollUseCases, settingUseCases, tokenVerifier, config.http.corsOrigins);

    const server = expressServer.listen(config.http.port, () => {
        console.log(`Server listening on http://${config.http.host}:${config.http.port}`);
    });

    const shutdownSignalHandler = createShutdownSignalHandler(server, mongoClient);
    process.on("SIGINT", shutdownSignalHandler);
    process.on("SIGTERM", shutdownSignalHandler);
}

main().catch(error => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
