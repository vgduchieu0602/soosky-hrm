import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, ChevronDown, Check, ClipboardCheck, Pencil, History, X, TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { scoreBand } from "@features/performance/utils/score-band";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils/cn";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import { payrollService } from "@features/payroll/services/payroll.service";
import { employeeService } from "@features/employee/services/employee.service";
import { settingsService } from "@features/settings/services/settings.service";
import { performanceService } from "@features/performance/services/performance.service";
import { EvaluationScoreDialog } from "@features/performance/components/EvaluationScoreDialog";
import type { Evaluation, EvaluationStatus } from "@features/performance/types/performance.types";
import type { PayrollPeriod } from "@features/payroll/types/payroll.types";
import type { PerformanceCriterion } from "@features/settings/types/settings.types";

type BadgeVariant = "slate" | "amber" | "emerald" | "blue" | "violet" | "rose";
const STATUS: Record<EvaluationStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Nháp", variant: "amber" },
  approved: { label: "Đã duyệt", variant: "blue" },
  acknowledged: { label: "NV đã xác nhận", variant: "emerald" },
};

interface EmpRow { id: string; name: string; code: string; dept: string }
function initialsOf(n: string) {
  const p = n.trim().split(/\s+/);
  return ((p[p.length - 1]?.[0] ?? "") + (p[0]?.[0] ?? "")).toUpperCase() || "?";
}

const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th className={cn("px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70", className)}>{children}</th>
);
const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>
);

function PeriodSelect({ value, options, onChange }: { value: string; options: PayrollPeriod[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o._id === value);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} className="h-9 gap-2 rounded-full text-[13px]">
        <span className="text-muted-foreground">Kỳ:</span>
        <span className="font-semibold">{cur?.name ?? "—"}</span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </Button>
      {open && (<>
        <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
        <div className="absolute right-0 top-11 z-30 max-h-[280px] min-w-[150px] overflow-y-auto rounded-xl border bg-card p-1.5 shadow-md">
          {options.map((o) => (
            <button key={o._id} onClick={() => { onChange(o._id); setOpen(false); }}
              className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] hover:bg-muted", value === o._id && "font-semibold text-primary-600")}>
              {o.name}{value === o._id && <Check className="size-3.5" strokeWidth={2.4} />}
            </button>
          ))}
        </div>
      </>)}
    </div>
  );
}

