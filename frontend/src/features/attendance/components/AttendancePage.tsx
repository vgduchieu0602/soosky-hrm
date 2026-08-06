import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Search, ChevronDown, Check, Users, Clock, CalendarDays, X, Lock, LockOpen, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TimeInput } from "@/components/ui/time-input";
import { cn } from "@/shared/utils/cn";
import { fmtPeriodName } from "@/shared/utils/period.utils";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import type { ChipColor } from "@features/dashboard/data";
import { attendanceService } from "@features/attendance/services/attendance.service";
import { payrollService } from "@features/payroll/services/payroll.service";
import { apiErrorMessage } from "@shared/utils/apiError";
import { CreatePeriodDialog } from "@features/payroll/components/CreatePeriodDialog";
import type { CreatePeriodInput, PayrollPeriod } from "@features/payroll/types/payroll.types";
import type {
  AdminGrid,
  AttendanceRecord,
  AttendanceStatus,
  RosterEmployee,
  ShiftOption,
} from "@features/attendance/types/attendance.types";
import {
  STATUS_META,
  MONTH_OPTIONS,
  monthDays,
  recordDateKey,
  hhmmVN,
  vnInstant,
} from "@features/attendance/attendance.constants";

const chipStyle = (color: ChipColor): CSSProperties => ({
  background: `var(--chip-${color}-bg)`,
  color: `var(--chip-${color}-ink)`,
});

const ALL = "Tất cả";

