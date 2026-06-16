import { useEffect, useMemo, useState } from "react";
import { Power, Shield, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/shared/utils/cn";
import { iamService } from "@features/iam/services/iam.service";
import type { AdminUser, Permission, Role } from "@features/iam/types/iam.types";

const STATUS_LABEL: Record<string, { label: string; variant: string }> = {
  active: { label: "Hoạt động", variant: "emerald" },
  disabled: { label: "Vô hiệu", variant: "slate" },
  locked: { label: "Đã khoá", variant: "rose" },
};

interface Props { canManage: boolean }

/** Users tab. */
export function UsersSettings({ canManage }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rk, setRk] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    iamService.listUsers()
      .then((u) => { if (!cancelled) { setUsers(u); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [rk]);

  function toggle(u: AdminUser) {
    setBusy(u._id);
    const next = u.status === "active" ? "disabled" : "active";
    iamService.updateUserStatus(u._id, next)
      .then(() => setRk((k) => k + 1))
      .catch(() => {})
      .finally(() => setBusy(null));
  }

  return (
    <Card className="p-6">
      <h3 className="text-[15px] font-semibold text-foreground">Tài khoản người dùng</h3>
      <p className="mb-4 mt-1 text-[12.5px] text-muted-foreground">Quản lý trạng thái đăng nhập của tài khoản hệ thống.</p>
      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted/50" />
      ) : error ? (
        <p className="py-6 text-center text-[13px] text-destructive">Không tải được danh sách người dùng.</p>
      ) : users.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Chưa có tài khoản nào.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => {
            const st = STATUS_LABEL[u.status] ?? STATUS_LABEL.disabled;
            return (
              <div key={u._id} className="flex items-center gap-3 rounded-xl border p-3">
                <Avatar className="size-9 text-[12px]"><AvatarFallback>{u.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-foreground">{u.username}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{u.email}</div>
                </div>
                {u.lastLoginAt && <span className="hidden text-[11.5px] text-muted-foreground sm:block">Đăng nhập: {u.lastLoginAt.slice(0, 10)}</span>}
                {u.status === "locked" && <Lock className="size-3.5 text-rose-500" />}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Badge variant={st.variant as any}>{st.label}</Badge>
                {canManage && u.status !== "locked" && (
                  <Button variant="ghost" size="icon" disabled={busy === u._id} onClick={() => toggle(u)}
                    title={u.status === "active" ? "Vô hiệu hoá" : "Kích hoạt"}
                    className={cn("size-8", u.status === "active" ? "text-muted-foreground hover:text-rose-600" : "text-emerald-600")}>
                    <Power className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** Roles & permissions tab (read-only matrix). */
export function RolesSettings() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([iamService.listRoles().catch(() => []), iamService.listPermissions().catch(() => [])])
      .then(([r, p]) => { if (!cancelled) { setRoles(r); setPerms(p); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of perms) {
      const arr = map.get(p.resource) ?? [];
      arr.push(p);
      map.set(p.resource, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [perms]);

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-muted/50" />;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <h3 className="mb-4 text-[15px] font-semibold text-foreground">Vai trò</h3>
        <div className="flex flex-col gap-2">
          {roles.map((r) => (
            <div key={r._id} className="flex items-center gap-3 rounded-xl border p-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600"><Shield className="size-4" /></span>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
                  {r.name}{r.isSystem && <Badge variant="slate" className="text-[10px]">Hệ thống</Badge>}
                </div>
                {r.description && <div className="text-[12px] text-muted-foreground">{r.description}</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-1 text-[15px] font-semibold text-foreground">Quyền hạn</h3>
        <p className="mb-4 text-[12.5px] text-muted-foreground">Danh sách quyền theo nhóm tài nguyên ({perms.length} quyền).</p>
        <div className="grid grid-cols-2 gap-4">
          {grouped.map(([resource, list]) => (
            <div key={resource} className="rounded-xl border p-3">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{resource}</div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((p) => (
                  <span key={p._id} className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">{p.action}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
