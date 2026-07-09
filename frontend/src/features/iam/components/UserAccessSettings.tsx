import { useEffect, useMemo, useState } from "react";
import { Power, Shield, Lock, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/shared/utils/cn";
import { iamService } from "@features/iam/services/iam.service";
import { Pagination } from "@features/settings/components/Pagination";
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    iamService.listUsers()
      .then((u) => { if (!cancelled) { setUsers(u); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [rk]);

  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = users.slice((safePage - 1) * pageSize, safePage * pageSize);

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
          {pagedUsers.map((u) => {
            const st = STATUS_LABEL[u.status] ?? STATUS_LABEL.disabled;
            return (
              <div key={u._id} className="flex items-center gap-3 rounded-xl border p-3">
                <Avatar className="size-9 text-[12px]"><AvatarFallback>{(u.employeeName || u.username).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-foreground">{u.employeeName || u.username}</span>
                    {u.employeeCode && <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">{u.employeeCode}</span>}
                    {!u.employeeId && <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-600">Không gắn NV</span>}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {u.email}{u.employeeName && <span className="text-muted-foreground/70"> · @{u.username}</span>}
                  </div>
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
          <Pagination page={safePage} pageSize={pageSize} total={users.length} unit="tài khoản" onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      )}
    </Card>
  );
}

/** Roles & permissions tab — create roles and assign permissions by resource. */
export function RolesSettings() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [rk, setRk] = useState(0);
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    Promise.all([iamService.listRoles().catch(() => []), iamService.listPermissions().catch(() => [])])
      .then(([r, p]) => { if (!cancelled) { setRoles(r); setPerms(p); setLoading(false); } });
    return () => { cancelled = true; };
  }, [rk]);

  const totalPages = Math.max(1, Math.ceil(roles.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRoles = roles.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-muted/50" />;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Vai trò & phân quyền</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Tạo vai trò và gán quyền theo nhóm tài nguyên ({perms.length} quyền).</p>
        </div>
        <Button size="sm" className="h-9 gap-1.5 rounded-lg" onClick={() => setEditing("new")}><Plus className="size-3.5" /> Tạo vai trò</Button>
      </div>
      <div className="flex flex-col gap-2">
        {pagedRoles.map((r) => (
          <div key={r._id} className="flex items-center gap-3 rounded-xl border p-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600"><Shield className="size-4" /></span>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
                {r.name}{r.isSystem && <Badge variant="slate" className="text-[10px]">Hệ thống</Badge>}
              </div>
              {r.description && <div className="text-[12px] text-muted-foreground">{r.description}</div>}
            </div>
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary-600" onClick={() => setEditing(r)} title="Sửa quyền"><Pencil className="size-4" /></Button>
            {!r.isSystem && (
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-rose-600" title="Xoá vai trò"
                onClick={() => { if (confirm(`Xoá vai trò "${r.name}"?`)) iamService.deleteRole(r._id).then(() => setRk((k) => k + 1)).catch(() => {}); }}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
        <Pagination page={safePage} pageSize={pageSize} total={roles.length} unit="vai trò" onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {editing && (
        <RoleEditor
          role={editing === "new" ? null : editing}
          perms={perms}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setRk((k) => k + 1); }}
        />
      )}
    </Card>
  );
}

const RESOURCE_LABEL: Record<string, string> = {
  user: "Người dùng", role: "Vai trò", employee: "Nhân viên",
  department: "Phòng ban", position: "Chức vụ", attendance: "Chấm công",
  leave: "Nghỉ phép", payroll: "Lương", payslip: "Phiếu lương",
  performance: "Hiệu suất", self: "Cá nhân",
};
const ACTION_LABEL: Record<string, string> = {
  read: "Xem", create: "Tạo", update: "Sửa", delete: "Xoá", approve: "Duyệt",
  compute: "Tính", "grant-login": "Cấp tài khoản", review: "Đánh giá",
};

function RoleEditor({ role, perms, onClose, onSaved }: { role: Role | null; perms: Permission[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(role === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For edit: load the role's current permissions.
  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    iamService.getRole(role._id)
      .then((r) => { if (!cancelled) { setSelected(new Set(r.permissionIds ?? [])); setReady(true); } })
      .catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [role]);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of perms) {
      const arr = map.get(p.resource) ?? [];
      arr.push(p);
      map.set(p.resource, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [perms]);

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleGroup = (list: Permission[], on: boolean) =>
    setSelected((s) => { const n = new Set(s); for (const p of list) { if (on) n.add(p._id); else n.delete(p._id); } return n; });

  function save() {
    if (!role && !name.trim()) { setError("Nhập tên vai trò."); return; }
    setSaving(true);
    setError(null);
    const permissionIds = Array.from(selected);
    const p = role
      ? iamService.updateRole(role._id, { description, permissionIds })
      : iamService.createRole({ name: name.trim(), description, permissionIds });
    p.then(() => onSaved())
      .catch((e) => setError(e?.response?.data?.error?.message ?? "Không thể lưu vai trò."))
      .finally(() => setSaving(false));
  }

  const inputCls = "h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-secondary-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-[640px] flex-col rounded-2xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-[16px] font-bold text-foreground">{role ? `Sửa quyền · ${role.name}` : "Tạo vai trò mới"}</h3>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-medium text-foreground">Tên vai trò</label>
              <input className={cn(inputCls, "mt-1.5")} value={name} disabled={!!role} onChange={(e) => setName(e.target.value)} placeholder="vd: kế toán" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground">Mô tả</label>
              <input className={cn(inputCls, "mt-1.5")} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn" />
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[12.5px] font-semibold text-foreground">Quyền theo nhóm tài nguyên</div>
            {!ready ? (
              <div className="h-32 animate-pulse rounded-xl bg-muted/50" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {grouped.map(([resource, list]) => {
                  const allOn = list.every((p) => selected.has(p._id));
                  return (
                    <div key={resource} className="rounded-xl border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{RESOURCE_LABEL[resource] ?? resource}</span>
                        <button type="button" onClick={() => toggleGroup(list, !allOn)} className="text-[11px] font-medium text-primary-600 hover:underline">
                          {allOn ? "Bỏ tất cả" : "Chọn tất cả"}
                        </button>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {list.map((p) => (
                          <label key={p._id} className="flex cursor-pointer items-center gap-2 text-[12.5px]">
                            <span className={cn("flex size-4 items-center justify-center rounded border", selected.has(p._id) ? "border-primary-500 bg-primary-500 text-white" : "border-input")}>
                              {selected.has(p._id) && <Check className="size-3" strokeWidth={3} />}
                            </span>
                            <input type="checkbox" className="sr-only" checked={selected.has(p._id)} onChange={() => toggle(p._id)} />
                            <span className="text-foreground">{ACTION_LABEL[p.action] ?? p.action}</span>
                            <span className="font-mono text-[10.5px] text-muted-foreground">{p.key}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {error && <p className="mt-4 text-[12.5px] text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Huỷ</Button>
          <Button onClick={save} disabled={saving} className="rounded-xl">{saving ? "Đang lưu…" : "Lưu"}</Button>
        </div>
      </div>
    </div>
  );
}