function StatCard({ chip, icon: Icon, label, value }: { chip: ChipColor; icon: typeof Users; label: string; value: ReactNode }) {
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <span className="flex size-11 items-center justify-center rounded-2xl" style={chipStyle(chip)}>
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <div className="text-[22px] font-bold leading-none tabular-nums text-foreground">{value}</div>
        <div className="mt-1 text-[12px] text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} className="h-9 gap-2 rounded-full text-[13px]">
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-semibold">{cur?.label ?? value}</span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-30 max-h-[280px] min-w-[170px] overflow-y-auto rounded-xl border bg-card p-1.5 shadow-md">
            {options.map((o) => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] hover:bg-muted", value === o.value && "font-semibold text-primary-600")}>
                {o.label}
                {value === o.value && <Check className="size-3.5" strokeWidth={2.4} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface EditTarget {
  employee: RosterEmployee;
  dateKey: string;
  records: Record<string, AttendanceRecord>; // keyed by shiftId
}

/**
 * Workflow bar: attendance is where the monthly period is BORN. One period
 * (stored "YYYY-MM", shown "MM-YYYY") is shared by attendance, evaluations and
 * payroll. Create/delete the period here, lock attendance here; once
 * evaluations are locked too (Đánh giá page), payroll auto-computes.
 */
function PeriodWorkflowBar({ month }: { month: string }) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [busy, setBusy] = useState(false);
  const [rk, setRk] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmLock, setConfirmLock] = useState<{ message: string } | null>(null);

  useEffect(() => {
    let active = true;
    payrollService.listPeriods()
      .then((ps) => { if (active) setPeriods(ps); })
      // Thanh quy trình kỳ lương không tải được thì HR không biết kỳ đã chốt hay
      // chưa — báo ra thay vì để thanh trống như thể chưa có kỳ nào.
      .catch((error) => { if (active) fail(error, "Không tải được kỳ lương."); });
    return () => { active = false; };
  }, [rk]);

  const period = periods.find((p) => p.name === month);
  const attLocked = !!period?.attendanceLockedAt;
  const evalLocked = !!period?.evaluationLockedAt;
  const finalized = period?.status === "closed" || period?.status === "paid";

  function fail(e: unknown, fallback: string) {
    toast.error(apiErrorMessage(e, fallback));
  }

  async function handleCreate(input: CreatePeriodInput) {
    await payrollService.createPeriod(input);
    toast.success(`Đã tạo kỳ ${fmtPeriodName(input.name)} — dùng chung cho chấm công, đánh giá và bảng lương`);
    setRk((k) => k + 1);
  }

  function deletePeriod() {
    if (!period) return;
    if (!window.confirm(`Xoá kỳ ${fmtPeriodName(period.name)}? Chỉ xoá được khi kỳ chưa có bảng lương.`)) return;
    setBusy(true);
    payrollService.deletePeriod(period._id)
      .then(() => { toast.success("Đã xoá kỳ"); setRk((k) => k + 1); })
      .catch((e) => fail(e, "Không xoá được kỳ (có thể đã có bảng lương)."))
      .finally(() => setBusy(false));
  }

  // Open the confirm modal for chốt chấm công. Locking never fails on
  // incomplete attendance (backend only blocks a paid period) — the modal just
  // warns which employees are still missing records; HR may lock anyway.
  function openLockConfirm() {
    if (!period) return;
    payrollService.attendanceReadiness(period._id)
      .then((r) => {
        const gaps: string[] = [];
        if (r.employeesNoRecords > 0) gaps.push(`${r.employeesNoRecords}/${r.totalActiveEmployees} nhân viên CHƯA có bản ghi chấm công`);
        if (r.incompleteRecords > 0) gaps.push(`${r.incompleteRecords} bản ghi còn thiếu giờ ra (không tính công)`);
        const warn = gaps.length ? `Còn: ${gaps.join("; ")}.\n\nVẫn có thể chốt — phần chưa chấm sẽ tính là thiếu công.\n\n` : "";
        setConfirmLock({ message: `${warn}Chốt chấm công kỳ ${fmtPeriodName(period.name)}? Sau khi chốt sẽ không sửa được bảng công của kỳ này (mở chốt lại nếu cần sửa).` });
      })
      .catch(() => setConfirmLock({ message: `Chốt chấm công kỳ ${fmtPeriodName(period.name)}? Sau khi chốt sẽ không sửa được bảng công của kỳ này.` }));
  }

  function doLockAttendance() {
    if (!period) return;
    setBusy(true);
    payrollService.lockAttendance(period._id)
      .then(({ autoRunning }) => {
        toast.success("Đã chốt chấm công");
        if (autoRunning) {
          toast.info("Đủ 2 chốt — bảng lương đang được tính ở chế độ nền. Mở trang Bảng lương sau giây lát để xem.");
        }
        setConfirmLock(null);
        setRk((k) => k + 1);
      })
      .catch((e) => fail(e, "Không chốt được chấm công."))
      .finally(() => setBusy(false));
  }

  function unlockAttendance() {
    if (!period) return;
    // Backend đòi lý do và ghi audit kèm lý do đó — hỏi thẳng người dùng.
    const reason = window.prompt("Lý do mở chốt chấm công? (bắt buộc, sẽ ghi vào nhật ký)")?.trim();
    if (reason == null || reason === "") return;

    setBusy(true);
    payrollService.unlockAttendance(period._id, reason)
      .then(() => { toast.success("Đã mở chốt chấm công"); setRk((k) => k + 1); })
      .catch((e) => fail(e, "Không mở chốt được."))
      .finally(() => setBusy(false));
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-primary-100 bg-primary-50/40 p-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-semibold text-foreground">Kỳ {fmtPeriodName(month)}</span>
        {!period && <Badge variant="amber">Chưa tạo kỳ</Badge>}
        {period && <Badge variant={finalized ? "slate" : "blue"}>{period.status === "paid" ? "Đã chi" : period.status === "closed" ? "Đã chốt kỳ" : "Đang mở"}</Badge>}
        {period && <Badge variant={attLocked ? "emerald" : "amber"}>{attLocked ? "✓ Đã chốt chấm công" : "Chưa chốt chấm công"}</Badge>}
        {period && <Badge variant={evalLocked ? "emerald" : "amber"}>{evalLocked ? "✓ Đã chốt đánh giá" : "Chưa chốt đánh giá"}</Badge>}
        <span className="text-muted-foreground">
          {!period
            ? "Tạo kỳ tại đây — kỳ dùng chung cho chấm công, đánh giá và bảng lương."
            : attLocked && evalLocked
              ? "Đủ 2 chốt — bảng lương đã tự tính. Xem tại trang Bảng lương."
              : "Chốt chấm công ở đây + chốt đánh giá ở trang Đánh giá → bảng lương tự tính."}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {!period && (
          <Button size="sm" disabled={busy} onClick={() => setCreateOpen(true)} className="h-8 gap-1.5 rounded-full text-[12.5px]">
            <Plus className="size-3.5" /> Tạo kỳ
          </Button>
        )}
        {period && !finalized && (
          attLocked ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={unlockAttendance} className="h-8 gap-1.5 rounded-full text-[12.5px]">
              <LockOpen className="size-3.5" /> Mở chốt chấm công
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={openLockConfirm} className="h-8 gap-1.5 rounded-full text-[12.5px]">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />} Chốt chấm công
            </Button>
          )
        )}
        {period && !finalized && (
          <Button size="sm" variant="outline" disabled={busy} onClick={deletePeriod}
            className="h-8 gap-1.5 rounded-full text-[12.5px] text-rose-600 hover:border-rose-200 hover:bg-rose-50">
            <Trash2 className="size-3.5" /> Xoá kỳ
          </Button>
        )}
      </div>
      <CreatePeriodDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate} />
      <ConfirmDialog
        open={!!confirmLock}
        title="Chốt chấm công kỳ"
        message={confirmLock?.message}
        confirmLabel="Vẫn chốt chấm công"
        loading={busy}
        onConfirm={doLockAttendance}
        onCancel={() => setConfirmLock(null)}
      />
    </Card>
  );
}

