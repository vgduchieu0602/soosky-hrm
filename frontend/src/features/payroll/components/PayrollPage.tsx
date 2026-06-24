import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Search, Wallet, ChevronDown, Check, ChevronRight, Loader2, BadgeDollarSign,
  Plus, FilePlus2, Settings2, Calculator, Lock, LockOpen, Download, RotateCcw, Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/shared/utils/cn";
import { parseDecimal, fmtVND } from "@/shared/utils/money";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import { payrollService } from "@features/payroll/services/payroll.service";
import { employeeService } from "@features/employee/services/employee.service";
import { CreatePeriodDialog } from "@features/payroll/components/CreatePeriodDialog";
import { CompensationDialog, type EmpOption } from "@features/payroll/components/CompensationDialog";
import { CompensationManagerDialog } from "@features/payroll/components/CompensationManagerDialog";
import { GrossUpCalculatorDialog } from "@features/payroll/components/GrossUpCalculatorDialog";
import { AttendanceLockDialog } from "@features/payroll/components/AttendanceLockDialog";
import { PayslipDrawer, type EmpInfo } from "@features/payroll/components/PayslipDrawer";
import type {
  CreatePeriodInput, PayrollPeriod, PayrollRecord, PayrollStatus,
} from "@features/payroll/types/payroll.types";

type BadgeVariant = "slate" | "amber" | "emerald" | "blue" | "violet" | "rose";

const PAY_STATUS: Record<PayrollStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Nháp", variant: "slate" },
  approved: { label: "Đã duyệt", variant: "blue" },
  paid: { label: "Đã chi", variant: "emerald" },
};

const PERIOD_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  open: { label: "Đang mở", variant: "slate" },
  processing: { label: "Đang xử lý", variant: "amber" },
  closed: { label: "Đã khóa", variant: "blue" },
  paid: { label: "Đã chi", variant: "emerald" },
};

const ALL = "Tất cả";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const last = parts[parts.length - 1]?.[0] ?? "";
  const first = parts[0]?.[0] ?? "";
  return (last + first).toUpperCase() || "?";
}

const Initials = ({ children, className }: { children: ReactNode; className?: string }) => (
  <Avatar className={className}>
    <AvatarFallback className="bg-muted font-medium text-foreground/70">{children}</AvatarFallback>
  </Avatar>
);

function FilterSelect({ label, value, options, onChange, valueWidth = 92 }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void; valueWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} className="h-9 gap-2 rounded-full text-[13px]">
        <span className="text-muted-foreground">{label}:</span>
        <span className="inline-block text-left font-semibold" style={{ minWidth: valueWidth }}>{cur?.label ?? value}</span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </Button>
      {open && (<>
        <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
        <div className="absolute right-0 top-11 z-30 max-h-[280px] min-w-[160px] overflow-y-auto rounded-xl border bg-card p-1.5 shadow-md">
          {options.map((o) => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted", value === o.value && "font-semibold text-primary-600")}>
              {o.label}{value === o.value && <Check className="size-3.5" strokeWidth={2.4} />}
            </button>
          ))}
        </div>
      </>)}
    </div>
  );
}

const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th className={cn("px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70", className)}>{children}</th>
);
const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>
);

function HeadStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

