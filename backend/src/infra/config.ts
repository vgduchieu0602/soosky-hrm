import { existsSync } from "node:fs";

/**
 * Cấu hình ứng dụng đọc từ biến môi trường.
 */
export interface AppConfig {
    auth: {
        /**
         * Secret ký/xác minh JWT access token (HS256). Bắt buộc ở production;
         * vắng mặt ở môi trường khác thì server rơi về DevAccessTokenVerifier.
         */
        jwtSecret: string | undefined;

        /**
         * URL trang xác minh account phía client; token được gắn vào query
         * `?token=`. Vắng mặt thì mail chỉ chứa token thô.
         */
        accountVerificationBaseUrl: string | undefined;
    },
    http: {
        host?: string;
        port:  number;

        /**
         * Danh sách origin được phép gọi API từ trình duyệt (CORS), đọc từ
         * `HTTP_CORS_ORIGINS` phân tách bằng dấu phẩy; `*` cho phép mọi
         * origin. Rỗng → không bật CORS (same-origin/reverse proxy).
         */
        corsOrigins: string[];
    }
    mail: {
        /**
         * Máy chủ SMTP để gửi mail. `SMTP_HOST` bắt buộc ở production; vắng
         * mặt ở môi trường khác thì mặc định localhost:1025 — SMTP dev như
         * Mailpit/MailHog.
         */
        smtp: SmtpConfig;

        /** Địa chỉ người gửi hiển thị trên mail. */
        from: string;
    },
    mongodb: {
        uri:    string;
        dbName: string;
    },
}

export interface SmtpConfig {
    host:   string;
    port:   number;
    /** true → TLS ngầm định (thường cổng 465); false → plaintext/STARTTLS. */
    secure: boolean;
    /** Vắng mặt cả cặp user/pass → gửi không xác thực (SMTP nội bộ, Mailpit...). */
    user:   string | undefined;
    pass:   string | undefined;
}

/**
 * Đọc cấu hình từ `process.env`, dùng giá trị mặc định phù hợp cho môi trường
 * phát triển khi biến môi trường vắng mặt.
 *
 * @throws {ConfigError} `PORT` không phải là số hợp lệ.
 * @throws {ConfigError} `MONGODB_URI` không phải là chuỗi kết nối MongoDB hợp lệ.
 * @throws {ConfigError} `SMTP_PORT` không phải là số hợp lệ.
 * @throws {ConfigError} `AUTH_JWT_SECRET` vắng mặt khi `NODE_ENV` là `production`.
 * @throws {ConfigError} `SMTP_HOST` vắng mặt khi `NODE_ENV` là `production`.
 */
export default function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    // Chỉ nạp file khi đọc từ môi trường thật; caller truyền env riêng
    // (vd: kiểm thử) thì không đụng vào process.env.
    if (env === process.env) {
        loadDotEnvFile();
    }

    const smtpHost = env.SMTP_HOST?.trim() || undefined;

    const config: AppConfig = {
        auth: {
            // Chuỗi rỗng coi như chưa đặt để không ký token bằng secret rỗng.
            jwtSecret: env.AUTH_JWT_SECRET?.trim() || undefined,
            accountVerificationBaseUrl: env.AUTH_ACCOUNT_VERIFICATION_BASE_URL?.trim() || undefined,
        },
        http: {
            host: env.HTTP_HOST ?? "localhost",
            port: Number(env.HTTP_PORT ?? 3000),
            corsOrigins: (env.HTTP_CORS_ORIGINS ?? "")
                .split(",")
                .map(origin => origin.trim())
                .filter(origin => origin !== ""),
        },
        mail: {
            smtp: {
                host:   smtpHost ?? "localhost",
                port:   Number(env.SMTP_PORT ?? 1025),
                secure: env.SMTP_SECURE === "true",
                user:   env.SMTP_USER?.trim() || undefined,
                pass:   env.SMTP_PASS || undefined,
            },
            from: env.MAIL_FROM ?? "Soosky Workspace <no-reply@soosky.co>",
        },
        mongodb: {
            uri:    env.MONGODB_URI ?? "mongodb://localhost:27017",
            dbName: env.MONGODB_DB ?? "soosky-workspace",
        },
    };

    const isProduction = ["production", "prod", "prd"].includes((env.NODE_ENV ?? "").toLowerCase());

    if (!Number.isInteger(config.http.port) || config.http.port <= 0) {
        throw new ConfigError("HTTP_PORT", `must be a positive integer, got: ${env.HTTP_PORT}`);
    }

    if (!/^mongodb(?:\+srv)?:\/\/.+/i.test(config.mongodb.uri)) {
        throw new ConfigError("MONGODB_URI", `must be a valid MongoDB connection string, got: ${env.MONGODB_URI}`);
    }

    if (!Number.isInteger(config.mail.smtp.port) || config.mail.smtp.port <= 0) {
        throw new ConfigError("SMTP_PORT", `must be a positive integer, got: ${env.SMTP_PORT}`);
    }

    if (isProduction && config.auth.jwtSecret == undefined) {
        throw new ConfigError("AUTH_JWT_SECRET", "is required in production");
    }

    if (isProduction && smtpHost == undefined) {
        throw new ConfigError("SMTP_HOST", "is required in production");
    }

    console.log("CONFIGURATION:", JSON.stringify(redactSecrets(config), null, 4));
    return config;
}

/**
 * Nạp file `.env` ở thư mục làm việc (nếu có) vào `process.env` bằng
 * `process.loadEnvFile` của Node — không cần dependency ngoài. Biến đã có
 * sẵn trong môi trường được giữ nguyên: shell luôn thắng file, `.env` chỉ
 * bù những biến còn thiếu.
 */
function loadDotEnvFile(): void {
    if (existsSync(".env")) {
        process.loadEnvFile(".env");
    }
}

/**
 * Che các giá trị bí mật trước khi log cấu hình lúc khởi động — secret/mật
 * khẩu không bao giờ được xuất hiện trong log.
 */
function redactSecrets(config: AppConfig): AppConfig {
    return {
        ...config,
        auth: {
            ...config.auth,
            jwtSecret: maskSecret(config.auth.jwtSecret),
        },
        mail: {
            ...config.mail,
            smtp: {
                ...config.mail.smtp,
                pass: maskSecret(config.mail.smtp.pass),
            },
        },
        mongodb: {
            ...config.mongodb,
            // Che mật khẩu trong connection string dạng mongodb://user:pass@host
            uri: config.mongodb.uri.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:***@"),
        },
    };
}

function maskSecret(secret: string | undefined): string | undefined {
    return secret == undefined ? undefined : "***";
}

/**
 * Lỗi cấu hình ứng dụng: biến môi trường vắng mặt hoặc không hợp lệ.
 */
class ConfigError extends Error {
    constructor(field: string, reason: string) {
        super(`${field}: ${reason}`);
        this.name = "ConfigError";
    }
}