export default function Performance() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [employees, setEmployees] = useState<EmpRow[]>([]);
  const [criteria, setCriteria] = useState<PerformanceCriterion[]>([]);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [scoreEmp, setScoreEmp] = useState<EmpRow | null>(null);
  const [historyEmp, setHistoryEmp] = useState<EmpRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

  const periodNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of periods) m.set(p._id, p.name);
    return m;
  }, [periods]);

  useEffect(() => {
    let active = true;
    Promise.all([
      payrollService.listPeriods(),
      employeeService.list({ limit: 500 }),
      settingsService.listCriteria(true),
    ]).then(([ps, emp, crit]) => {
      if (!active) return;
      setPeriods(ps);
      setPeriodId((c) => c || ps[0]?._id || "");
      if (ps.length === 0) setLoading(false);
      setEmployees(emp.items.map((e) => {
        const p = e.profile;
        const name = p ? [p.lastName, p.middleName, p.firstName].filter(Boolean).join(" ") : e.employeeCode;
        const dept = typeof e.departmentId === "object" && e.departmentId ? e.departmentId.name : "—";
        return { id: e._id, name, code: e.employeeCode, dept };
      }).sort((a, b) => a.code.localeCompare(b.code)));
      setCriteria(crit);
    }).catch(() => { if (active) setErr("Không tải được dữ liệu."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!periodId) return;
    let active = true;
    performanceService.list(periodId)
      .then((rows) => { if (active) { setEvals(rows); setLoading(false); } })
      .catch(() => { if (active) { setEvals([]); setLoading(false); } });
    return () => { active = false; };
  }, [periodId, reloadKey]);

  const evalByEmp = useMemo(() => {
    const m = new Map<string, Evaluation>();
    for (const e of evals) m.set(e.employeeId, e);
    return m;
  }, [evals]);

  const rows = useMemo(
    () => employees.filter((e) => {
      if (q && !`${e.name} ${e.code} ${e.dept}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (statusFilter === "all") return true;
      const st = evalByEmp.get(e.id)?.status;
      if (statusFilter === "none") return !st;
      return st === statusFilter;
    }),
    [employees, q, statusFilter, evalByEmp],
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const stats = useMemo(() => {
    const pendingApprove = evals.filter((e) => e.status === "draft").length;
    const pendingAck = evals.filter((e) => e.status === "approved").length;
    const avg = evals.length ? Math.round(evals.reduce((s, e) => s + e.performanceRatio, 0) / evals.length) : 0;
    return { total: employees.length, pendingApprove, pendingAck, avg };
  }, [evals, employees]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="perf" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Đánh giá"]} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Đánh giá hiệu suất</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">Click vào nhân viên để chấm trực tiếp. Hiệu suất 60% + Mục tiêu 20% nuôi lương.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={exporting || !periodId}
                  onClick={() => {
                    setExporting(true);
                    performanceService.exportXlsx(periodId)
                      .then((blob) => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = "danh-gia.xlsx"; a.click();
                        URL.revokeObjectURL(url);
                      })
                      .catch(() => setErr("Không xuất được dữ liệu."))
                      .finally(() => setExporting(false));
                  }}
                  className="h-9 gap-2 rounded-full text-[13px]">
                  <Download className="size-3.5" /> Xuất Excel
                </Button>
                <PeriodSelect value={periodId} options={periods} onChange={(v) => { setPeriodId(v); setPage(1); }} />
              </div>
            </div>

            {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{err}</div>}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Nhân sự" value={`${stats.total}`} />
              <StatCard label="Chờ duyệt" value={`${stats.pendingApprove}`} />
              <StatCard label="Chờ NV xác nhận" value={`${stats.pendingAck}`} />
              <StatCard label="Hiệu suất TB" value={`${stats.avg}%`} />
            </div>

            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Tìm theo tên, mã NV…" className="h-9 pl-10 text-[13px]" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ["all", "Tất cả"], ["none", "Chưa đánh giá"], ["draft", "Chờ duyệt"],
                    ["approved", "Chờ xác nhận"], ["acknowledged", "Đã xác nhận"],
                  ] as const).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => { setStatusFilter(val); setPage(1); }}
                      className={cn("rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                        statusFilter === val ? "border-primary-500 bg-primary-50 text-primary-700" : "text-muted-foreground hover:bg-muted")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead><tr className="border-y bg-muted/30">
                    <Th>Nhân viên</Th><Th>Trạng thái</Th>
                    <Th className="text-right">Hiệu suất</Th><Th className="text-right">Mục tiêu</Th>
                    <Th className="text-right">Hành động</Th>
                  </tr></thead>
                  <tbody>
                    {loading && <tr><td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">Đang tải…</td></tr>}
                    {!loading && paged.map((emp) => {
                      const ev = evalByEmp.get(emp.id);
                      const acked = ev?.status === "acknowledged";
                      return (
                        <tr key={emp.id} className="border-b border-border/40 last:border-0 hover:bg-slate-50">
                          <Td>
                            <div className="flex items-center gap-3">
                              <span className="flex size-9 items-center justify-center rounded-full bg-muted text-[12px] font-medium text-foreground/70">{initialsOf(emp.name)}</span>
                              <div><div className="font-medium text-foreground">{emp.name}</div><div className="text-[11.5px] text-muted-foreground"><span className="font-mono">{emp.code}</span> · {emp.dept}</div></div>
                            </div>
                          </Td>
                          <Td>{ev ? <Badge variant={STATUS[ev.status].variant}>{STATUS[ev.status].label}</Badge> : <span className="text-[12px] text-muted-foreground">Chưa đánh giá</span>}</Td>
                          <Td className="text-right tabular-nums">{ev ? <RatioCell value={ev.performanceRatio} /> : "—"}</Td>
                          <Td className="text-right tabular-nums">{ev ? <RatioCell value={ev.goalRatio} /> : "—"}</Td>
                          <Td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button size="sm" variant={ev ? "outline" : "default"} disabled={acked}
                                onClick={() => setScoreEmp(emp)} className="h-8 gap-1.5 rounded-lg text-[12.5px]">
                                {ev ? <><Pencil className="size-3.5" /> Sửa</> : <><ClipboardCheck className="size-3.5" /> Đánh giá</>}
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setHistoryEmp(emp)} aria-label="Lịch sử đánh giá" title="Lịch sử đánh giá" className="size-8 text-muted-foreground hover:text-foreground">
                                <History className="size-4" />
                              </Button>
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                    {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">Không có nhân viên.</td></tr>}
                  </tbody>
                </table>
              </div>
              {!loading && rows.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-[12.5px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Hiển thị</span>
                    <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="h-8 rounded-lg border border-input bg-card px-2 text-[12.5px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span>/ trang · {rows.length} nhân viên</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-8 rounded-lg">Trước</Button>
                    <span className="tabular-nums">Trang {safePage}/{totalPages}</span>
                    <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="h-8 rounded-lg">Sau</Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>

      {scoreEmp && (
        <EvaluationScoreDialog
          open
          onOpenChange={() => setScoreEmp(null)}
          employeeId={scoreEmp.id}
          payrollPeriodId={periodId}
          existing={evalByEmp.get(scoreEmp.id) ?? null}
          criteria={criteria}
          employeeName={scoreEmp.name}
          onSaved={() => setReloadKey((n) => n + 1)}
        />
      )}

      {historyEmp && (
        <EvaluationHistoryDrawer
          employee={historyEmp}
          periodNameById={periodNameById}
          onClose={() => setHistoryEmp(null)}
        />
      )}
    </div>
  );
}

function EvaluationHistoryDrawer({ employee, periodNameById, onClose }: {
  employee: EmpRow; periodNameById: Map<string, string>; onClose: () => void;
}) {
  const [rows, setRows] = useState<Evaluation[] | null>(null);

  useEffect(() => {
    let active = true;
    performanceService.byEmployee(employee.id)
      .then((rs) => { if (active) setRows(rs); })
      .catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [employee.id]);

  // Sort by period name (YYYY-MM) descending; fall back to id order.
  const sorted = useMemo(() => {
    if (!rows) return [];
    return [...rows].sort((a, b) =>
      (periodNameById.get(b.payrollPeriodId) ?? "").localeCompare(periodNameById.get(a.payrollPeriodId) ?? ""));
  }, [rows, periodNameById]);

  // Trend: oldest → newest performance ratios.
  const trend = useMemo(() => [...sorted].reverse().map((e) => Math.round(e.performanceRatio)), [sorted]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-secondary-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[440px] flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-[15px] font-bold text-foreground">Lịch sử đánh giá</h3>
            <p className="text-[12px] text-muted-foreground"><span className="font-mono">{employee.code}</span> · {employee.name}</p>
          </div>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {rows === null && <p className="py-10 text-center text-[13px] text-muted-foreground">Đang tải…</p>}
          {rows !== null && sorted.length === 0 && <p className="py-10 text-center text-[13px] text-muted-foreground">Chưa có đánh giá nào.</p>}

          {sorted.length >= 2 && (
            <div className="mb-4 flex items-end gap-1 rounded-xl border bg-muted/30 p-3">
              {trend.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-sm bg-primary-500/70" style={{ height: `${Math.max(4, v * 0.6)}px` }} title={`${v}%`} />
                  <span className="text-[9px] tabular-nums text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {sorted.map((ev, i) => {
              const next = sorted[i + 1]; // older period
              const delta = next ? Math.round(ev.performanceRatio) - Math.round(next.performanceRatio) : 0;
              return (
                <div key={ev._id} className="rounded-xl border px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-foreground">{periodNameById.get(ev.payrollPeriodId) ?? "—"}</span>
                    <Badge variant={STATUS[ev.status].variant}>{STATUS[ev.status].label}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-[12.5px]">
                    <span className="text-muted-foreground">Hiệu suất <b className="tabular-nums text-foreground">{Math.round(ev.performanceRatio)}%</b></span>
                    <span className="text-muted-foreground">Mục tiêu <b className="tabular-nums text-foreground">{Math.round(ev.goalRatio)}%</b></span>
                    {next && (
                      <span className={cn("ml-auto inline-flex items-center gap-0.5 text-[11.5px] font-medium tabular-nums",
                        delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-muted-foreground")}>
                        {delta > 0 ? <TrendingUp className="size-3.5" /> : delta < 0 ? <TrendingDown className="size-3.5" /> : <Minus className="size-3.5" />}
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RatioCell({ value }: { value: number }) {
  const band = scoreBand(value);
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span>{Math.round(value)}%</span>
      <Badge variant={band.tone}>{band.label}</Badge>
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</div>
      <div className="mt-1 text-[22px] font-bold tabular-nums text-foreground">{value}</div>
    </Card>
  );
}
