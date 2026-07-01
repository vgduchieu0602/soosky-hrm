import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@core/store/auth.store";
import { authService } from "@features/auth/services/auth.service";
import type { ApiErrorBody } from "@features/auth/types/auth.types";

function extractError(err: unknown): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
  }
  return "Đổi mật khẩu thất bại. Vui lòng thử lại.";
}

/**
 * Forced first-login password change. Reached when `mustChangePassword=true`
 * (from login redirect, the MustChangePasswordRoute guard, or an IAM_013 API
 * rejection). The change-password endpoint is server-allowlisted so it works
 * even while every other API is blocked.
 */
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Not authenticated → back to login. Already resolved → nothing to force here.
  if (!token) return <Navigate to="/auth/login" replace />;
  if (user && !user.mustChangePassword) return <Navigate to="/dashboard" replace />;

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && confirm !== next;
  const sameAsOld = next.length > 0 && next === current;
  const canSubmit = !!current && next.length >= 8 && confirm === next && !sameAsOld && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authService.changePassword({ currentPassword: current, newPassword: next });
      if (user) setUser({ ...user, mustChangePassword: false });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#FBFCFE] px-4">
      <div className="w-full max-w-[440px] rounded-2xl border border-gray-100 bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <h1 className="text-[22px] font-bold tracking-tight text-gray-900">Đổi mật khẩu</h1>
          <p className="mt-1.5 text-[13.5px] text-gray-500">
            Vì lý do bảo mật, bạn cần đặt mật khẩu mới trước khi tiếp tục sử dụng hệ thống.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Mật khẩu hiện tại" value={current} onChange={setCurrent} autoComplete="current-password" />
          <div>
            <Field label="Mật khẩu mới" value={next} onChange={setNext} autoComplete="new-password" />
            {tooShort && <p className="mt-1 text-xs text-destructive">Mật khẩu tối thiểu 8 ký tự.</p>}
            {sameAsOld && <p className="mt-1 text-xs text-destructive">Mật khẩu mới phải khác mật khẩu hiện tại.</p>}
          </div>
          <div>
            <Field label="Xác nhận mật khẩu mới" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {mismatch && <p className="mt-1 text-xs text-destructive">Xác nhận không khớp.</p>}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-destructive">{error}</div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 text-[14.5px] font-semibold text-white transition-colors duration-200 hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {submitting ? "Đang cập nhật…" : "Đổi mật khẩu & tiếp tục"}
          </button>
        </form>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}

function Field({ label, value, onChange, autoComplete }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-gray-700">{label}</span>
      <input
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-[14.5px] text-gray-900 transition-[border-color,box-shadow] duration-200 hover:border-gray-300 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15"
      />
    </label>
  );
}
