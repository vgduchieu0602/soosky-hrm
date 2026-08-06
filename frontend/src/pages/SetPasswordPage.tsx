import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AxiosError } from "axios";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import logoMark from "@/assets/LOGO.png";
import { authService } from "@features/auth/services/auth.service";
import type { ApiErrorBody } from "@features/auth/types/auth.types";

type Phase = "checking" | "invalid" | "ready" | "done";

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
    if (err.code === "ERR_NETWORK") return "Không kết nối được máy chủ. Vui lòng thử lại.";
  }
  return fallback;
}

const inputCls =
  "h-[52px] w-full rounded-xl border border-gray-200 bg-white pl-12 pr-11 text-[15px] text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] duration-200 hover:border-gray-300 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15";

export default function SetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  // Derive the initial phase from the token's presence so we never call
  // setState synchronously inside the effect (only async, in promise callbacks).
  const [phase, setPhase] = useState<Phase>(token ? "checking" : "invalid");
  const [isReset] = useState(false);
  const [username] = useState("");
  const [checkError, setCheckError] = useState<string | null>(
    token ? null : "Liên kết không hợp lệ. Thiếu mã xác thực.",
  );

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The backend verifies this one-time token and sends the temporary password
  // in the invitation email. Password changes happen after the first login.
  useEffect(() => {
    if (!token) return;
    let active = true;
    authService
      .verifyAccount(token)
      .then(() => {
        if (!active) return;
        setPhase("done");
      })
      .catch((err) => {
        if (!active) return;
        setCheckError(
          extractErrorMessage(err, "Liên kết không hợp lệ hoặc đã hết hạn."),
        );
        setPhase("invalid");
      });
    return () => {
      active = false;
    };
  }, [token]);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 8 && confirm === password && !submitting;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    authService
      .verifyAccount(token)
      .then(() => setPhase("done"))
      .catch((err) =>
        setError(extractErrorMessage(err, "Không thể thiết lập mật khẩu. Vui lòng thử lại.")),
      )
      .finally(() => setSubmitting(false));
  }

  const heading = isReset ? "Đặt lại mật khẩu" : "Thiết lập mật khẩu";
  const subtitle = isReset
    ? "Chọn một mật khẩu mới cho tài khoản của bạn."
    : "Tạo mật khẩu để kích hoạt tài khoản Soosky HRM của bạn.";

  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#11295C] px-5 py-10 font-sans">
      <div className="relative w-full max-w-[460px]">
        {/* brand */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src={logoMark} alt="" className="h-7 w-10 object-contain" />
          <span className="text-lg font-semibold tracking-tight text-white">
            Soosky <span className="font-normal opacity-60">HRM</span>
          </span>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] sm:p-9">
          {phase === "checking" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="size-9 animate-spin rounded-full border-[3px] border-primary-500/25 border-t-primary-500" />
              <p className="text-[14px] text-gray-500">Đang kiểm tra liên kết…</p>
            </div>
          )}

          {phase === "invalid" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                <TriangleAlert size={26} strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-[20px] font-bold text-gray-900">Liên kết không hợp lệ</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
                  {checkError}
                </p>
                <p className="mt-1 text-[13px] text-gray-400">
                  Vui lòng liên hệ quản trị viên để được gửi lại liên kết mới.
                </p>
              </div>
              <button
                onClick={() => navigate("/auth/login")}
                className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-gray-900 px-5 text-[14.5px] font-semibold text-white transition hover:bg-gray-800"
              >
                Về trang đăng nhập
              </button>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                <CheckCircle2 size={28} strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-[20px] font-bold text-gray-900">Hoàn tất!</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
                  Mật khẩu của bạn đã được thiết lập. Bây giờ bạn có thể đăng nhập bằng tài khoản của
                  mình.
                </p>
              </div>
              <button
                onClick={() => navigate("/auth/login")}
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary-600 px-6 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-primary-700"
              >
                Đăng nhập ngay
                <ArrowRight size={16} strokeWidth={2.2} />
              </button>
            </div>
          )}

          {phase === "ready" && (
            <form onSubmit={submit} className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <ShieldCheck size={22} strokeWidth={1.8} />
                </span>
                <div>
                  <h2 className="text-[21px] font-bold tracking-[-0.01em] text-gray-900">{heading}</h2>
                  <p className="mt-0.5 text-[13.5px] text-gray-500">{subtitle}</p>
                </div>
              </div>

              {username && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5">
                  <span className="text-[12px] font-medium uppercase tracking-wide text-gray-400">
                    Tên đăng nhập
                  </span>
                  <div className="font-mono text-[14.5px] font-semibold text-gray-800">{username}</div>
                </div>
              )}

              {/* Password */}
              <div>
                <label htmlFor="pw" className="mb-1.5 block text-[13.5px] font-medium text-gray-700">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-gray-400" strokeWidth={1.7} />
                  <input
                    id="pw"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  >
                    {show ? <EyeOff size={18} strokeWidth={1.6} /> : <Eye size={18} strokeWidth={1.6} />}
                  </button>
                </div>
                {tooShort && (
                  <p className="mt-1.5 text-[12.5px] text-red-500">Mật khẩu phải có ít nhất 8 ký tự.</p>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label htmlFor="cf" className="mb-1.5 block text-[13.5px] font-medium text-gray-700">
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-gray-400" strokeWidth={1.7} />
                  <input
                    id="cf"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    className={inputCls}
                  />
                  {confirm.length > 0 && !mismatch && (
                    <Check className="absolute right-3.5 top-1/2 size-[18px] -translate-y-1/2 text-emerald-500" strokeWidth={2.4} />
                  )}
                </div>
                {mismatch && (
                  <p className="mt-1.5 text-[12.5px] text-red-500">Mật khẩu xác nhận không khớp.</p>
                )}
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13.5px] text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary-600 px-4 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-primary-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Đang lưu…" : heading}
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-[12px] text-white/40">
          © {new Date().getFullYear()} Soosky JSC · Hà Nội, Việt Nam
        </p>
      </div>
    </div>
  );
}
