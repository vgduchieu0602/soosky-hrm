import IssuedToken from "@modules/auth/core/app/ports/IssuedToken";
import VerificationMailer from "@modules/auth/core/app/ports/VerificationMailer";
import Email from "@shared/core/domain/value-objects/email/Email";
import { createTransport, Transporter } from "nodemailer";

export interface SmtpVerificationMailerOptions {
    host:   string;
    port:   number;
    /** true → TLS ngầm định (thường cổng 465); false → plaintext/STARTTLS. */
    secure: boolean;
    /** Vắng mặt cả cặp user/pass → gửi không xác thực (SMTP nội bộ, Mailpit...). */
    user?:  string | undefined;
    pass?:  string | undefined;
    /** Địa chỉ người gửi, vd: `Soosky Workspace <no-reply@soosky.co>`. */
    from:   string;
    /**
     * URL trang xác minh account phía client; token được gắn vào query
     * `?token=`. Vắng mặt thì mail chỉ chứa token thô.
     */
    verificationBaseUrl?: string | undefined;
}

/**
 * Hiện thực `VerificationMailer` gửi mail thật qua SMTP (nodemailer).
 *
 * Adapter chỉ nhận options thô thay vì `AppConfig` để module không phụ thuộc
 * ngược vào tầng infra — composition root chịu trách nhiệm map cấu hình vào.
 */
export default class SmtpVerificationMailer implements VerificationMailer {
    private readonly _transporter: Transporter;

    public constructor(
        private readonly _options: SmtpVerificationMailerOptions,
    ) {
        this._transporter = createTransport({
            host:   _options.host,
            port:   _options.port,
            secure: _options.secure,
            ...(_options.user == undefined ? {} : {
                auth: { user: _options.user, pass: _options.pass },
            }),
        });
    }

    public async sendVerificationMail(recipient: Email, generatedPassword: string, verification: IssuedToken): Promise<void> {
        const link = this._buildVerificationLink(verification.token);

        await this._transporter.sendMail({
            from:    this._options.from,
            to:      recipient.value,
            subject: "Verify your Soosky Workspace account",
            text:    this._buildTextBody(generatedPassword, verification, link),
            html:    this._buildHtmlBody(generatedPassword, verification, link),
        });
    }

    /**
     * Gắn token vào query `?token=` của trang xác minh phía client;
     * không cấu hình trang thì trả `undefined` — mail chỉ chứa token thô.
     */
    private _buildVerificationLink(token: string): string | undefined {
        if (this._options.verificationBaseUrl == undefined) return undefined;

        const url = new URL(this._options.verificationBaseUrl);
        url.searchParams.set("token", token);
        return url.toString();
    }

    private _buildTextBody(generatedPassword: string, verification: IssuedToken, link: string | undefined): string {
        return [
            "Welcome to Soosky Workspace!",
            "",
            "An account has been created for you. Sign in with this temporary password and change it right away:",
            generatedPassword,
            "",
            link == undefined
                ? `Verify your account with this token (valid until ${verification.expiresAt.toISOString()}):`
                : `Verify your account by opening the link below (valid until ${verification.expiresAt.toISOString()}):`,
            link ?? verification.token,
        ].join("\n");
    }

    private _buildHtmlBody(generatedPassword: string, verification: IssuedToken, link: string | undefined): string {
        return [
            "<p>Welcome to <strong>Soosky Workspace</strong>!</p>",
            `<p>An account has been created for you. Sign in with this temporary password and change it right away:</p><p><code>${generatedPassword}</code></p>`,
            link == undefined
                ? `<p>Verify your account with this token (valid until ${verification.expiresAt.toISOString()}):</p><p><code>${verification.token}</code></p>`
                : `<p><a href="${link}">Verify your account</a> (link valid until ${verification.expiresAt.toISOString()}).</p>`,
        ].join("\n");
    }
}
