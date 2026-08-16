import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  MONGO_URI: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(64),
  JWT_REFRESH_SECRET: z.string().min(64),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  BCRYPT_ROUND: z.coerce.number().default(10),

  // Danh sách origin của web client được phép gọi API kèm cookie, phân tách bằng
  // dấu phẩy. Bắt buộc đặt ở production; bỏ trống chỉ chấp nhận khi chạy dev.
  HTTP_CORS_ORIGINS: z.string().optional(),

  // Web client base URL — used to build the "Đăng nhập" link in emails.
  APP_WEB_URL: z.string().default('http://localhost:5173'),
  // Sender identity for outgoing mail.
  MAIL_FROM: z.string().default('Soosky HRM <no-reply@soosky.co>'),
  // Optional SMTP — when unset, the mail service uses a dev log transport.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Object storage (S3-compatible — Backblaze B2). When S3_BUCKET is empty,
  // the storage service is treated as unconfigured and presign calls fail fast.
  // For Backblaze B2 the endpoint looks like https://s3.us-west-004.backblazeb2.com
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-west-004'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Seconds a presigned URL stays valid (upload & download).
  S3_PRESIGN_TTL: z.coerce.number().default(900),
});

export const env = schema.parse(process.env);
