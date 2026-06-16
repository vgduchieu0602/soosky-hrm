import { useState, useMemo, type ReactNode } from "react";
import {
  Search, Plus, Download, ChevronDown, Check, ChevronRight, X, Pencil,
  Trophy, Wallet, UserCheck,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/shared/utils/cn";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import {
  CYCLE, CRITERIA, ratingOf, REVIEW_STATUS, REVIEWS, DEPTS,
  evalc, fmt, pctn, type Review,
} from "@features/performance/performance-data";

type Chip = "blue" | "emerald" | "violet" | "amber";

const Initials = ({ children, className }: { children: ReactNode; className?: string }) => (
  <Avatar className={className}>
    <AvatarFallback className="bg-muted font-medium text-foreground/70">{children}</AvatarFallback>
  </Avatar>
);

const chipStyle = (chip: Chip): React.CSSProperties => ({
  background: `var(--chip-${chip}-bg)`,
  color: `var(--chip-${chip}-ink)`,
});

interface StatCardProps {
  chip: Chip;
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ chip, icon: Icon, label, value, sub }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-lg" style={chipStyle(chip)}><Icon className="size-4" strokeWidth={1.9} /></span>
      </div>
      <div className="mt-2 text-[24px] font-bold leading-none tabular-nums text-foreground">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  valueWidth?: number;
}

function FilterSelect({ label, value, options, onChange, valueWidth = 84 }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} className="h-9 gap-2 rounded-full text-[13px]">
        <span className="text-muted-foreground">{label}:</span>
        <span className="inline-block text-left font-semibold" style={{ minWidth: valueWidth }}>{value}</span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </Button>
      {open && (<>
        <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
        <div className="absolute right-0 top-11 z-30 max-h-[280px] min-w-[150px] overflow-y-auto rounded-xl border bg-card p-1.5 shadow-md">
          {options.map((o) => (
            <button key={o} onClick={() => { onChange(o); setOpen(false); }} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted", value === o && "font-semibold text-primary-600")}>
              {o}{value === o && <Check className="size-3.5" strokeWidth={2.4} />}
            </button>
          ))}
        </div>
      </>)}
    </div>
  );
}

const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>
);

