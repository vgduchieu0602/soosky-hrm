// Enterprise-standard, email-client-safe HTML templates (table layout + inline
// CSS). Brand palette matches the Soosky HRM app gradient.

const BRAND = {
  navyGradient: 'linear-gradient(135deg,#1B3A74 0%,#163985 55%,#11295C 100%)',
  primary: '#163985',
  ink: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  bg: '#F1F5F9',
};

interface BaseLayoutInput {
  title: string;
  bodyHtml: string;
  preheader?: string;
}

function baseLayout({ title, bodyHtml, preheader = '' }: BaseLayoutInput): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px -12px rgba(15,23,42,0.25);">
          <!-- header -->
          <tr>
            <td style="background:${BRAND.navyGradient};padding:28px 32px;">
              <table role="presentation" width="100%"><tr>
                <td style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:-0.02em;">
                  Soosky <span style="font-weight:500;opacity:.7;">HRM</span>
                </td>
                <td align="right" style="color:rgba(255,255,255,.65);font-size:11px;letter-spacing:.14em;text-transform:uppercase;">
                  Hệ thống nhân sự
                </td>
              </tr></table>
            </td>
          </tr>
          <!-- body -->
          <tr><td style="padding:32px;">${bodyHtml}</td></tr>
          <!-- footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.border};">
              <p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.6;">
                Email được gửi tự động từ hệ thống Soosky HRM — vui lòng không trả lời email này.<br />
                © ${year} Soosky JSC · Hà Nội, Việt Nam
              </p>
            </td>
          </tr>
        </table>
        <p style="color:${BRAND.muted};font-size:11px;margin:16px 0 0;">Bạn nhận được email này vì tài khoản của bạn được quản trị viên Soosky HRM tạo/ cập nhật.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
    <td style="border-radius:12px;background:${BRAND.primary};">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;">
        ${label}
      </a>
    </td>
  </tr></table>`;
}

function credentialsBox(username: string, password: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="margin:8px 0 4px;border:1px solid ${BRAND.border};border-radius:12px;background:${BRAND.bg};">
    <tr><td style="padding:16px 20px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${BRAND.muted};">Tên đăng nhập</div>
      <div style="font-size:15px;font-weight:600;font-family:Consolas,Menlo,monospace;margin-top:2px;">${username}</div>
    </td></tr>
    <tr><td style="padding:0 20px 16px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${BRAND.muted};">Mật khẩu tạm</div>
      <div style="font-size:18px;font-weight:700;font-family:Consolas,Menlo,monospace;letter-spacing:.04em;margin-top:2px;color:${BRAND.primary};">${password}</div>
    </td></tr>
  </table>`;
}

export interface AccountCredentialsInput {
  fullName?: string;
  username: string;
  tempPassword: string;
  loginUrl: string;
  /** true → password-reset wording; false → brand-new account wording. */
  isReset?: boolean;
}

export function renderAccountCredentialsEmail(input: AccountCredentialsInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { fullName, username, tempPassword, loginUrl, isReset } = input;
  const hello = fullName ? `Xin chào ${fullName},` : 'Xin chào,';
  const subject = isReset
    ? 'Mật khẩu Soosky HRM của bạn đã được đặt lại'
    : 'Tài khoản Soosky HRM của bạn đã sẵn sàng';
  const lead = isReset
    ? 'Quản trị viên đã đặt lại mật khẩu cho tài khoản Soosky HRM của bạn. Vui lòng đăng nhập bằng mật khẩu tạm bên dưới.'
    : 'Quản trị viên đã tạo tài khoản đăng nhập Soosky HRM cho bạn. Dùng thông tin bên dưới để đăng nhập lần đầu.';

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${BRAND.ink};">${subject}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:${BRAND.ink};">${hello}</p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:${BRAND.muted};">${lead}</p>
    ${credentialsBox(username, tempPassword)}
    ${button(loginUrl, 'Đăng nhập ngay')}
    <p style="margin:8px 0 0;font-size:13px;line-height:1.7;color:${BRAND.muted};">
      Vì lý do bảo mật, hãy đổi mật khẩu sau khi đăng nhập tại
      <b style="color:${BRAND.ink};">Hồ sơ cá nhân → Đổi mật khẩu</b>.
      Không chia sẻ mật khẩu này cho bất kỳ ai.
    </p>`;

  const text = [
    subject,
    '',
    hello,
    lead,
    '',
    `Tên đăng nhập: ${username}`,
    `Mật khẩu tạm: ${tempPassword}`,
    '',
    `Đăng nhập: ${loginUrl}`,
    '',
    'Hãy đổi mật khẩu sau khi đăng nhập tại Hồ sơ cá nhân → Đổi mật khẩu.',
    '© Soosky JSC',
  ].join('\n');

  return { subject, html: baseLayout({ title: subject, bodyHtml, preheader: lead }), text };
}
