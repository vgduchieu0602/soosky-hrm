import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { ArrowRight, Check, Eye, EyeOff, Sparkles } from "lucide-react";
import logoMark from "@/assets/LOGO.png";
import { useAuthStore } from "@core/store/auth.store";
import { authService } from "@features/auth/services/auth.service";
import type { ApiErrorBody } from "@features/auth/types/auth.types";

interface Feature {
  n: string;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    n: "01",
    title: "Một nơi cho mọi quy trình",
    desc: "Hồ sơ, chấm công, nghỉ phép, lương — không còn rời rạc.",
  },
  {
    n: "02",
    title: "Đúng luật, đúng kỳ",
    desc: "Tính lương, thuế và bảo hiểm theo chuẩn Việt Nam.",
  },
  {
    n: "03",
    title: "Quyết định dựa trên dữ liệu",
    desc: "Báo cáo trực quan, theo dõi hiệu suất theo thời gian thực.",
  },
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
      {/* ============== LEFT — Animated banner ============== */}
      <aside
        className="relative hidden h-full flex-[0_0_50%] flex-col overflow-hidden p-8 text-white xl:p-12 lg:flex"
        style={{
          background:
            "linear-gradient(135deg, #11295C 0%, #163985 55%, #0E2557 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full animate-aurora-1"
            style={{
              background:
                "radial-gradient(circle, rgba(0,184,245,0.45) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />
          <div
            className="absolute -right-24 top-1/3 h-[360px] w-[360px] rounded-full animate-aurora-2"
            style={{
              background:
                "radial-gradient(circle, rgba(103,219,255,0.35) 0%, transparent 70%)",
              filter: "blur(36px)",
            }}
          />
          <div
            className="absolute -bottom-24 left-1/4 h-[320px] w-[320px] rounded-full animate-aurora-3"
            style={{
              background:
                "radial-gradient(circle, rgba(54,123,255,0.40) 0%, transparent 70%)",
              filter: "blur(28px)",
            }}
          />
        </div>

        <div className="grid-bg pointer-events-none absolute inset-0" />

        <div className="relative flex items-center justify-between animate-fade-in [animation-delay:80ms]">
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

        <div className="relative my-auto">
          <div className="max-w-md">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-400/30 bg-primary-500/10 px-3 py-1 backdrop-blur-sm animate-fade-up [animation-delay:160ms]">
              <Sparkles size={12} strokeWidth={2} className="text-primary-300" />
              <span className="text-[11px] font-semibold tracking-wider text-primary-200">
                SOOSKY HRM · v2.4
              </span>
            </div>

            <h2 className="text-[100px] font-bold leading-[1.08] tracking-[-0.02em] animate-fade-up [animation-delay:240ms] xl:text-[34px]">
              Quản lý nhân sự
              <br />
              <span className="bg-gradient-to-r from-primary-300 via-primary-400 to-primary-200 bg-clip-text text-transparent">
                toàn diện
              </span>{" "}
              cho doanh nghiệp.
            </h2>

            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-white/65 animate-fade-up [animation-delay:320ms] xl:text-[15px]">
              Chấm công, nghỉ phép, bảng lương và đánh giá hiệu suất —
              tất cả gói gọn trong một nền tảng.
            </p>
          </div>

          <div className="mt-8 max-w-md xl:mt-10">
            <div className="mb-4 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white/40 animate-fade-up [animation-delay:400ms]">
              <span className="h-px w-8 bg-white/20" />
              Nền tảng của bạn
            </div>

            <div className="flex flex-col">
              {FEATURES.map((f, i) => (
                <FeatureRow
                  key={f.n}
                  n={f.n}
                  title={f.title}
                  desc={f.desc}
                  last={i === FEATURES.length - 1}
                  delayMs={400 + i * 80}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-white/40 animate-fade-in [animation-delay:480ms]">
          <span>© {new Date().getFullYear()} Soosky JSC · Hà Nội, Việt Nam</span>
          <span className="flex items-center gap-2">
            <span className="h-px w-8 bg-white/15" />
            <span className="tracking-[0.18em]">SOOSKY HRM</span>
          </span>
        </div>
      </aside>

      {/* ============== RIGHT — Form ============== */}
      <main className="flex h-full flex-1 flex-col justify-center overflow-y-auto px-6 py-8 sm:px-10 lg:px-16">
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
              navigate(
                user.mustChangePassword
                  ? "/auth/change-password"
                  : "/dashboard",
                { replace: true },
              );
            } catch (err) {
              setError(extractErrorMessage(err));
            } finally {
              setLoading(false);
            }
          }}
          className="mx-auto flex w-full max-w-sm flex-col gap-5"
        >
          <div className="flex items-center gap-3 lg:hidden animate-fade-up [animation-delay:80ms]">
            <img src={logoMark} alt="" className="h-7 w-10 object-contain" />
            <span className="text-lg font-bold tracking-tight text-secondary-800">
              Soosky <span className="font-medium text-gray-500">HRM</span>
            </span>
          </div>

          <div className="animate-fade-up [animation-delay:80ms]">
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-gray-900 sm:text-[32px]">
              Chào mừng quay lại
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Đăng nhập vào tài khoản Soosky HRM của bạn.
            </p>
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="field animate-fade-up [animation-delay:160ms]">
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder=" "
                required
              />
              <label htmlFor="identifier">Email hoặc tên đăng nhập</label>
            </div>

            <div className="flex flex-col gap-1 animate-fade-up [animation-delay:240ms]">
              <div className="field">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=" "
                  required
                  style={{ paddingRight: 44 }}
                />
                <label htmlFor="password">Mật khẩu</label>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff size={18} strokeWidth={1.5} />
                  ) : (
                    <Eye size={18} strokeWidth={1.5} />
                  )}
                </button>
              </div>
              <div className="flex justify-end">
                <a
                  href="/auth/forgot-password"
                  className="text-sm font-medium text-primary-600 transition hover:text-primary-700 hover:underline"
                >
                  Quên mật khẩu?
                </a>
              </div>
            </div>

            <label className="cb text-sm text-gray-700 animate-fade-up [animation-delay:320ms]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span className="box">
                <Check size={12} strokeWidth={3} />
              </span>
              Ghi nhớ trên thiết bị này
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
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

          <p className="text-center text-sm text-gray-500 animate-fade-up [animation-delay:480ms]">
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

interface FeatureRowProps {
  n: string;
  title: string;
  desc: string;
  last?: boolean;
  delayMs?: number;
}

function FeatureRow({
  n,
  title,
  desc,
  last = false,
  delayMs = 0,
}: FeatureRowProps) {
  return (
    <div
      className={`group relative flex items-start gap-5 py-3 animate-fade-up xl:py-4 ${
        last ? "" : "border-b border-white/10"
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="font-mono text-[13px] font-semibold tabular-nums text-primary-300/80 transition-colors group-hover:text-primary-300">
        {n}
      </span>
      <div className="flex-1">
        <div className="text-[14px] font-semibold text-white xl:text-[15px]">
          {title}
        </div>
        <div className="mt-1 text-[12px] leading-relaxed text-white/55 xl:text-[13px]">
          {desc}
        </div>
      </div>
      <span className="mt-2 h-px w-6 self-start bg-white/15 transition-all duration-300 group-hover:w-10 group-hover:bg-primary-300/60" />
    </div>
  );
}
