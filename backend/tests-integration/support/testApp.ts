import buildHttpApp from "@infra/bootstrap/buildHttpApp";
import loadAppConfig, { AppConfig } from "@infra/config";
import connectMongo from "@infra/db/connectMongo";
import createAuthCliUseCases from "@infra/di/createAuthCliUseCases";
import createIamEventUseCases from "@infra/di/createIamEventUseCases";
import InProcessEventBus from "@infra/events/InProcessEventBus";
import { subscribeIamEventConsumer } from "@modules/iam";
import { Express } from "express";
import { Db as MongoDb, MongoClient } from "mongodb";

/** URI mặc định khi chạy local: docker compose ở `docker-compose.test.yml` mở cổng 27018. */
const DEFAULT_URI = "mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true";

/** Một mail xác minh đã "gửi" — thay cho việc phải đọc hộp thư thật. */
export interface CapturedMail {
    recipient:         string;
    temporaryPassword: string;
    verificationToken: string;
}

export interface TestApp {
    app:         Express;
    mongoDb:     MongoDb;
    mongoClient: MongoClient;
    config:      AppConfig;
    /** Tài khoản super admin đã tạo sẵn — dùng để đăng nhập ở bước đầu kịch bản. */
    superAdmin:  { email: string; password: string };
    /**
     * Mail xác minh mà app đã phát ra, theo thứ tự. Token lưu trong DB bị băm
     * nên đây là đường DUY NHẤT lấy được token thật để kiểm thử luồng kích hoạt.
     */
    sentMails:   CapturedMail[];
    dispose:     () => Promise<void>;
}

/**
 * Dựng một ứng dụng HTTP thật trên một database TRỐNG, dùng chung đúng
 * `buildHttpApp` với `server.ts` — test tích hợp chạy trên app production,
 * không phải bản dựng lại gần giống.
 *
 * Mỗi lần gọi tạo một database riêng (tên có hậu tố ngẫu nhiên) rồi xoá sạch
 * lúc `dispose()`, nên các file test không giẫm chân nhau và chạy lại nhiều
 * lần cho kết quả như nhau.
 *
 * Ghi chú replica set: app dùng transaction (MongoUnitOfWork) nên MongoDB
 * BẮT BUỘC chạy replica set — mongod đơn lẻ sẽ lỗi ngay ở lệnh ghi đầu tiên.
 */
export default async function createTestApp(): Promise<TestApp> {
    const dbName = `hrm-it-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const env: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_ENV:        "test",
        MONGODB_URI:     process.env.MONGODB_URI ?? DEFAULT_URI,
        MONGODB_DB:      dbName,
        AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET ?? "integration-test-secret-at-least-32-characters",
        // Không có SMTP thật trong CI — SmtpVerificationMailer chỉ được gọi ở
        // luồng đăng ký member, kịch bản này không đi qua đó.
        SMTP_HOST:       process.env.SMTP_HOST ?? "localhost",
        SMTP_PORT:       process.env.SMTP_PORT ?? "1025",
    };

    const config = loadAppConfig(env);
    const { mongoClient, mongoDb } = await connectMongo(config);

    // Bootstrap super admin đúng như `cli.ts`: bus sự kiện + consumer IAM phải
    // được đăng ký TRƯỚC khi tạo account, nếu không user projection và role
    // admin không được sinh ra và mọi request sau đó sẽ 403.
    const bootstrapBus = new InProcessEventBus();
    subscribeIamEventConsumer(bootstrapBus, createIamEventUseCases(mongoDb));

    const superAdmin = { email: "admin@soosky.test", password: "SuperAdmin#12345" };
    await createAuthCliUseCases(mongoDb, bootstrapBus).registerSuperAdminAccount.execute({
        email:    superAdmin.email,
        password: superAdmin.password,
        fullName: "Integration Super Admin",
    });

    const sentMails: CapturedMail[] = [];
    const app = buildHttpApp(config, mongoClient, mongoDb, {
        verificationMailer: {
            async sendVerificationMail(recipient, generatedPassword, verification) {
                sentMails.push({
                    recipient:         recipient.value,
                    temporaryPassword: generatedPassword,
                    verificationToken: verification.token,
                });
            },
        },
    });

    return {
        app,
        mongoDb,
        mongoClient,
        config,
        superAdmin,
        sentMails,
        dispose: async () => {
            await mongoDb.dropDatabase();
            await mongoClient.close();
        },
    };
}
