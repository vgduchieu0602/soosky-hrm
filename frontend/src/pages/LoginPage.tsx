import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import logoMark from "@/assets/LOGO.png";
import { useAuthStore } from "@core/store/auth.store";
import { authService } from "@features/auth/services/auth.service";
import type { ApiErrorBody } from "@features/auth/types/auth.types";

interface Stat {
  value: string;
  label: string;
}

const STATS: Stat[] = [
  { value: "248", label: "Nhân sự" },
  { value: "12", label: "Phòng ban" },
  { value: "4", label: "Năm vận hành" },
];

function extractErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
    if (err.code === "ERR_NETWORK") {
      return "Không kết nối được máy chủ. Vui lòng thử lại.";
    }
  }
  return "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white font-sans">
      {/* ============== LEFT — Brand panel ============== */}
      <aside
        className="relative hidden h-full flex-[0_0_52%] flex-col overflow-hidden p-10 text-white xl:p-16 lg:flex"
        style={{
          background:
            "linear-gradient(150deg, #0E2557 0%, #163985 52%, #11295C 100%)",
        }}
      >
        {/* one soft brand glow — calm, not busy */}
        <div
          className="pointer-events-none absolute -right-32 -top-24 h-[460px] w-[460px] rounded-full animate-aurora-1"
          style={{
            background:
              "radial-gradient(circle, rgba(0,184,245,0.30) 0%, transparent 68%)",
            filter: "blur(36px)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 h-[380px] w-[380px] rounded-full animate-aurora-2"
          style={{
            background:
              "radial-gradient(circle, rgba(54,123,255,0.22) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        {/* top row */}
        <div className="relative flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <img src={logoMark} alt="" className="h-7 w-10 object-contain" />
            <span className="text-lg font-bold tracking-tight">
              Soosky <span className="font-medium opacity-60">HRM</span>
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ring-pulse" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-medium text-white/70">
              Hệ thống ổn định
            </span>
          </div>
        </div>

        {/* center tagline */}
        <div className="relative my-auto max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-400/30 bg-primary-500/10 px-3 py-1 backdrop-blur-sm animate-fade-up [animation-delay:120ms]">
            <ShieldCheck size={13} strokeWidth={2} className="text-primary-300" />
            <span className="text-[11px] font-semibold tracking-wider text-primary-200">
              NỀN TẢNG NHÂN SỰ DOANH NGHIỆP
            </span>
          </div>

          <h1 className="text-[38px] font-bold leading-[1.12] tracking-[-0.02em] animate-fade-up [animation-delay:200ms] xl:text-[48px]">
            Quản lý nhân sự{" "}
            <span className="bg-gradient-to-r from-primary-300 via-primary-200 to-secondary-300 bg-clip-text text-transparent">
              toàn diện
            </span>
            <br />
            cho doanh nghiệp.
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65 animate-fade-up [animation-delay:280ms]">
            Chấm công, nghỉ phép, bảng lương và đánh giá hiệu suất — tất cả gói
            gọn trong một nền tảng, đúng chuẩn Việt Nam.
          </p>

          {/* trust stats */}
          <div className="mt-10 flex items-center gap-8 animate-fade-up [animation-delay:360ms]">
            {STATS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-8">
                {i > 0 && <span className="h-10 w-px bg-white/12" />}
                <div>
                  <div className="text-[28px] font-bold leading-none tabular-nums">
                    {s.value}
                  </div>
                  <div className="mt-1.5 text-[12px] font-medium uppercase tracking-wider text-white/45">
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="relative flex items-center justify-between text-xs text-white/40 animate-fade-in [animation-delay:440ms]">
          <span>© {new Date().getFullYear()} Soosky JSC · Hà Nội, Việt Nam</span>
          <span className="tracking-[0.18em]">SOOSKY HRM</span>
        </div>
      </aside>

      {/* ============== RIGHT — Form ============== */}
      <main className="flex h-full flex-1 flex-col justify-center overflow-y-auto bg-[#FBFCFE] px-6 py-8 sm:px-10 lg:px-12">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              const { accessToken, user } = await authService.login({
                identifier: identifier.trim(),
                password,
              });
              setAuth(accessToken, user);
              navigate("/dashboard", { replace: true });
            } catch (err) {
              setError(extractErrorMessage(err));
            } finally {
              setLoading(false);
            }
          }}
          className="mx-auto flex w-full max-w-[440px] flex-col gap-6"
        >
          <div className="flex items-center gap-3 lg:hidden animate-fade-up">
            <img src={logoMark} alt="" className="h-7 w-10 object-contain" />
            <span className="text-lg font-bold tracking-tight text-secondary-800">
              Soosky <span className="font-medium text-gray-500">HRM</span>
            </span>
          </div>

          <div className="animate-fade-up [animation-delay:80ms]">
            <h2 className="text-[28px] font-bold tracking-[-0.02em] text-gray-900 sm:text-[32px]">
              Chào mừng quay lại
            </h2>
            <p className="mt-2 text-[14.5px] text-gray-500">
              Đăng nhập với tài khoản Soosky HRM của bạn.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            {/* Identifier */}
            <div className="animate-fade-up [animation-delay:160ms]">
              <label
                htmlFor="identifier"
                className="mb-1.5 block text-[13.5px] font-medium text-gray-700"
              >
                Email hoặc tên đăng nhập
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-gray-400"
                  strokeWidth={1.7}
                />
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ten@soosky.co"
                  required
                  className="h-[52px] w-full rounded-xl border border-gray-200 bg-white pl-12 pr-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] duration-200 hover:border-gray-300 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15"
                />
              </div>
            </div>

            {/* Password */}
            <div className="animate-fade-up [animation-delay:240ms]">
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-[13.5px] font-medium text-gray-700"
                >
                  Mật khẩu
                </label>
                <a
                  href="/auth/forgot-password"
                  className="text-[13px] font-medium text-primary-600 transition hover:text-primary-700 hover:underline"
                >
                  Quên mật khẩu?
                </a>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-gray-400"
                  strokeWidth={1.7}
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-[52px] w-full rounded-xl border border-gray-200 bg-white pl-12 pr-11 text-[15px] text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] duration-200 hover:border-gray-300 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff size={18} strokeWidth={1.6} />
                  ) : (
                    <Eye size={18} strokeWidth={1.6} />
                  )}
                </button>
              </div>
            </div>

            {/* Remember */}
            <label className="cb animate-fade-up text-[13.5px] text-gray-600 [animation-delay:320ms]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span className="box">
                <Check size={12} strokeWidth={3} />
              </span>
              Ghi nhớ đăng nhập
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13.5px] text-red-600 animate-fade-in"
              >
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-shine group relative inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(0,184,245,0.55)] transition-all hover:shadow-[0_12px_32px_-8px_rgba(0,184,245,0.75)] hover:brightness-105 focus:outline-none focus:ring-[4px] focus:ring-primary-500/25 disabled:cursor-not-allowed disabled:opacity-60 animate-fade-up [animation-delay:400ms]"
          >
            <span className="relative z-10">
              {loading ? "Đang đăng nhập…" : "Đăng nhập"}
            </span>
            {!loading && (
              <span className="relative z-10 transition-transform group-hover:translate-x-1">
                <ArrowRight size={16} strokeWidth={2.2} />
              </span>
            )}
          </button>

          <p className="text-center text-[13.5px] text-gray-500 animate-fade-up [animation-delay:480ms]">
            Chưa có tài khoản?{" "}
            <a
              href="/contact"
              className="font-medium text-primary-600 transition hover:text-primary-700 hover:underline"
            >
              Liên hệ ngay
            </a>
          </p>
        </form>
      </main>
    </div>
  );
}
