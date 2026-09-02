import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@infra/config';
import { logger } from '@infra/logger/logger';

const log = logger.child({ module: 'mail' });

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const port = env.SMTP_PORT ?? 587;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465, // implicit TLS for 465; STARTTLS for 587
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/**
 * Mail transport.
 *
 * - SMTP_* configured → delivers via nodemailer.
 * - Otherwise → dev **log transport**: logs the message (and full HTML in
 *   non-production) instead of delivering, so flows never break locally.
 */
export const mailService = {
  isConfigured(): boolean {
    return Boolean(env.SMTP_HOST);
  },

  async send(msg: MailMessage): Promise<void> {
    if (!this.isConfigured()) {
      log.info(
        { to: msg.to, subject: msg.subject, transport: 'log' },
        'Email generated (no SMTP configured — not delivered)',
      );
      if (env.NODE_ENV !== 'production') {
        log.debug({ to: msg.to, html: msg.html }, 'Email HTML preview');
      }
      return;
    }

    try {
      const info = await getTransporter().sendMail({
        from: env.MAIL_FROM,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      log.info({ to: msg.to, subject: msg.subject, messageId: info.messageId }, 'email sent');
    } catch (err) {
      log.error({ err, to: msg.to, subject: msg.subject }, 'failed to send email via SMTP');
      throw err;
    }
  },

  /** Verify SMTP connectivity at boot (no-op when unconfigured). */
  async verify(): Promise<void> {
    if (!this.isConfigured()) {
      log.warn('SMTP not configured — using dev log transport (emails are not delivered)');
      return;
    }
    try {
      await getTransporter().verify();
      log.info({ host: env.SMTP_HOST }, 'SMTP transport ready');
    } catch (err) {
      log.error({ err }, 'SMTP verify failed — emails may not be delivered');
    }
  },
};