export default function AttendancePage() {
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [dept, setDept] = useState(ALL);
  const [q, setQ] = useState("");
  const [grid, setGrid] = useState<AdminGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [display, setDisplay] = useState<"dot" | "text">(
    () => (localStorage.getItem("att-display") as "dot" | "text") || "dot",
  );
  function pickDisplay(m: "dot" | "text") { setDisplay(m); localStorage.setItem("att-display", m); }

  useEffect(() => {
    let active = true;
    attendanceService
      .adminGrid({ month })
      .then((g) => { if (active) { setGrid(g); setLoading(false); } })
      .catch(() => { if (active) { setGrid({ month, employees: [], shifts: [], records: [] }); setLoading(false); } });
    return () => { active = false; };
  }, [month, reloadKey]);

  // Ký hiệu chấm công trong Cài đặt là danh mục MÔ TẢ (mã + tên): backend không
  // gắn nó vào trạng thái nào, nên nhãn/màu trên lưới lấy từ `STATUS_META` cố
  // định, còn danh mục chỉ hiển thị để đối chiếu.
  const meta = (st: AttendanceStatus) => STATUS_META[st];

  const days = useMemo(() => monthDays(month), [month]);
  const shifts = useMemo(() => grid?.shifts ?? [], [grid]);

  const recordMap = useMemo(() => {
    const m = new Map<string, AttendanceRecord>();
    for (const r of grid?.records ?? []) {
      if (r.shiftId) m.set(`${r.employeeId}_${recordDateKey(r.date)}_${r.shiftId}`, r);
    }
    return m;
  }, [grid]);

  // Per-employee monthly roll-up computed straight from the grid records.
  const summaryMap = useMemo(() => {
    const W: Record<string, number> = { full_day: 1, morning: 0.5, afternoon: 0.5 };
    const m = new Map<string, { work: number; leave: number; holiday: number; regime: number }>();
    for (const r of grid?.records ?? []) {
      const cur = m.get(r.employeeId) ?? { work: 0, leave: 0, holiday: 0, regime: 0 };
      // Prefer the per-record công (1/số ca) stored by the server; fall back to
      // the session weight for legacy/leave rows.
      const w = r.congWeight ?? W[r.session] ?? 1;
      if (r.status === "present" || r.status === "late" || r.status === "early_leave") cur.work += w;
      else if (r.status === "leave_paid") cur.leave += w;
      else if (r.status === "holiday") cur.holiday += w;
      else if (r.status === "leave_unpaid") cur.regime += w;
      m.set(r.employeeId, cur);
    }
    return m;
  }, [grid]);
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const deptOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of grid?.employees ?? []) if (e.departmentName) set.add(e.departmentName);
    return [ALL, ...Array.from(set).sort()];
  }, [grid]);

  const rows = useMemo(
    () =>
      (grid?.employees ?? []).filter((e) => {
        if (dept !== ALL && e.departmentName !== dept) return false;
        if (q && !`${e.fullName} ${e.employeeCode}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [grid, dept, q],
  );

  const stats = useMemo(() => {
    let late = 0;
    let leave = 0;
    for (const r of grid?.records ?? []) {
      if (r.status === "late") late += 1;
      if (r.status === "leave_paid") leave += 1;
    }
    return { people: grid?.employees.length ?? 0, late, leave };
  }, [grid]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="att" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Chấm công"]} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Chấm công</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  {shifts.length} ca/ngày (cấu hình tại Cài đặt). Bấm ô để nhập giờ vào–ra theo từng ca.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select label="Tháng" value={month} options={MONTH_OPTIONS} onChange={setMonth} />
                <Select label="Phòng ban" value={dept} options={deptOptions.map((d) => ({ value: d, label: d }))} onChange={setDept} />
              </div>
            </div>

            <PeriodWorkflowBar month={month} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard chip="blue" icon={Users} label="Nhân sự" value={stats.people} />
              <StatCard chip="amber" icon={Clock} label="Lượt đi muộn" value={stats.late} />
              <StatCard chip="violet" icon={CalendarDays} label="Lượt nghỉ phép" value={stats.leave} />
            </div>

            {shifts.length === 0 && !loading && (
              <Card className="p-4 text-[13px] text-muted-foreground">
                Chưa cấu hình ca làm. Vào <b className="text-foreground">Cài đặt → Chấm công</b> để thêm ca trước khi chấm công.
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã NV…" className="h-9 pl-10 text-[13px]" />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
                  {(["present", "late", "leave_paid", "holiday", "absent"] as const).map((k) => {
                    const mk = meta(k);
                    return (
                    <span key={k} className="inline-flex items-center gap-1.5">
                      {display === "dot" ? (
                        <span className="block size-2 rounded-full" style={{ background: `var(--chip-${mk.color}-ink)` }} />
                      ) : (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-bold" style={{ background: `var(--chip-${mk.color}-bg)`, color: `var(--chip-${mk.color}-ink)` }}>{mk.code}</span>
                      )}
                      <span className="text-muted-foreground">{mk.label}</span>
                    </span>
                    );
                  })}
                </div>
                {/* Display mode: dot vs text (code) */}
                <div className="inline-flex overflow-hidden rounded-lg border text-[12px]">
                  <button type="button" onClick={() => pickDisplay("dot")} className={cn("px-2.5 py-1 transition", display === "dot" ? "bg-primary-500 text-white" : "text-muted-foreground hover:bg-muted")}>Chấm</button>
                  <button type="button" onClick={() => pickDisplay("text")} className={cn("px-2.5 py-1 transition", display === "text" ? "bg-primary-500 text-white" : "text-muted-foreground hover:bg-muted")}>Chữ</button>
                </div>
              </div>

              <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
                <table className="border-separate text-[12px]" style={{ borderSpacing: 0, minWidth: "100%" }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-30 bg-card px-5 py-3 text-left align-bottom text-[11px] font-medium tracking-wide text-muted-foreground" style={{ minWidth: 210 }}>
                        NHÂN VIÊN
                      </th>
                      {days.map((d) => (
                        <th key={d.key} className="sticky top-0 z-20 bg-card px-0 py-2 text-center align-bottom" style={{ minWidth: 34 }}>
                          <div className={cn("text-[9.5px] font-medium uppercase leading-none", d.weekend ? "text-rose-400" : "text-muted-foreground/70")}>{d.weekday}</div>
                          <div className={cn("mt-0.5 text-[12px] font-semibold leading-none tabular-nums", d.weekend ? "text-rose-400" : "text-foreground/70")}>{d.day}</div>
                        </th>
                      ))}
                      {SUMMARY_COLS.map((c, i) => (
                        <th key={c.key} className={cn("sticky top-0 z-20 bg-muted/40 px-2 py-2 align-bottom text-center text-[10px] font-semibold leading-tight text-muted-foreground", i === 0 && "border-l-2 border-border")} style={{ minWidth: 58 }}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e._id} className="group transition-colors hover:bg-slate-50 [&>td]:border-b [&>td]:border-border/40">
                        <td className="sticky left-0 z-10 bg-card px-5 py-2.5 transition-colors group-hover:bg-slate-50" style={{ boxShadow: "1px 0 0 0 var(--border)" }}>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8 text-[11px]"><AvatarFallback>{e.fullName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium text-foreground">{e.fullName || e.employeeCode}</div>
                              <div className="truncate text-[11px] text-muted-foreground/80"><span className="font-mono">{e.employeeCode}</span> · {e.departmentName}</div>
                            </div>
                          </div>
                        </td>
                        {days.map((d) => {
                          const records: Record<string, AttendanceRecord> = {};
                          for (const s of shifts) {
                            const r = recordMap.get(`${e._id}_${d.key}_${s._id}`);
                            if (r) records[s._id] = r;
                          }
                          const title = shifts
                            .filter((s) => records[s._id])
                            .map((s) => `${s.name}: ${meta(records[s._id]!.status).label}`)
                            .join(" · ");
                          return (
                            <td key={d.key} className={cn("px-0 py-2 text-center", d.weekend && "bg-slate-50/40")}>
                              <button
                                onClick={() => setEdit({ employee: e, dateKey: d.key, records })}
                                className="press inline-flex h-7 items-center justify-center gap-0.5 rounded-full px-1 transition-colors hover:bg-muted"
                                title={title || "Chưa chấm"}
                              >
                                {shifts.length === 0 ? (
                                  <span className="block size-2 rounded-full opacity-0" />
                                ) : (
                                  shifts.map((s) => {
                                    const rec = records[s._id];
                                    const cm = rec ? meta(rec.status) : null;
                                    if (!cm) return <span key={s._id} className="block size-2 rounded-full opacity-0 ring-1 ring-inset ring-border group-hover:opacity-100" />;
                                    // Half day (morning/afternoon session) → show a ½ marker.
                                    const half = rec!.session === "morning" || rec!.session === "afternoon";
                                    return display === "dot" ? (
                                      <span key={s._id} className="relative inline-flex" title={half ? "Nửa công" : "1 công"}>
                                        <span className="block size-2 rounded-full" style={{ background: `var(--chip-${cm.color}-ink)` }} />
                                        {half && <span className="absolute -right-1.5 -top-1 text-[8px] font-bold leading-none text-muted-foreground">½</span>}
                                      </span>
                                    ) : (
                                      <span key={s._id} className="inline-flex h-4 min-w-4 items-center justify-center rounded px-0.5 text-[10px] font-bold leading-none" style={{ background: `var(--chip-${cm.color}-bg)`, color: `var(--chip-${cm.color}-ink)` }} title={half ? "Nửa công" : "1 công"}>{cm.code}{half ? "½" : ""}</span>
                                    );
                                  })
                                )}
                              </button>
                            </td>
                          );
                        })}
                        {(() => {
                          const s = summaryMap.get(e._id) ?? { work: 0, leave: 0, holiday: 0, regime: 0 };
                          const total = round1(s.work + s.leave + s.holiday);
                          const cells = [round1(s.work), round1(s.leave), round1(s.holiday), round1(s.regime), total];
                          return cells.map((v, i) => (
                            <td key={i} className={cn("px-2 py-2 text-center text-[12px] tabular-nums", i === 0 && "border-l-2 border-border", i === 4 ? "font-bold text-foreground" : "text-muted-foreground")}>
                              {v || "·"}
                            </td>
                          ));
                        })()}
                      </tr>
                    ))}
                    {!loading && rows.length === 0 && (
                      <tr><td colSpan={days.length + 1 + SUMMARY_COLS.length} className="px-4 py-16 text-center text-[13px] text-muted-foreground">Không có nhân viên phù hợp.</td></tr>
                    )}
                    {loading && (
                      <tr><td colSpan={days.length + 1 + SUMMARY_COLS.length} className="px-4 py-16 text-center text-[13px] text-muted-foreground">Đang tải…</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-4 py-3 text-[12.5px] text-muted-foreground">
                <span>Hiển thị <b className="text-foreground tabular-nums">{rows.length}</b> / {grid?.employees.length ?? 0} nhân viên</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-400" /> Mỗi ô = {shifts.length} ca</span>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {edit && (
        <CellEditor
          target={edit}
          shifts={shifts}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); setReloadKey((k) => k + 1); }}
        />
      )}

    </div>
  );
}

// Monthly roll-up columns aggregated from the grid (right of the day matrix).
const SUMMARY_COLS = [
  { key: "work", label: "Công thực tế" },
  { key: "leave", label: "Nghỉ phép" },
  { key: "holiday", label: "Nghỉ lễ" },
  { key: "regime", label: "Nghỉ chế độ" },
  { key: "total", label: "Tổng công" },
] as const;

const inputCls = "h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

// Earliest check-in / latest check-out across the day's existing ca records —
// used to prefill the day-level editor.
function dayTimes(records: Record<string, AttendanceRecord>): { checkIn: string; checkOut: string } {
  const ins: string[] = [];
  const outs: string[] = [];
  for (const r of Object.values(records)) {
    if (r.checkIn) ins.push(hhmmVN(r.checkIn));
    if (r.checkOut) outs.push(hhmmVN(r.checkOut));
  }
  return {
    checkIn: ins.sort()[0] ?? "",
    checkOut: outs.sort().at(-1) ?? "",
  };
}

// One check-in / one check-out per day; the server auto-distributes it across
// every configured ca and computes công (see backend upsertDay / matchShifts).
function CellEditor({ target, shifts, onClose, onSaved }: { target: EditTarget; shifts: ShiftOption[]; onClose: () => void; onSaved: () => void }) {
  const { employee, dateKey, records } = target;
  const [day, setDay] = useState(() => dayTimes(records));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasExisting = Object.keys(records).length > 0;

  function save() {
    if (!day.checkIn || !day.checkOut) { setError("Nhập cả giờ vào và giờ ra."); return; }
    setSaving(true);
    setError(null);
    attendanceService
      .upsertDay({
        employeeId: employee._id,
        date: dateKey,
        checkIn: vnInstant(dateKey, day.checkIn),
        checkOut: vnInstant(dateKey, day.checkOut),
      })
      .then(() => onSaved())
      .catch((e) => setError(e?.response?.data?.message ?? "Không thể lưu chấm công."))
      .finally(() => setSaving(false));
  }

  function clearDay() {
    if (!hasExisting) { onClose(); return; }
    setSaving(true);
    setError(null);
    Promise.all(Object.values(records).map((r) => attendanceService.remove(r._id)))
      .then(() => onSaved())
      .catch((e) => setError(e?.response?.data?.message ?? "Không thể xoá chấm công."))
      .finally(() => setSaving(false));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="animate-fade-in absolute inset-0 bg-secondary-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-pop-in relative max-h-[90vh] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-background p-6 shadow-2xl">
        <button onClick={onClose} className="press absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"><X className="size-4" /></button>
        <h3 className="text-[16px] font-bold text-foreground">Chấm công theo ngày</h3>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{employee.fullName || employee.employeeCode} · {dateKey}</p>

        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-xl border border-border/70 p-3.5">
            <p className="mb-3 text-[12.5px] text-muted-foreground">
              Nhập 1 giờ vào / 1 giờ ra — hệ thống tự khớp các ca ({shifts.map((s) => `${s.name} ${s.startTime}–${s.endTime}`).join(", ") || "chưa có ca"}) và tính công.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium text-foreground">Giờ vào</label>
                <TimeInput className={cn(inputCls, "mt-1.5")} value={day.checkIn} onChange={(v) => setDay((d) => ({ ...d, checkIn: v }))} />
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground">Giờ ra</label>
                <TimeInput className={cn(inputCls, "mt-1.5")} value={day.checkOut} onChange={(v) => setDay((d) => ({ ...d, checkOut: v }))} />
              </div>
            </div>
          </div>
          {shifts.length === 0 && <p className="text-[13px] text-muted-foreground">Chưa cấu hình ca làm.</p>}
          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        </div>

        <div className="mt-5 flex justify-between gap-2">
          {hasExisting
            ? <Button variant="outline" onClick={clearDay} disabled={saving} className="rounded-xl text-destructive">Xoá công ngày</Button>
            : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-xl">Huỷ</Button>
            <Button onClick={save} disabled={saving || shifts.length === 0} className="rounded-xl">{saving ? "Đang lưu…" : "Lưu"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
