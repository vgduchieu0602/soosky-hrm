import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Check, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/shared/utils/cn";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import type { ChipColor } from "@features/dashboard/data";
import { useAuthStore } from "@core/store/auth.store";
import { attendanceService } from "@features/attendance/services/attendance.service";
import type {
  LeaveBalanceRecord,
  LeaveRequestRecord,
  LeaveTypeKey,
} from "@features/attendance/types/attendance.types";
import { LEAVE_TYPE_META, LEAVE_STATUS_META } from "@features/attendance/attendance.constants";

const chip = (c: ChipColor): CSSProperties => ({ background: `var(--chip-${c}-bg)`, color: `var(--chip-${c}-ink)` });
const fmt = (iso?: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

function TypeChip({ type }: { type: LeaveTypeKey }) {
  const t = LEAVE_TYPE_META[type];
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" style={chip(t.color)}>{t.label}</span>;
}
function StatusChip({ status }: { status: LeaveRequestRecord["status"] }) {
  const s = LEAVE_STATUS_META[status];
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" style={chip(s.variant as ChipColor)}>{s.label}</span>;
}

export default function LeavePage() {
  const user = useAuthStore((s) => s.user);
  const isManager = (user?.roles ?? []).some((r) => r === "admin" || r === "hr_manager");
  return isManager ? <ManagerLeave /> : <EmployeeLeave />;
}

/* ---------------- Manager / HR view ---------------- */
function ManagerLeave() {
  const [list, setList] = useState<LeaveRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<LeaveRequestRecord | null>(null);

  useEffect(() => {
    let active = true;
    attendanceService
      .adminLeaves()
      .then((r) => { if (active) { setList(r); setLoading(false); } })
      .catch(() => { if (active) { setList([]); setLoading(false); } });
    return () => { active = false; };
  }, [reloadKey]);

  const pending = list.filter((r) => r.status === "pending");
  const history = list.filter((r) => r.status !== "pending");

  function approve(id: string) {
    setBusy(id);
    attendanceService.approveLeave(id).then(() => setReloadKey((k) => k + 1)).finally(() => setBusy(null));
  }

  return (
    <Shell crumb="Nghỉ phép" title="Duyệt đơn nghỉ" subtitle="Phê duyệt đơn và theo dõi lịch sử.">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b p-4">
          <h3 className="text-[14px] font-semibold text-foreground">Đơn chờ duyệt</h3>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{pending.length}</span>
        </div>
        <ul className="flex flex-col">
          {pending.map((r) => (
            <li key={r._id} className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-0">
              <Avatar className="size-10 text-[12px]"><AvatarFallback>{(r.fullName ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="text-[13.5px] font-semibold text-foreground">{r.fullName ?? r.employeeCode}</span><span className="font-mono text-[11px] text-muted-foreground">{r.employeeCode}</span></div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                  <TypeChip type={r.leaveType} />
                  <span className="tabular-nums text-foreground/80">{fmt(r.startDate)}{r.days > 1 ? ` → ${fmt(r.endDate)}` : ""}</span>
                  <span>· {r.days} ngày{r.halfDaySession ? ` (${r.halfDaySession === "morning" ? "sáng" : "chiều"})` : ""}</span>
                </div>
                {r.reason && <div className="mt-0.5 truncate text-[12px] text-muted-foreground/80">{r.reason}</div>}
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="icon" disabled={busy === r._id} className="size-8 rounded-lg hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" onClick={() => setRejectFor(r)} aria-label="Từ chối"><X className="size-4" strokeWidth={2} /></Button>
                <Button size="icon" disabled={busy === r._id} className="size-8 rounded-lg bg-emerald-500 hover:bg-emerald-600" onClick={() => approve(r._id)} aria-label="Phê duyệt"><Check className="size-4" strokeWidth={2.4} /></Button>
              </div>
            </li>
          ))}
          {!loading && pending.length === 0 && <li className="px-4 py-12 text-center text-[13px] text-muted-foreground">Không có đơn chờ duyệt.</li>}
          {loading && <li className="px-4 py-12 text-center text-[13px] text-muted-foreground">Đang tải…</li>}
        </ul>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b p-4"><h3 className="text-[14px] font-semibold text-foreground">Lịch sử đơn nghỉ</h3></div>
        <table className="w-full border-collapse text-[13px]">
          <thead><tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 text-left">Nhân viên</th><th className="px-4 py-3 text-left">Loại</th><th className="px-4 py-3 text-left">Thời gian</th><th className="px-4 py-3 text-right">Ngày</th><th className="px-4 py-3 text-left">Trạng thái</th>
          </tr></thead>
          <tbody>
            {history.map((r) => (
              <tr key={r._id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3"><div className="font-semibold text-foreground">{r.fullName ?? r.employeeCode}</div><div className="font-mono text-[11px] text-muted-foreground">{r.employeeCode}</div></td>
                <td className="px-4 py-3"><TypeChip type={r.leaveType} /></td>
                <td className="px-4 py-3 tabular-nums text-foreground/80">{fmt(r.startDate)}{r.days > 1 ? ` → ${fmt(r.endDate)}` : ""}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.days}</td>
                <td className="px-4 py-3"><StatusChip status={r.status} /></td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-muted-foreground">Chưa có đơn.</td></tr>}
          </tbody>
        </table>
      </Card>

      {rejectFor && (
        <RejectModal
          request={rejectFor}
          onClose={() => setRejectFor(null)}
          onDone={() => { setRejectFor(null); setReloadKey((k) => k + 1); }}
        />
      )}
    </Shell>
  );
}

function RejectModal({ request, onClose, onDone }: { request: LeaveRequestRecord; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function submit() {
    if (!reason.trim()) { setError("Nhập lý do từ chối."); return; }
    setBusy(true);
    attendanceService.rejectLeave(request._id, reason.trim()).then(() => onDone()).catch((e) => setError(e?.response?.data?.error?.message ?? "Không thể từ chối.")).finally(() => setBusy(false));
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-secondary-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-[420px] rounded-2xl bg-background p-6 shadow-2xl">
        <h3 className="text-[16px] font-bold text-foreground">Từ chối đơn nghỉ</h3>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{request.fullName ?? request.employeeCode}</p>
        <textarea className="mt-4 h-24 w-full rounded-lg border border-input bg-card p-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do từ chối…" />
        {error && <p className="mt-2 text-[12.5px] text-destructive">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Huỷ</Button>
          <Button onClick={submit} disabled={busy} className="rounded-xl bg-rose-500 hover:bg-rose-600">{busy ? "Đang gửi…" : "Từ chối"}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Employee view ---------------- */
function EmployeeLeave() {
  const [list, setList] = useState<LeaveRequestRecord[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([attendanceService.myLeaves(), attendanceService.myBalances()])
      .then(([l, b]) => { if (active) { setList(l); setBalances(b); setLoading(false); } })
      .catch(() => { if (active) { setLoading(false); } });
    return () => { active = false; };
  }, [reloadKey]);

  return (
    <Shell crumb="Nghỉ phép" title="Nghỉ phép của tôi" subtitle="Gửi đơn nghỉ và theo dõi trạng thái." action={
      <Button size="sm" className="h-9 gap-2 rounded-full text-[13px]" onClick={() => setOpen(true)}><Plus className="size-3.5" strokeWidth={2} /> Tạo đơn nghỉ</Button>
    }>
      {balances.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {balances.map((b) => {
            const t = LEAVE_TYPE_META[b.leaveType];
            return (
              <Card key={b._id} className="p-4">
                <TypeChip type={b.leaveType} />
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-[20px] font-bold tabular-nums text-foreground">{b.entitled ? b.entitled - b.used : "∞"}</span>
                  <span className="text-[12px] text-muted-foreground">/ {b.entitled || "∞"} ngày còn lại</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Đã dùng <b className="text-foreground/80 tabular-nums">{b.used}</b> · <span style={{ color: `var(--chip-${t.color}-ink)` }}>●</span></div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b p-4"><h3 className="text-[14px] font-semibold text-foreground">Đơn của tôi</h3></div>
        <table className="w-full border-collapse text-[13px]">
          <thead><tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 text-left">Loại</th><th className="px-4 py-3 text-left">Thời gian</th><th className="px-4 py-3 text-right">Ngày</th><th className="px-4 py-3 text-left">Trạng thái</th><th className="px-4 py-3" />
          </tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r._id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3"><TypeChip type={r.leaveType} /></td>
                <td className="px-4 py-3 tabular-nums text-foreground/80">{fmt(r.startDate)}{r.days > 1 ? ` → ${fmt(r.endDate)}` : ""}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.days}</td>
                <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                <td className="px-4 py-3 text-right">
                  {r.status === "pending" && (
                    <Button variant="outline" size="sm" className="h-7 rounded-lg text-[12px]" onClick={() => attendanceService.cancelLeave(r._id).then(() => setReloadKey((k) => k + 1))}>Huỷ</Button>
                  )}
                  {r.status === "rejected" && r.rejectionReason && <span className="text-[12px] text-muted-foreground">{r.rejectionReason}</span>}
                </td>
              </tr>
            ))}
            {!loading && list.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-muted-foreground">Bạn chưa có đơn nghỉ nào.</td></tr>}
            {loading && <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-muted-foreground">Đang tải…</td></tr>}
          </tbody>
        </table>
      </Card>

      {open && <SubmitLeaveModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); setReloadKey((k) => k + 1); }} />}
    </Shell>
  );
}

function SubmitLeaveModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [leaveType, setLeaveType] = useState<LeaveTypeKey>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [half, setHalf] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputCls = "h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

  function submit() {
    if (!startDate || !endDate) { setError("Chọn ngày bắt đầu và kết thúc."); return; }
    setBusy(true);
    setError(null);
    attendanceService
      .submitLeave({
        leaveType,
        startDate,
        endDate,
        halfDaySession: half ? (half as "morning" | "afternoon") : null,
        reason: reason || undefined,
      })
      .then(() => onDone())
      .catch((e) => setError(e?.response?.data?.error?.message ?? "Không thể gửi đơn."))
      .finally(() => setBusy(false));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-secondary-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-[440px] rounded-2xl bg-background p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        <h3 className="text-[16px] font-bold text-foreground">Tạo đơn nghỉ</h3>
        <div className="mt-4 flex flex-col gap-3.5">
          <div>
            <label className="text-[12px] font-medium text-foreground">Loại nghỉ</label>
            <select className={cn(inputCls, "mt-1.5")} value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveTypeKey)}>
              {(Object.keys(LEAVE_TYPE_META) as LeaveTypeKey[]).map((k) => <option key={k} value={k}>{LEAVE_TYPE_META[k].label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12px] font-medium text-foreground">Từ ngày</label><input type="date" className={cn(inputCls, "mt-1.5")} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label className="text-[12px] font-medium text-foreground">Đến ngày</label><input type="date" className={cn(inputCls, "mt-1.5")} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground">Nửa ngày (tuỳ chọn)</label>
            <select className={cn(inputCls, "mt-1.5")} value={half} onChange={(e) => setHalf(e.target.value)}>
              <option value="">— Cả ngày —</option><option value="morning">Buổi sáng</option><option value="afternoon">Buổi chiều</option>
            </select>
          </div>
          <div><label className="text-[12px] font-medium text-foreground">Lý do</label><input className={cn(inputCls, "mt-1.5")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tuỳ chọn" /></div>
          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Huỷ</Button>
          <Button onClick={submit} disabled={busy} className="rounded-xl">{busy ? "Đang gửi…" : "Gửi đơn"}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Shared shell ---------------- */
function Shell({ crumb, title, subtitle, action, children }: { crumb: string; title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="leave" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", crumb]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">{title}</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">{subtitle}</p>
              </div>
              {action}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
