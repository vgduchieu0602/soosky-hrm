import { useState, useMemo, type ReactNode } from "react";
import {
  Search, Wallet, Download, ChevronDown, Check, ChevronRight, X, Send,
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
  PERIOD, PAY_STATUS, SALARY_WEIGHTS, PERF_CRITERIA, PAYROLLS, DEPTS,
  compute, fmt, pctn, type PayrollRow,
} from "@features/payroll/payroll-data";

const Initials = ({ children, className }: { children: ReactNode; className?: string }) => (
  <Avatar className={className}>
    <AvatarFallback className="bg-muted font-medium text-foreground/70">{children}</AvatarFallback>
  </Avatar>
);

interface FilterSelectProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  valueWidth?: number;
}

function FilterSelect({ label, value, options, onChange, valueWidth = 92 }: FilterSelectProps) {
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
  const [dept, setDept] = useState("Tất cả");
  const [status, setStatus] = useState("Tất cả");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<PayrollRow | null>(null);

  const rows = useMemo(() => PAYROLLS.filter((p) => {
    if (dept !== "Tất cả" && p.dept !== dept) return false;
    if (status !== "Tất cả" && PAY_STATUS[p.status].label !== status) return false;
    if (q && !`${p.name} ${p.code} ${p.dept}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [dept, status, q]);

  const k = useMemo(() => {
    const totalNet = PAYROLLS.reduce((s, p) => s + compute(p).net, 0);
    const totalGross = PAYROLLS.reduce((s, p) => s + compute(p).gross, 0);
    const computed = PAYROLLS.filter((p) => p.status !== "draft").length;
    return {
      totalNet, totalGross, computed, headcount: PAYROLLS.length,
      insurance: PAYROLLS.reduce((s, p) => s + p.insurance, 0),
      tax: PAYROLLS.reduce((s, p) => s + p.tax, 0),
    };
  }, []);
  const pct = Math.round((k.computed / k.headcount) * 100);

  const formula = [
    { w: "20%", t: "Lương ngày công", d: "Ngày công thực tế / ngày công chuẩn", c: "#2CCBFF" },
    { w: "60%", t: "Tỷ lệ hiệu suất", d: "Trung bình 4 tiêu chí đánh giá", c: "#5D97FF" },
    { w: "20%", t: "Tỷ lệ mục tiêu", d: "Kết quả đạt được trong tháng / 100%", c: "#A78BFA" },
  ];

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
                <p className="mt-1 text-[13.5px] text-muted-foreground">Kỳ lương {PERIOD.label} · {PERIOD.standardWorkDays} ngày công chuẩn · dự kiến chi {PERIOD.payDate}.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect label="Kỳ lương" value={PERIOD.label} valueWidth={92} options={["Tháng 4, 2026", "Tháng 5, 2026", "Tháng 6, 2026"]} onChange={() => {}} />
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full text-[13px]"><Download className="size-3.5" strokeWidth={1.8} /> Xuất Excel</Button>
                <Button size="sm" className="h-9 gap-2 rounded-full text-[13px]"><Wallet className="size-3.5" strokeWidth={1.9} /> Tính lương</Button>
              </div>
            </div>

            {/* period banner */}
            <div className="rounded-2xl border border-secondary-700 p-6 text-white shadow-card" style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Kỳ lương {PERIOD.name}</span>
                    <Badge variant="amber" className="border border-white/10">Đang xử lý</Badge>
                  </div>
                  <div className="mt-2 text-[12px] font-medium uppercase tracking-wider text-white/45">Tổng chi thực nhận (Net)</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[34px] font-bold tracking-tight tabular-nums">{fmt(k.totalNet)}</span>
                    <span className="text-[15px] font-medium text-white/60">₫</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                  <HeadStat label="Tổng Gross" value={fmt(k.totalGross)} />
                  <HeadStat label="BHXH/BHYT/BHTN" value={fmt(k.insurance)} />
                  <HeadStat label="Thuế TNCN" value={fmt(k.tax)} />
                  <HeadStat label="Nhân sự" value={`${k.headcount} người`} />
                </div>
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/55">Đã tính {k.computed} / {k.headcount} nhân sự</span>
                  <span className="font-semibold tabular-nums text-white/85">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
              {/* công thức cấu thành lương */}
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-white/45">Lương cấu thành từ 3 nhóm</div>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {formula.map((g) => (
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
                <FilterSelect label="Phòng ban" value={dept} valueWidth={84} options={DEPTS} onChange={setDept} />
                <FilterSelect label="Trạng thái" value={status} valueWidth={70} options={["Tất cả", "Nháp", "Đã duyệt", "Đã chi"]} onChange={setStatus} />
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
                    {rows.map((p, idx) => {
                      const c = compute(p);
                      return (
                        <tr key={p.code} onClick={() => setDetail(p)} className="group cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-slate-50">
                          <Td className="text-center tabular-nums text-muted-foreground">{idx + 1}</Td>
                          <Td>
                            <div className="flex items-center gap-3">
                              <Initials className="size-9 text-[12px]">{p.initials}</Initials>
                              <div>
                                <div className="font-medium text-foreground">{p.name}</div>
                                <div className="text-[11.5px] text-muted-foreground"><span className="font-mono">{p.code}</span> · {p.dept}</div>
                              </div>
                            </div>
                          </Td>
                          <Td className="text-right tabular-nums text-foreground/70">{fmt(p.base)}</Td>
                          <Td className="text-right tabular-nums text-foreground/80">{fmt(c.cDays)}</Td>
                          <Td className="text-right tabular-nums text-foreground/80">{fmt(c.cPerf)}</Td>
                          <Td className="text-right tabular-nums text-foreground/80">{fmt(c.cGoal)}</Td>
                          <Td className="text-right font-semibold tabular-nums text-foreground">{fmt(c.earned)}</Td>
                          <Td className="text-right font-bold tabular-nums text-foreground">{fmt(c.net)}</Td>
                          <Td><Badge variant={PAY_STATUS[p.status].variant}>{PAY_STATUS[p.status].label}</Badge></Td>
                          <Td className="text-right"><ChevronRight className="ml-auto size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" /></Td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && <tr><td colSpan={10} className="px-4 py-16 text-center text-[13px] text-muted-foreground">Không có bản ghi phù hợp.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-[12.5px] text-muted-foreground">
                <span>Hiển thị <b className="text-foreground tabular-nums">{rows.length}</b> / {PAYROLLS.length} bảng lương · kỳ {PERIOD.name}</span>
                <span>Đơn vị: VND</span>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {detail && <PayslipDetail p={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// ===================== PAYSLIP SLIDE-OVER =====================
function PayslipDetail({ p, onClose }: { p: PayrollRow; onClose: () => void }) {
  const c = compute(p);
  const st = PAY_STATUS[p.status];
  const rows2 = [
    { label: "BHXH (8%)", value: Math.round(p.insurance * 0.73) },
    { label: "BHYT (1.5%)", value: Math.round(p.insurance * 0.14) },
    { label: "BHTN (1%)", value: Math.round(p.insurance * 0.13) },
    { label: "Thuế TNCN", value: p.tax },
    ...(p.deductions ? [{ label: "Khấu trừ khác", value: p.deductions }] : []),
  ];
  const addons = [
    { label: "Phụ cấp", value: p.allowances },
    { label: "Tăng ca", value: p.ot },
    { label: "Thưởng", value: p.bonus },
  ].filter((r) => r.value);
  const perfAvg = p.perf.reduce((s, v) => s + v, 0) / p.perf.length;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-secondary-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-[540px] max-w-[94vw] flex-col bg-background shadow-2xl animate-[slideOver_.28s_cubic-bezier(.2,.8,.2,1)]">
        <div className="relative shrink-0 overflow-hidden px-6 pb-5 pt-6 text-white" style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}>
          <button onClick={onClose} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
          <div className="flex items-center gap-4">
            <Avatar className="size-14 ring-2 ring-white/20"><AvatarFallback className="bg-white/10 text-[18px] text-white">{p.initials}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-[19px] font-bold tracking-tight">{p.name}</h2>
              <div className="mt-0.5 text-[13px] text-white/70"><span className="font-mono">{p.code}</span> · {p.dept}</div>
              <div className="mt-2"><Badge variant={st.variant} className="border border-white/10">{st.label}</Badge></div>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-white/[0.07] p-3.5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-white/50">Lương thực nhận · Phiếu lương {PERIOD.name}</div>
            <div className="mt-1 flex items-baseline gap-1.5"><span className="text-[28px] font-bold tabular-nums">{fmt(c.net)}</span><span className="text-[13px] text-white/60">₫</span></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-5">

            {/* Lương cấu thành theo 3 nhóm */}
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3.5">
                <h3 className="text-[14px] font-semibold text-foreground">Lương theo hiệu suất</h3>
                <span className="text-[12px] text-muted-foreground">Lương chuẩn <b className="tabular-nums text-foreground/80">{fmt(p.base)} ₫</b></span>
              </div>
              <div className="flex h-2 w-full overflow-hidden">
                <div style={{ width: "20%", background: "#0E97C8" }} />
                <div style={{ width: "60%", background: "#2F66E0" }} />
                <div style={{ width: "20%", background: "#7C5CD6" }} />
              </div>

              <CompGroup color="#0E97C8" weight="20%" title="Lương ngày công" ratio={pctn(c.rDays * 100)} amount={c.cDays}
                formula={`${SALARY_WEIGHTS.days * 100}% × ${fmt(p.base)} × ${p.workDays}/${PERIOD.standardWorkDays} ngày công`}>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-[12px]">
                  <span className="text-muted-foreground">Ngày công thực tế / chuẩn</span>
                  <span className="font-medium tabular-nums text-foreground">{p.workDays} / {PERIOD.standardWorkDays} ngày</span>
                </div>
              </CompGroup>

              <CompGroup color="#2F66E0" weight="60%" title="Tỷ lệ hiệu suất" ratio={pctn(c.rPerf * 100)} amount={c.cPerf}
                formula={`${SALARY_WEIGHTS.perf * 100}% × ${fmt(p.base)} × TB 4 tiêu chí (${perfAvg.toFixed(1)}%)`}>
                <div className="flex flex-col gap-1.5">
                  {PERF_CRITERIA.map((cr, i) => (
                    <div key={cr.key} className="flex items-center gap-3 text-[12px]">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary-50 text-[10px] font-bold text-secondary-700">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={cr.label}>{cr.short}</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${p.perf[i]}%`, background: "#2F66E0" }} />
                      </div>
                      <span className="w-9 text-right font-semibold tabular-nums text-foreground">{p.perf[i]}%</span>
                    </div>
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-2 text-[12px] font-semibold">
                    <span className="text-foreground">Trung bình → tỷ lệ hiệu suất</span>
                    <span className="tabular-nums text-secondary-700">{perfAvg.toFixed(1)}%</span>
                  </div>
                </div>
              </CompGroup>

              <CompGroup color="#7C5CD6" weight="20%" title="Tỷ lệ mục tiêu" ratio={pctn(c.rGoal * 100)} amount={c.cGoal} last
                formula={`${SALARY_WEIGHTS.goal * 100}% × ${fmt(p.base)} × kết quả ${p.goal}% / 100%`}>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-[12px]">
                  <span className="text-muted-foreground">Kết quả đạt được trong tháng</span>
                  <span className="font-medium tabular-nums text-foreground">{p.goal}% / 100%</span>
                </div>
              </CompGroup>

              <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3.5 text-[13px] font-semibold">
                <span className="text-foreground">Lương cấu thành theo hiệu suất</span>
                <span className="tabular-nums text-foreground">{fmt(c.earned)} ₫</span>
              </div>
            </Card>

            {/* Phụ cấp / thưởng */}
            {addons.length > 0 && (
              <Card className="p-5">
                <h3 className="mb-3 text-[14px] font-semibold text-foreground">Phụ cấp & thưởng</h3>
                <dl className="flex flex-col">
                  {addons.map((r, i) => (
                    <div key={i} className={cn("flex items-center justify-between py-2 text-[13px]", i < addons.length - 1 && "border-b border-border/40")}>
                      <dt className="text-muted-foreground">{r.label}</dt>
                      <dd className="tabular-nums text-foreground">+{fmt(r.value)} ₫</dd>
                    </div>
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t pt-3 text-[13px] font-semibold">
                    <dt className="text-foreground">Tổng thu nhập (Gross)</dt>
                    <dd className="tabular-nums text-foreground">{fmt(c.gross)} ₫</dd>
                  </div>
                </dl>
              </Card>
            )}

            <Card className="p-5">
              <h3 className="mb-3 text-[14px] font-semibold text-foreground">Khấu trừ</h3>
              <dl className="flex flex-col">
                {rows2.map((r, i) => (
                  <div key={i} className={cn("flex items-center justify-between py-2 text-[13px]", i < rows2.length - 1 && "border-b border-border/40")}>
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className="tabular-nums text-rose-500">−{fmt(r.value)} ₫</dd>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between border-t pt-3 text-[13px] font-semibold">
                  <dt className="text-foreground">Tổng khấu trừ</dt>
                  <dd className="tabular-nums text-rose-500">−{fmt(p.insurance + p.tax + p.deductions)} ₫</dd>
                </div>
              </dl>
            </Card>

            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-5 py-4">
              <span className="text-[14px] font-semibold text-emerald-900">Thực nhận (Net)</span>
              <span className="text-[20px] font-bold tabular-nums text-emerald-700">{fmt(c.net)} ₫</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2 rounded-xl"><Download className="size-4" /> Tải phiếu lương</Button>
              {p.status === "draft"
                ? <Button className="flex-1 gap-2 rounded-xl"><Check className="size-4" strokeWidth={2.4} /> Duyệt lương</Button>
                : <Button className="flex-1 gap-2 rounded-xl"><Send className="size-4" /> Gửi phiếu lương</Button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CompGroupProps {
  color: string;
  weight: string;
  title: string;
  ratio: number;
  amount: number;
  formula: string;
  children: ReactNode;
  last?: boolean;
}

// một nhóm cấu thành lương trong phiếu lương
function CompGroup({ color, weight, title, ratio, amount, formula, children, last }: CompGroupProps) {
  return (
    <div className={cn("px-5 py-4", !last && "border-b border-border/50")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 items-center rounded-md px-2 text-[12px] font-bold tabular-nums text-white" style={{ background: color }}>{weight}</span>
          <div>
            <div className="text-[13.5px] font-semibold text-foreground">{title}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{formula}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[14px] font-bold tabular-nums text-foreground">{fmt(amount)} ₫</div>
          <div className="text-[11px] font-semibold tabular-nums" style={{ color }}>tỷ lệ {ratio}%</div>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
