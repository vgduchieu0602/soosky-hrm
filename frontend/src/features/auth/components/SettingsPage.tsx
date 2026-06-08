import { useState } from "react";
import { AxiosError } from "axios";
import { KeyRound, ShieldCheck, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@core/store/auth.store";
import { authService } from "@features/auth/services/auth.service";
import type { ApiErrorBody } from "@features/auth/types/auth.types";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";

const ROLE_LABEL: Record<string, string> = {
  admin: "Quản trị viên",
  hr_manager: "Quản lý nhân sự",
  manager: "Quản lý",
  employee: "Nhân viên",
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/[\s.@]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

function extractError(err: unknown): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
  }
  return "Đổi mật khẩu thất bại. Vui lòng thử lại.";
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const displayName = user?.username ?? "Người dùng";
  const roleLabel = user?.roles?.length ? ROLE_LABEL[user.roles[0]] ?? user.roles[0] : "—";

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = current && next.length >= 8 && confirm === next && !submitting;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    setSubmitting(true);
    authService
      .changePassword({ currentPassword: current, newPassword: next })
      .then(() => {
        setDone(true);
        setCurrent(""); setNext(""); setConfirm("");
      })
      .catch((err) => setError(extractError(err)))
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Hồ sơ cá nhân"]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[760px] flex-col gap-6">
            <div>
              <h1 className="text-[26px] font-bold tracking-tight text-foreground">Hồ sơ cá nhân</h1>
              <p className="mt-1 text-[13.5px] text-muted-foreground">Quản lý thông tin tài khoản và bảo mật của bạn.</p>
            </div>

            {/* account summary */}
            <Card className="flex items-center gap-4 p-5">
              <Avatar className="size-14 text-[16px]"><AvatarFallback>{initialsFrom(displayName)}</AvatarFallback></Avatar>
              <div className="flex-1">
                <div className="text-[16px] font-semibold text-foreground">{displayName}</div>
                <div className="text-[13px] text-muted-foreground">{user?.email ?? "—"}</div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12.5px] font-medium text-foreground">
                <User className="size-3.5" /> {roleLabel}
              </span>
            </Card>

            {/* change password */}
            <Card className="p-6">
              <div className="mb-5 flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl" style={{ background: "var(--chip-blue-bg)", color: "var(--chip-blue-ink)" }}>
                  <KeyRound className="size-4.5" strokeWidth={1.9} />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-foreground">Đổi mật khẩu</h2>
                  <p className="text-[12.5px] text-muted-foreground">Nên dùng mật khẩu mạnh, tối thiểu 8 ký tự.</p>
                </div>
              </div>

              <form onSubmit={submit} className="flex max-w-[420px] flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-foreground">Mật khẩu hiện tại</span>
                  <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-10 text-[13px]" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-foreground">Mật khẩu mới</span>
                  <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="h-10 text-[13px]" />
                  {tooShort && <span className="text-[12px] text-destructive">Mật khẩu mới cần tối thiểu 8 ký tự.</span>}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-foreground">Xác nhận mật khẩu mới</span>
                  <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-10 text-[13px]" />
                  {mismatch && <span className="text-[12px] text-destructive">Mật khẩu xác nhận không khớp.</span>}
                </label>

                {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">{error}</p>}
                {done && (
                  <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">
                    <ShieldCheck className="size-4" /> Đổi mật khẩu thành công.
                  </p>
                )}

                <div>
                  <Button type="submit" disabled={!canSubmit} className="rounded-xl">
                    {submitting ? "Đang lưu…" : "Cập nhật mật khẩu"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
