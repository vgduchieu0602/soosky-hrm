// Enterprise-standard, email-client-safe HTML templates (table layout + inline
// CSS, Outlook VML button fallback). Brand palette matches the Soosky HRM app.

// Web fonts only render in some email clients (Apple Mail, iOS, parts of
// Android). Everywhere else this stack falls back gracefully to system fonts.
const FONT = "'Be Vietnam Pro','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Escape user-controlled values before interpolating into HTML. Credentials can
// contain HTML-special characters (e.g. '&' in a generated password); inserting
// them raw corrupts what the recipient sees and copies — which then fails login.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BRAND = {
  navyGradient: 'linear-gradient(135deg,#0E2557 0%,#163985 55%,#11295C 100%)',
  navy: '#163985',
  cyan: '#00B8F5',
  cyanDark: '#0094D4',
  ink: '#0F172A',
  sub: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',
  border: '#E6EBF2',
  surface: '#F8FAFC',
  bg: '#EEF2F8',
};

interface BaseLayoutInput {
  title: string;
  bodyHtml: string;
  preheader?: string;
}

function baseLayout({ title, bodyHtml, preheader = '' }: BaseLayoutInput): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="vi" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <title>${title}</title>
  <!--[if mso]><style>* { font-family: 'Segoe UI', Arial, sans-serif !important; }</style><![endif]-->
  <!--[if !mso]><!-->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <!--<![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');
    @media only screen and (max-width:620px){
      .sk-card{ width:100% !important; border-radius:0 !important; }
      .sk-pad{ padding:24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-font-smoothing:antialiased;font-family:${FONT};color:${BRAND.ink};">
  <span style="display:none!important;visibility:hidden;mso-hide:all;max-height:0;width:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:36px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="sk-card"
          style="max-width:600px;width:100%;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 18px 44px -20px rgba(15,23,42,0.30);border:1px solid ${BRAND.border};">
          <!-- accent strip -->
          <tr><td style="height:4px;line-height:4px;font-size:0;background:linear-gradient(90deg,${BRAND.cyan} 0%,#67DBFF 50%,${BRAND.navy} 100%);">&nbsp;</td></tr>
          <!-- header -->
          <tr>
            <td style="background:${BRAND.navyGradient};padding:26px 36px;">
              <table role="presentation" width="100%"><tr>
                <td style="color:#FFFFFF;font-size:21px;font-weight:700;letter-spacing:-0.02em;">
                  Soosky <span style="font-weight:500;opacity:.65;">HRM</span>
                </td>
                <td align="right" style="color:rgba(255,255,255,.6);font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;">
                  Hệ thống nhân sự
                </td>
              </tr></table>
            </td>
          </tr>
          <!-- body -->
          <tr><td class="sk-pad" style="padding:36px;">${bodyHtml}</td></tr>
          <!-- footer -->
          <tr>
            <td class="sk-pad" style="padding:22px 36px 30px;border-top:1px solid ${BRAND.border};background:${BRAND.surface};">
              <p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.7;">
                Email được gửi tự động từ hệ thống <b style="color:${BRAND.sub};">Soosky HRM</b> — vui lòng không trả lời email này.
              </p>
              <p style="margin:8px 0 0;color:${BRAND.faint};font-size:11.5px;line-height:1.6;">
                © ${year} Soosky JSC · Hà Nội, Việt Nam
              </p>
            </td>
          </tr>
        </table>
        <p style="color:${BRAND.faint};font-size:11px;line-height:1.6;margin:18px 0 0;max-width:520px;">
          Bạn nhận được email này vì tài khoản của bạn được quản trị viên Soosky HRM tạo hoặc cập nhật.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function eyebrow(text: string): string {
  return `<div style="display:inline-block;padding:5px 12px;border-radius:999px;background:#E8FAFF;color:${BRAND.cyanDark};font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">${text}</div>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td>
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
      href="${href}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="26%" stroke="f" fillcolor="${BRAND.cyanDark}">
      <w:anchorlock/>
      <center style="color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${href}" target="_blank"
       style="display:inline-block;padding:14px 34px;background:${BRAND.cyan};background:linear-gradient(135deg,${BRAND.cyan} 0%,${BRAND.cyanDark} 100%);color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;box-shadow:0 10px 22px -10px rgba(0,148,212,.65);">
      ${label}
    </a>
    <!--<![endif]-->
  </td></tr></table>`;
}

function usernameBox(username: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="margin:22px 0 4px;border:1px solid ${BRAND.border};border-radius:14px;background:${BRAND.surface};overflow:hidden;">
    <tr><td style="padding:16px 22px;">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:${BRAND.faint};font-weight:600;">Tên đăng nhập</div>
      <div style="font-size:17px;font-weight:600;font-family:Consolas,Menlo,monospace;margin-top:4px;color:${BRAND.ink};word-break:break-all;">${escapeHtml(username)}</div>
    </td></tr>
  </table>`;
}

function securityNote(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="margin:20px 0 0;border-radius:12px;background:#FFFBEB;border:1px solid #FDE68A;">
    <tr>
      <td width="4" style="background:#F59E0B;line-height:0;font-size:0;">&nbsp;</td>
      <td style="padding:14px 18px;font-size:13px;line-height:1.7;color:#92400E;">${html}</td>
    </tr>
  </table>`;
}

export interface AccountSetupInput {
  fullName?: string;
  username: string;
  /** Link to the web set-password page (carries the single-use token). */
  actionUrl: string;
  /** true → password-reset wording; false → brand-new account wording. */
  isReset?: boolean;
  /** Human label of how long the link is valid, e.g. "7 ngày" / "2 giờ". */
  expiresInLabel: string;
}

/**
 * Account activation / password-reset email. No password is ever included —
 * the recipient sets their own via the secure, single-use link.
 */
export function renderAccountSetupEmail(input: AccountSetupInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { fullName, username, actionUrl, isReset, expiresInLabel } = input;
  const hello = fullName ? `Xin chào ${fullName},` : 'Xin chào,';
  const helloHtml = fullName ? `Xin chào ${escapeHtml(fullName)},` : 'Xin chào,';
  const subject = isReset
    ? 'Đặt lại mật khẩu Soosky HRM của bạn'
    : 'Kích hoạt tài khoản Soosky HRM của bạn';
  const tag = isReset ? 'Đặt lại mật khẩu' : 'Chào mừng bạn';
  const heading = isReset ? 'Đặt lại mật khẩu của bạn' : 'Chỉ còn một bước nữa thôi';
  const ctaLabel = isReset ? 'Đặt lại mật khẩu' : 'Thiết lập mật khẩu';
  const lead = isReset
    ? 'Quản trị viên vừa yêu cầu đặt lại mật khẩu cho tài khoản Soosky HRM của bạn. Nhấn nút bên dưới để chọn một mật khẩu mới.'
    : 'Quản trị viên đã tạo tài khoản Soosky HRM cho bạn. Vì lý do bảo mật, hãy tự thiết lập mật khẩu của riêng mình để bắt đầu sử dụng.';

  const bodyHtml = `
    ${eyebrow(tag)}
    <h1 style="margin:16px 0 10px;font-size:23px;font-weight:700;line-height:1.3;color:${BRAND.ink};letter-spacing:-0.01em;">${heading}</h1>
    <p style="margin:0 0 14px;font-size:14.5px;line-height:1.7;color:${BRAND.ink};">${helloHtml}</p>
    <p style="margin:0;font-size:14px;line-height:1.7;color:${BRAND.sub};">${lead}</p>
    ${usernameBox(username)}
    ${button(actionUrl, ctaLabel)}
    <p style="margin:6px 0 0;font-size:12.5px;line-height:1.7;color:${BRAND.muted};">
      Liên kết này có hiệu lực trong <b style="color:${BRAND.sub};">${escapeHtml(expiresInLabel)}</b> và chỉ dùng được một lần.
    </p>
    ${securityNote(
      `Nếu bạn không yêu cầu việc này, hãy bỏ qua email — mật khẩu của bạn sẽ không thay đổi. Tuyệt đối không chia sẻ liên kết này cho bất kỳ ai.`,
    )}
    <p style="margin:22px 0 0;font-size:12.5px;line-height:1.7;color:${BRAND.muted};">
      Nếu nút phía trên không hoạt động, hãy sao chép liên kết sau vào trình duyệt:<br />
      <a href="${actionUrl}" target="_blank" style="color:${BRAND.cyanDark};word-break:break-all;">${escapeHtml(actionUrl)}</a>
    </p>`;

  const text = [
    subject,
    '',
    hello,
    lead,
    '',
    `Tên đăng nhập: ${username}`,
    '',
    `${ctaLabel}: ${actionUrl}`,
    `(Liên kết có hiệu lực trong ${expiresInLabel} và chỉ dùng được một lần.)`,
    '',
    'Nếu bạn không yêu cầu việc này, hãy bỏ qua email — mật khẩu của bạn sẽ không thay đổi.',
    '© Soosky JSC · Hà Nội, Việt Nam',
  ].join('\n');

  return { subject, html: baseLayout({ title: subject, bodyHtml, preheader: lead }), text };
}
