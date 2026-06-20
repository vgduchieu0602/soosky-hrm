import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, ChevronDown, Check, ClipboardCheck, Pencil } from "lucide-react";
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
    () => employees.filter((e) => !q || `${e.name} ${e.code} ${e.dept}`.toLowerCase().includes(q.toLowerCase())),
    [employees, q],
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const stats = useMemo(() => {
    const done = evals.filter((e) => e.status === "approved" || e.status === "acknowledged").length;
    const avg = evals.length ? Math.round(evals.reduce((s, e) => s + e.performanceRatio, 0) / evals.length) : 0;
    return { total: employees.length, done, avg };
  }, [evals, employees]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="perf" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Đánh giá"]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Đánh giá hiệu suất</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">Click vào nhân viên để chấm trực tiếp. Hiệu suất 60% + Mục tiêu 20% nuôi lương.</p>
              </div>
              <PeriodSelect value={periodId} options={periods} onChange={(v) => { setPeriodId(v); setPage(1); }} />
            </div>

            {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{err}</div>}

            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Nhân sự" value={`${stats.total}`} />
              <StatCard label="Đã duyệt" value={`${stats.done}/${stats.total}`} />
              <StatCard label="Hiệu suất TB" value={`${stats.avg}%`} />
            </div>

            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Tìm theo tên, mã NV…" className="h-9 pl-10 text-[13px]" />
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
                          <Td className="text-right tabular-nums">{ev ? `${Math.round(ev.performanceRatio)}%` : "—"}</Td>
                          <Td className="text-right tabular-nums">{ev ? `${Math.round(ev.goalRatio)}%` : "—"}</Td>
                          <Td className="text-right">
                            <Button size="sm" variant={ev ? "outline" : "default"} disabled={acked}
                              onClick={() => setScoreEmp(emp)} className="h-8 gap-1.5 rounded-lg text-[12.5px]">
                              {ev ? <><Pencil className="size-3.5" /> Sửa</> : <><ClipboardCheck className="size-3.5" /> Đánh giá</>}
                            </Button>
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
    </div>
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
