import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail } from "lucide-react";
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

const inputCls =
  "h-[50px] w-full rounded-[10px] border border-gray-200 bg-white pl-11 pr-11 text-[15px] text-gray-900 placeholder:text-gray-400 transition-colors duration-150 hover:border-gray-300 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10";

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
      {/* ============== LEFT — Brand panel (flat navy) ============== */}
      <aside className="relative hidden h-full flex-[0_0_52%] flex-col overflow-hidden bg-[#11295C] p-10 text-white lg:flex xl:p-16">
        {/* top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoMark} alt="" className="h-7 w-10 object-contain" />
            <span className="text-lg font-semibold tracking-tight">
              Soosky <span className="font-normal opacity-60">HRM</span>
            </span>
          </div>
        </div>

        {/* center tagline */}
        <div className="my-auto max-w-xl">
          <h1 className="text-[36px] font-semibold leading-[1.15] tracking-[-0.02em] xl:text-[44px]">
            Quản lý nhân sự toàn diện
            <br />
            cho doanh nghiệp.
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
            Chấm công, nghỉ phép, bảng lương và đánh giá hiệu suất — tất cả gói
            gọn trong một nền tảng, đúng chuẩn Việt Nam.
          </p>

          {/* trust stats */}
          <div className="mt-10 flex items-center gap-8">
            {STATS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-8">
                {i > 0 && <span className="h-10 w-px bg-white/10" />}
                <div>
                  <div className="text-[26px] font-semibold leading-none tabular-nums">
                    {s.value}
                  </div>
                  <div className="mt-1.5 text-[12px] text-white/40">
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between text-xs text-white/35">
          <span>© {new Date().getFullYear()} Soosky JSC · Hà Nội, Việt Nam</span>
          <span className="tracking-[0.18em]">SOOSKY HRM</span>
        </div>
      </aside>

      {/* ============== RIGHT — Form ============== */}
      <main className="flex h-full flex-1 flex-col justify-center overflow-y-auto bg-white px-6 py-8 sm:px-10 lg:px-12">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              const { accessToken, refreshToken, user } = await authService.login({
                identifier: identifier.trim(),
                password,
              });
              setAuth(accessToken, refreshToken, user);
              navigate(user.mustChangePassword ? "/auth/change-password" : "/dashboard", {
                replace: true,
              });
            } catch (err) {
              setError(extractErrorMessage(err));
            } finally {
              setLoading(false);
            }
          }}
          className="mx-auto flex w-full max-w-[420px] flex-col gap-6"
        >
          <div className="flex items-center gap-3 lg:hidden">
            <img src={logoMark} alt="" className="h-7 w-10 object-contain" />
            <span className="text-lg font-semibold tracking-tight text-secondary-800">
              Soosky <span className="font-normal text-gray-500">HRM</span>
            </span>
          </div>

          <div>
            <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-gray-900 sm:text-[28px]">
              Chào mừng quay lại
            </h2>
            <p className="mt-1.5 text-[14px] text-gray-500">
              Đăng nhập với tài khoản Soosky HRM của bạn.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {/* Identifier */}
            <div>
              <label
                htmlFor="identifier"
                className="mb-1.5 block text-[13px] font-medium text-gray-700"
              >
                Email hoặc tên đăng nhập
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-gray-400"
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
                  className={inputCls}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-[13px] font-medium text-gray-700"
                >
                  Mật khẩu
                </label>
                <a
                  href="/auth/forgot-password"
                  className="text-[13px] font-medium text-primary-600 transition-colors duration-150 hover:text-primary-700"
                >
                  Quên mật khẩu?
                </a>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-gray-400"
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
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff size={17} strokeWidth={1.6} />
                  ) : (
                    <Eye size={17} strokeWidth={1.6} />
                  )}
                </button>
              </div>
            </div>

            {/* Remember */}
            <label className="cb text-[13px] text-gray-600">
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
                className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-600"
              >
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary-600 px-4 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-primary-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
            {!loading && <ArrowRight size={16} strokeWidth={2.2} />}
          </button>

          <p className="text-center text-[13px] text-gray-500">
            Chưa có tài khoản?{" "}
            <a
              href="/contact"
              className="font-medium text-primary-600 transition-colors duration-150 hover:text-primary-700"
            >
              Liên hệ ngay
            </a>
          </p>
        </form>
      </main>
    </div>
  );
}