export default function Performance() {
  const [dept, setDept] = useState("Tất cả");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Review | null>(null);

  const rows = useMemo(() => REVIEWS.filter((r) => {
    if (dept !== "Tất cả" && r.dept !== dept) return false;
    if (q && !`${r.name} ${r.code} ${r.title}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [dept, q]);

  const k = useMemo(() => {
    const scored = REVIEWS.filter((r) => r.state === "done" || r.state === "in_review");
    const avgPerf = scored.length ? scored.reduce((s, r) => s + evalc(r).perfAvg, 0) / scored.length : 0;
    const avgGoal = scored.length ? scored.reduce((s, r) => s + r.goal, 0) / scored.length : 0;
    const done = REVIEWS.filter((r) => r.state === "done").length;
    const payByEval = REVIEWS.reduce((s, r) => s + evalc(r).payTotal, 0);
    return {
      total: REVIEWS.length, done, pending: REVIEWS.filter((r) => r.state === "in_review").length,
      avgPerf: pctn(avgPerf), avgGoal: pctn(avgGoal), payByEval,
    };
  }, []);
  const pct = Math.round((k.done / k.total) * 100);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="perf" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Đánh giá hiệu suất"]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Đánh giá hiệu suất</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">{CYCLE.label} · {CYCLE.period} · hạn chốt {CYCLE.deadline} · số liệu dùng cho Bảng lương.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect label="Kỳ" value={CYCLE.name} valueWidth={92} options={["Tháng 5, 2026", "Tháng 6, 2026"]} onChange={() => {}} />
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full text-[13px]"><Download className="size-3.5" strokeWidth={1.8} /> Báo cáo</Button>
                <Button size="sm" className="h-9 gap-2 rounded-full text-[13px]"><Plus className="size-3.5" strokeWidth={2} /> Mở kỳ đánh giá</Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <StatCard chip="blue" icon={Trophy} label="Tỷ lệ hiệu suất TB" value={`${k.avgPerf}%`} sub="trung bình 4 tiêu chí · ứng 60% lương" />
              <StatCard chip="violet" icon={Trophy} label="Tỷ lệ mục tiêu TB" value={`${k.avgGoal}%`} sub="kết quả tháng · ứng 20% lương" />
              <StatCard chip="emerald" icon={UserCheck} label="Đã chốt" value={`${k.done}/${k.total}`} sub={`${pct}% tiến độ`} />
              <StatCard chip="amber" icon={Wallet} label="Lương theo đánh giá" value={fmt(k.payByEval)} sub="phần 60% + 20% chuyển sang Bảng lương" />
            </div>

            {/* cách tính banner */}
            <div className="rounded-2xl border border-secondary-700 p-6 text-white shadow-card" style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-[420px]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Đánh giá → Bảng lương</div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-white/75">Mỗi nhân sự được chấm <b className="text-white">4 tiêu chí hiệu suất</b> và <b className="text-white">kết quả mục tiêu tháng</b>. Hai chỉ số này quyết định <b className="text-white">80% cấu phần lương</b> (60% + 20%).</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/[0.06] px-4 py-3.5">
                    <div className="flex items-center gap-2"><span className="text-[20px] font-bold tabular-nums" style={{ color: "#5D97FF" }}>60%</span><span className="text-[12.5px] font-semibold text-white">Tỷ lệ hiệu suất</span></div>
                    <div className="mt-1.5 text-[11px] leading-snug text-white/55">(4 tiêu chí ÷ 4) → % hiệu suất</div>
                  </div>
                  <div className="rounded-xl bg-white/[0.06] px-4 py-3.5">
                    <div className="flex items-center gap-2"><span className="text-[20px] font-bold tabular-nums" style={{ color: "#A78BFA" }}>20%</span><span className="text-[12.5px] font-semibold text-white">Tỷ lệ mục tiêu</span></div>
                    <div className="mt-1.5 text-[11px] leading-snug text-white/55">Kết quả đạt được trong tháng ÷ 100%</div>
                  </div>
                </div>
              </div>
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/55">Đã chốt {k.done}/{k.total} đánh giá</span>
                  <span className="font-semibold tabular-nums text-white/85">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} /></div>
              </div>
            </div>

            {/* reviews table */}
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã NV, chức vụ…" className="h-9 pl-10 text-[13px]" />
                </div>
                <FilterSelect label="Phòng ban" value={dept} valueWidth={84} options={DEPTS} onChange={setDept} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-y bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                      <th className="px-4 py-2.5 text-center" rowSpan={2}>STT</th>
                      <th className="px-4 py-2.5 text-left" rowSpan={2}>Nhân viên</th>
                      <th colSpan={4} className="border-x px-4 py-2 text-center text-secondary-700">Tiêu chí hiệu suất</th>
                      <th colSpan={1} className="border-r px-4 py-2 text-center text-secondary-700">Tiêu chí mục tiêu</th>
                      <th className="px-3 py-2.5 text-center" rowSpan={2}>Hiệu suất</th>
                      <th className="px-3 py-2.5 text-center" rowSpan={2}>Mục tiêu</th>
                      <th className="px-4 py-2.5 text-left" rowSpan={2}>Trạng thái</th>
                      <th className="px-4 py-2.5 text-right" rowSpan={2}> </th>
                    </tr>
                    <tr className="border-b bg-muted/20 text-[10px] font-medium text-muted-foreground/70">
                      {CRITERIA.map((c, i) => (
                        <th key={c.key} className={cn("px-2 py-1.5 text-center align-bottom leading-tight", i === 0 && "border-l")} style={{ minWidth: 84 }} title={c.label}>{c.short}</th>
                      ))}
                      <th className="border-x px-2 py-1.5 text-center align-bottom leading-tight" style={{ minWidth: 96 }} title="Kết quả đạt được trong tháng">Kết quả đạt được<br />trong tháng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const c = evalc(r);
                      const scored = r.state !== "not_started";
                      const rk = ratingOf(c.perfAvg);
                      return (
                        <tr key={r.code} onClick={() => setDetail(r)} className="group cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-slate-50">
                          <Td className="text-center tabular-nums text-muted-foreground">{idx + 1}</Td>
                          <Td>
                            <div className="flex items-center gap-3">
                              <Initials className="size-9 text-[12px]">{r.initials}</Initials>
                              <div>
                                <div className="font-medium text-foreground">{r.name}</div>
                                <div className="text-[11.5px] text-muted-foreground">{r.title} · {r.dept}</div>
                              </div>
                            </div>
                          </Td>
                          {r.scores.map((s, i) => (
                            <Td key={i} className={cn("text-center tabular-nums", i === 0 && "border-l", scored ? "text-foreground/75" : "text-muted-foreground/40")}>{scored ? s : "—"}</Td>
                          ))}
                          <Td className={cn("border-x text-center tabular-nums", scored ? "text-foreground/75" : "text-muted-foreground/40")}>{scored ? `${r.goal}%` : "—"}</Td>
                          <Td className="text-center">
                            {scored ? <Badge variant={rk.variant}>{pctn(c.perfAvg)}%</Badge> : <span className="text-muted-foreground/40">—</span>}
                          </Td>
                          <Td className="text-center">
                            {scored ? <span className="font-semibold tabular-nums" style={{ color: "#7C5CD6" }}>{pctn(c.rGoal * 100)}%</span> : <span className="text-muted-foreground/40">—</span>}
                          </Td>
                          <Td><Badge variant={REVIEW_STATUS[r.state].variant}>{REVIEW_STATUS[r.state].label}</Badge></Td>
                          <Td className="text-right"><ChevronRight className="ml-auto size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" /></Td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && <tr><td colSpan={11} className="px-4 py-16 text-center text-[13px] text-muted-foreground">Không có bản ghi phù hợp.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-[12.5px] text-muted-foreground">
                <span>Hiển thị <b className="text-foreground tabular-nums">{rows.length}</b> / {REVIEWS.length} đánh giá · {CYCLE.name}</span>
                <span>Hiệu suất = TB 4 tiêu chí · Mục tiêu = kết quả tháng · thang 0–100</span>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {detail && <ReviewDetail r={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// ===================== REVIEW SLIDE-OVER =====================
function ReviewDetail({ r, onClose }: { r: Review; onClose: () => void }) {
  const c = evalc(r);
  const rk = ratingOf(c.perfAvg);
  const scored = r.state !== "not_started";
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-secondary-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-[560px] max-w-[94vw] flex-col bg-background shadow-2xl animate-[slideOver_.28s_cubic-bezier(.2,.8,.2,1)]">
        <div className="relative shrink-0 overflow-hidden px-6 pb-5 pt-6 text-white" style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}>
          <button onClick={onClose} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
          <div className="flex items-center gap-4">
            <Avatar className="size-14 ring-2 ring-white/20"><AvatarFallback className="bg-white/10 text-[18px] text-white">{r.initials}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[19px] font-bold tracking-tight">{r.name}</h2>
              <div className="mt-0.5 text-[13px] text-white/70">{r.title} · {r.dept}</div>
              <div className="mt-2"><Badge variant={REVIEW_STATUS[r.state].variant} className="border border-white/10">{REVIEW_STATUS[r.state].label}</Badge></div>
            </div>
            {scored && (
              <div className="flex flex-col items-center">
                <div className="text-[34px] font-bold leading-none tabular-nums">{pctn(c.perfAvg)}%</div>
                <div className="mt-1"><Badge variant={rk.variant} className="border border-white/10">{rk.label}</Badge></div>
              </div>
            )}
          </div>
          <div className="mt-4 text-[12px] text-white/55">Người đánh giá: <b className="text-white/80">{r.reviewer}</b> · kỳ {CYCLE.name}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-5">

            {/* 4 tiêu chí → tỷ lệ hiệu suất (60%) */}
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 items-center rounded-md px-2 text-[12px] font-bold tabular-nums text-white" style={{ background: "#2F66E0" }}>60%</span>
                  <h3 className="text-[14px] font-semibold text-foreground">Tỷ lệ hiệu suất</h3>
                </div>
                <span className="text-[12px] text-muted-foreground">Trung bình 4 tiêu chí</span>
              </div>
              <div className="flex flex-col gap-3.5 p-5">
                {CRITERIA.map((cr, i) => (
                  <div key={cr.key}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary-50 text-[10px] font-bold text-secondary-700">{i + 1}</span>
                        <span className="text-[12.5px] leading-snug text-foreground/80">{cr.label}</span>
                      </div>
                      <span className="shrink-0 text-[13px] font-bold tabular-nums text-foreground">{scored ? r.scores[i] : "—"}</span>
                    </div>
                    <div className="ml-7 mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${scored ? r.scores[i] : 0}%`, background: "#2F66E0" }} />
                    </div>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between border-t pt-3">
                  <span className="text-[12.5px] text-muted-foreground">Σ {r.scores.join(" + ")} ÷ 4 = tỷ lệ hiệu suất</span>
                  <span className="text-[15px] font-bold tabular-nums text-secondary-700">{scored ? pctn(c.perfAvg) : "—"}%</span>
                </div>
              </div>
            </Card>

            {/* kết quả tháng → tỷ lệ mục tiêu (20%) */}
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 items-center rounded-md px-2 text-[12px] font-bold tabular-nums text-white" style={{ background: "#7C5CD6" }}>20%</span>
                  <h3 className="text-[14px] font-semibold text-foreground">Tỷ lệ mục tiêu</h3>
                </div>
                <span className="text-[12px] text-muted-foreground">Kết quả tháng ÷ 100%</span>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-muted-foreground">Kết quả đạt được trong tháng</span>
                  <span className="font-bold tabular-nums text-foreground">{scored ? r.goal : "—"}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${scored ? Math.min(r.goal, 100) : 0}%`, background: "#7C5CD6" }} />
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-[12.5px] text-muted-foreground">{scored ? r.goal : "—"}% ÷ 100% = tỷ lệ mục tiêu</span>
                  <span className="text-[15px] font-bold tabular-nums" style={{ color: "#7C5CD6" }}>{scored ? pctn(c.rGoal * 100) : "—"}%</span>
                </div>
              </div>
            </Card>

            {/* phần lương do đánh giá quyết định → Bảng lương */}
            <Card className="overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b bg-secondary-50 px-5 py-3">
                <Wallet className="size-4 text-secondary-700" strokeWidth={1.9} />
                <h3 className="text-[13.5px] font-semibold text-secondary-900">Cấu phần lương từ đánh giá</h3>
              </div>
              <div className="flex flex-col">
                <PayLine label="Hiệu suất · 60%" formula={`60% × ${fmt(r.base)} × ${scored ? pctn(c.perfAvg) : 0}%`} value={scored ? c.payPerf : 0} color="#2F66E0" />
                <PayLine label="Mục tiêu · 20%" formula={`20% × ${fmt(r.base)} × ${scored ? r.goal : 0}%`} value={scored ? c.payGoal : 0} color="#7C5CD6" />
                <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3.5">
                  <span className="text-[13px] font-semibold text-foreground">Tổng chuyển sang Bảng lương</span>
                  <span className="text-[16px] font-bold tabular-nums text-foreground">{fmt(scored ? c.payTotal : 0)} ₫</span>
                </div>
              </div>
            </Card>

            {/* summary */}
            <Card className="p-5">
              <h3 className="mb-2 text-[14px] font-semibold text-foreground">Nhận xét tổng kết</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{r.summary}</p>
            </Card>

            {(r.state === "in_review" || r.state === "self" || r.state === "not_started") && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2 rounded-xl"><Pencil className="size-4" /> Chấm điểm</Button>
                <Button className="flex-1 gap-2 rounded-xl"><Check className="size-4" strokeWidth={2.4} /> Chốt đánh giá</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PayLine({ label, formula, value, color }: { label: string; formula: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
      <div className="flex items-center gap-2.5">
        <span className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} />
        <div>
          <div className="text-[13px] font-medium text-foreground">{label}</div>
          <div className="text-[11px] text-muted-foreground">{formula}</div>
        </div>
      </div>
      <span className="text-[14px] font-semibold tabular-nums text-foreground">{fmt(value)} ₫</span>
    </div>
  );
}