export default function Payroll() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [empMap, setEmpMap] = useState<Record<string, EmpInfo>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [dept, setDept] = useState(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [periodDlg, setPeriodDlg] = useState(false);
  const [compDlg, setCompDlg] = useState(false);
  const [manageDlg, setManageDlg] = useState(false);
  const [grossUpDlg, setGrossUpDlg] = useState(false);
  const [lockDlg, setLockDlg] = useState(false);

  // Load periods once + the employee directory (for name/dept join).
  useEffect(() => {
    let active = true;
    Promise.all([payrollService.listPeriods(), employeeService.list({ limit: 500 })])
      .then(([ps, emp]) => {
        if (!active) return;
        setPeriods(ps);
        setPeriodId((cur) => cur || ps[0]?._id || "");
        if (ps.length === 0) setLoading(false);
        const map: Record<string, EmpInfo> = {};
        for (const e of emp.items) {
          const p = e.profile;
          const name = p ? [p.lastName, p.middleName, p.firstName].filter(Boolean).join(" ") : e.employeeCode;
          const dep = typeof e.departmentId === "object" && e.departmentId ? e.departmentId.name : "—";
          map[e._id] = { name, code: e.employeeCode, dept: dep, initials: initialsOf(name) };
        }
        setEmpMap(map);
      })
      .catch(() => { if (active) setErr("Không tải được dữ liệu kỳ lương."); });
    return () => { active = false; };
  }, []);

  // Load payrolls whenever the selected period (or reload trigger) changes.
  useEffect(() => {
    if (!periodId) return;
    let active = true;
    payrollService
      .listPayrolls({ payrollPeriodId: periodId, limit: 500 })
      .then((res) => { if (active) { setPayrolls(res.data); setLoading(false); } })
      .catch(() => { if (active) { setPayrolls([]); setLoading(false); } });
    return () => { active = false; };
  }, [periodId, reloadKey]);

  const period = useMemo(() => periods.find((p) => p._id === periodId), [periods, periodId]);
  const emp = (id: string): EmpInfo =>
    empMap[id] ?? { name: id.slice(-6), code: id.slice(-6), dept: "—", initials: "?" };

  const deptOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of payrolls) set.add(emp(p.employeeId).dept);
    return [{ value: ALL, label: ALL }, ...Array.from(set).filter((d) => d !== "—").sort().map((d) => ({ value: d, label: d }))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payrolls, empMap]);

  const rows = useMemo(() => payrolls.filter((p) => {
    const e = emp(p.employeeId);
    if (dept !== ALL && e.dept !== dept) return false;
    if (status !== ALL && p.status !== status) return false;
    if (q && !`${e.name} ${e.code} ${e.dept}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [payrolls, empMap, dept, status, q]);

  const k = useMemo(() => {
    let net = 0, gross = 0, insurance = 0, tax = 0, approvedOrPaid = 0;
    for (const p of payrolls) {
      net += parseDecimal(p.netSalary);
      gross += parseDecimal(p.grossSalary);
      insurance += parseDecimal(p.insurance);
      tax += parseDecimal(p.tax);
      if (p.status !== "draft") approvedOrPaid += 1;
    }
    return { net, gross, insurance, tax, approvedOrPaid, headcount: payrolls.length };
  }, [payrolls]);
  const pct = k.headcount ? Math.round((k.approvedOrPaid / k.headcount) * 100) : 0;

  const locked = period?.status === "closed" || period?.status === "paid";

  const empOptions: EmpOption[] = useMemo(
    () => Object.entries(empMap)
      .map(([id, e]) => ({ id, name: e.name, code: e.code }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    [empMap],
  );

  async function handleCreatePeriod(input: CreatePeriodInput) {
    const created = await payrollService.createPeriod(input);
    setPeriods((ps) => [created, ...ps]);
    setPeriodId(created._id);
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setReloadKey((n) => n + 1);
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(msg ?? "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  }

  const attLocked = !!period?.attendanceLockedAt;
  async function lockAtt(lock: boolean) {
    if (!periodId) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = lock
        ? await payrollService.lockAttendance(periodId)
        : await payrollService.unlockAttendance(periodId);
      setPeriods((ps) => ps.map((p) => (p._id === updated._id ? updated : p)));
    } catch (e) {
      const d = (e as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
      setErr(d?.error?.message ?? d?.message ?? "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function reopenPeriod() {
    if (!periodId || !window.confirm("Mở lại kỳ lương đã khoá/đã chi để tính lại?")) return;
    setBusy(true); setErr(null);
    try {
      const updated = await payrollService.reopenPeriod(periodId);
      setPeriods((ps) => ps.map((p) => (p._id === updated._id ? updated : p)));
    } catch (e) {
      const d = (e as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
      setErr(d?.error?.message ?? d?.message ?? "Không mở lại được kỳ.");
    } finally { setBusy(false); }
  }
  async function removePeriod() {
    if (!periodId || !window.confirm("Xoá kỳ lương này? Chỉ xoá được khi chưa có bảng lương.")) return;
    setBusy(true); setErr(null);
    try {
      await payrollService.deletePeriod(periodId);
      setPeriods((ps) => ps.filter((p) => p._id !== periodId));
      setPeriodId("");
    } catch (e) {
      const d = (e as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
      setErr(d?.error?.message ?? d?.message ?? "Không xoá được kỳ.");
    } finally { setBusy(false); }
  }

  const detail = detailId ? payrolls.find((p) => p._id === detailId) ?? null : null;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="pay" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Bảng lương"]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

            {/* header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Bảng lương</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  {period
                    ? `Kỳ lương ${period.name} · ${period.standardWorkDays} ngày công chuẩn · chi ${new Date(period.payDate).toLocaleDateString("vi-VN")}.`
                    : "Chưa có kỳ lương nào."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect label="Kỳ lương" value={periodId} valueWidth={96}
                  options={periods.map((p) => ({ value: p._id, label: p.name }))} onChange={setPeriodId} />
                <Button size="sm" variant="outline" onClick={() => setPeriodDlg(true)} className="h-9 gap-2 rounded-full text-[13px]">
                  <Plus className="size-3.5" strokeWidth={2} /> Tạo kỳ
                </Button>
                <Button size="sm" variant="outline" disabled={empOptions.length === 0} onClick={() => setCompDlg(true)} className="h-9 gap-2 rounded-full text-[13px]">
                  <FilePlus2 className="size-3.5" strokeWidth={1.9} /> Nhập cấu phần
                </Button>
                <Button size="sm" variant="outline" disabled={empOptions.length === 0} onClick={() => setManageDlg(true)} className="h-9 gap-2 rounded-full text-[13px]">
                  <Settings2 className="size-3.5" strokeWidth={1.9} /> Quản lý cấu phần
                </Button>
                <Button size="sm" variant="outline" onClick={() => setGrossUpDlg(true)} className="h-9 gap-2 rounded-full text-[13px]">
                  <Calculator className="size-3.5" strokeWidth={1.9} /> NET → GROSS
                </Button>
                <Button size="sm" variant="outline" disabled={busy || !periodId || payrolls.length === 0}
                  onClick={() => {
                    if (!periodId) return;
                    setBusy(true); setErr(null);
                    payrollService.exportPeriod(periodId)
                      .then((blob) => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `bang-luong-${period?.name ?? "ky"}.xlsx`; a.click();
                        URL.revokeObjectURL(url);
                      })
                      .catch(() => setErr("Không xuất được bảng lương."))
                      .finally(() => setBusy(false));
                  }}
                  className="h-9 gap-2 rounded-full text-[13px]">
                  <Download className="size-3.5" strokeWidth={1.9} /> Xuất Excel
                </Button>
                {period && !locked && (
                  attLocked ? (
                    <Button size="sm" variant="outline" disabled={busy || !periodId}
                      onClick={() => lockAtt(false)} className="h-9 gap-2 rounded-full text-[13px]">
                      <LockOpen className="size-3.5" strokeWidth={1.9} /> Mở chốt chấm công
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy || !periodId}
                      onClick={() => setLockDlg(true)} className="h-9 gap-2 rounded-full text-[13px]">
                      <Lock className="size-3.5" strokeWidth={1.9} /> Chốt chấm công
                    </Button>
                  )
                )}
                <Button size="sm" disabled={busy || locked || !periodId || !attLocked}
                  title={!attLocked ? "Hãy chốt chấm công trước khi tính lương" : undefined}
                  onClick={() => act(() => payrollService.runPeriod(periodId))}
                  className="h-9 gap-2 rounded-full text-[13px]">
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wallet className="size-3.5" strokeWidth={1.9} />} Tính lương
                </Button>
                {period?.status !== "paid" && (
                  <Button size="sm" variant="outline" disabled={busy || !periodId}
                    onClick={() => act(() => payrollService.markPaid(periodId))}
                    className="h-9 gap-2 rounded-full text-[13px]">
                    <BadgeDollarSign className="size-3.5" strokeWidth={1.9} /> Đánh dấu đã chi
                  </Button>
                )}
                {period && locked && (
                  <Button size="sm" variant="outline" disabled={busy || !periodId} onClick={reopenPeriod}
                    className="h-9 gap-2 rounded-full text-[13px]">
                    <RotateCcw className="size-3.5" strokeWidth={1.9} /> Mở lại kỳ
                  </Button>
                )}
                {period && payrolls.length === 0 && (
                  <Button size="sm" variant="outline" disabled={busy || !periodId} onClick={removePeriod}
                    className="h-9 gap-2 rounded-full text-[13px] text-rose-600 hover:border-rose-200 hover:bg-rose-50">
                    <Trash2 className="size-3.5" strokeWidth={1.9} /> Xoá kỳ
                  </Button>
                )}
              </div>
            </div>

            {err && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{err}</div>
            )}

            {/* period banner */}
            <div className="rounded-2xl border border-secondary-700 p-6 text-white shadow-card" style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Kỳ lương {period?.name ?? "—"}</span>
                    {period && <Badge variant={PERIOD_STATUS[period.status]?.variant ?? "slate"} className="border border-white/10">{PERIOD_STATUS[period.status]?.label}</Badge>}
                    {attLocked && <Badge variant="emerald" className="border border-white/10">Đã chốt chấm công</Badge>}
                  </div>
                  <div className="mt-2 text-[12px] font-medium uppercase tracking-wider text-white/45">Tổng chi thực nhận (Net)</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[34px] font-bold tracking-tight tabular-nums">{fmtVND(k.net)}</span>
                    <span className="text-[15px] font-medium text-white/60">₫</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                  <HeadStat label="Tổng Gross" value={fmtVND(k.gross)} />
                  <HeadStat label="BHXH/BHYT/BHTN" value={fmtVND(k.insurance)} />
                  <HeadStat label="Thuế TNCN" value={fmtVND(k.tax)} />
                  <HeadStat label="Nhân sự" value={`${k.headcount} người`} />
                </div>
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/55">Đã duyệt {k.approvedOrPaid} / {k.headcount} bảng lương</span>
                  <span className="font-semibold tabular-nums text-white/85">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-white/45">Lương cấu thành từ 3 nhóm (20 / 60 / 20)</div>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {[
                    { w: "20%", t: "Lương ngày công", d: "Ngày công thực tế / ngày công chuẩn", c: "#2CCBFF" },
                    { w: "60%", t: "Tỷ lệ hiệu suất", d: "Điểm đánh giá hiệu suất tháng", c: "#5D97FF" },
                    { w: "20%", t: "Tỷ lệ mục tiêu", d: "Kết quả mục tiêu đạt được", c: "#A78BFA" },
                  ].map((g) => (
                    <div key={g.t} className="rounded-xl bg-white/[0.06] px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[18px] font-bold leading-none tabular-nums" style={{ color: g.c }}>{g.w}</span>
                        <span className="text-[12.5px] font-semibold text-white">{g.t}</span>
                      </div>
                      <div className="mt-1.5 text-[11px] leading-snug text-white/55">{g.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* table */}
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã NV…" className="h-9 pl-10 text-[13px]" />
                </div>
                <FilterSelect label="Phòng ban" value={dept} valueWidth={92} options={deptOptions} onChange={setDept} />
                <FilterSelect label="Trạng thái" value={status} valueWidth={72}
                  options={[{ value: ALL, label: ALL }, { value: "draft", label: "Nháp" }, { value: "approved", label: "Đã duyệt" }, { value: "paid", label: "Đã chi" }]}
                  onChange={setStatus} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead><tr className="border-y bg-muted/30">
                    <Th className="text-center">STT</Th>
                    <Th>Nhân viên</Th>
                    <Th className="text-right">Lương chuẩn</Th>
                    <Th className="text-right">Ngày công</Th>
                    <Th className="text-right">Hiệu suất</Th>
                    <Th className="text-right">Mục tiêu</Th>
                    <Th className="text-right">Lương theo KPI</Th>
                    <Th className="text-right">Thực nhận</Th>
                    <Th>Trạng thái</Th><Th className="text-right"> </Th>
                  </tr></thead>
                  <tbody>
                    {loading && <tr><td colSpan={10} className="px-4 py-16 text-center text-[13px] text-muted-foreground">Đang tải…</td></tr>}
                    {!loading && rows.map((p, idx) => {
                      const e = emp(p.employeeId);
                      return (
                        <tr key={p._id} onClick={() => setDetailId(p._id)} className="group cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-slate-50">
                          <Td className="text-center tabular-nums text-muted-foreground">{idx + 1}</Td>
                          <Td>
                            <div className="flex items-center gap-3">
                              <Initials className="size-9 text-[12px]">{e.initials}</Initials>
                              <div>
                                <div className="font-medium text-foreground">{e.name}</div>
                                <div className="text-[11.5px] text-muted-foreground"><span className="font-mono">{e.code}</span> · {e.dept}</div>
                              </div>
                            </div>
                          </Td>
                          <Td className="text-right tabular-nums text-foreground/70">{fmtVND(p.baseSalary)}</Td>
                          <Td className="text-right tabular-nums text-foreground/80">{p.actualWorkDays}/{p.standardWorkDays}</Td>
                          <Td className="text-right tabular-nums text-foreground/80">{Math.round(p.performanceRatio)}%</Td>
                          <Td className="text-right tabular-nums text-foreground/80">{Math.round(p.goalRatio)}%</Td>
                          <Td className="text-right font-semibold tabular-nums text-foreground">{fmtVND(p.proRatedBaseSalary)}</Td>
                          <Td className="text-right font-bold tabular-nums text-foreground">{fmtVND(p.netSalary)}</Td>
                          <Td><Badge variant={PAY_STATUS[p.status].variant}>{PAY_STATUS[p.status].label}</Badge></Td>
                          <Td className="text-right"><ChevronRight className="ml-auto size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" /></Td>
                        </tr>
                      );
                    })}
                    {!loading && rows.length === 0 && <tr><td colSpan={10} className="px-4 py-16 text-center text-[13px] text-muted-foreground">Chưa có bảng lương — bấm “Tính lương” để tạo.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-[12.5px] text-muted-foreground">
                <span>Hiển thị <b className="text-foreground tabular-nums">{rows.length}</b> / {payrolls.length} bảng lương{period ? ` · kỳ ${period.name}` : ""}</span>
                <span>Đơn vị: VND</span>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {periodDlg && (
        <CreatePeriodDialog open onOpenChange={setPeriodDlg} onSubmit={handleCreatePeriod} />
      )}
      {compDlg && (
        <CompensationDialog
          open
          onOpenChange={setCompDlg}
          employees={empOptions}
          periods={periods}
          defaultPeriodId={periodId}
          onSaved={() => setReloadKey((n) => n + 1)}
        />
      )}
      {manageDlg && (
        <CompensationManagerDialog
          open
          onOpenChange={setManageDlg}
          employees={empOptions}
          onChanged={() => setReloadKey((n) => n + 1)}
        />
      )}
      {grossUpDlg && <GrossUpCalculatorDialog open onOpenChange={setGrossUpDlg} />}
      {lockDlg && period && (
        <AttendanceLockDialog
          open
          onOpenChange={setLockDlg}
          periodId={period._id}
          periodName={period.name}
          onConfirm={() => lockAtt(true)}
        />
      )}

      {detail && (
        <PayslipDrawer
          p={detail}
          emp={emp(detail.employeeId)}
          periodName={period?.name ?? ""}
          busy={busy}
          onApprove={() => act(() => payrollService.approve(periodId, detail.employeeId))}
          onRevert={() => act(() => payrollService.revert(detail._id))}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
