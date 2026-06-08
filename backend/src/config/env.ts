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

  // Web client base URL — used to build the "Đăng nhập" link in emails.
  APP_WEB_URL: z.string().default('http://localhost:5173'),
  // Sender identity for outgoing mail.
  MAIL_FROM: z.string().default('Soosky HRM <no-reply@soosky.co>'),
  // Optional SMTP — when unset, the mail service uses a dev log transport.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

export const env = schema.parse(process.env);
