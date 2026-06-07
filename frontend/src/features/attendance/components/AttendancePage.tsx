import { useState, useMemo, useRef, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Search, Download, ChevronDown, Check, Users, Clock, CalendarDays, History, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/shared/utils/cn";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import {
  MARKS,
  MARK_ORDER,
  MONTH_DAYS,
  dow,
  DOW_LABEL,
  isWeekend,
  WORKING_DAYS,
  DEPTS,
  EMPLOYEES,
  summarize,
} from "@features/attendance/data/attendance.data";
import type { ChipColor } from "@features/dashboard/data";
import type { AttendanceEmployee, MarkKey } from "@features/attendance/data/attendance.data";

const chipStyle = (color: ChipColor): CSSProperties => ({
  background: `var(--chip-${color}-bg)`,
  color: `var(--chip-${color}-ink)`,
});

const isHalfMark = (key: MarkKey) => key === "half_work" || key === "half_w_p" || key === "half_p_unpaid";

const STAT_ICON: Record<string, LucideIcon> = { Users, Clock, CalendarDays, History };

interface StatCardProps {
  chip: ChipColor;
  icon: keyof typeof STAT_ICON;
  label: string;
  value: ReactNode;
  sub?: string;
}

function StatCard({ chip, icon, label, value, sub }: StatCardProps) {
  const Icon = STAT_ICON[icon];
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <span className="flex size-11 items-center justify-center rounded-2xl" style={chipStyle(chip)}>
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <div className="text-[22px] font-bold leading-none tabular-nums text-foreground">{value}</div>
        <div className="mt-1 text-[12px] text-muted-foreground">
          {label}
          {sub && <span className="text-muted-foreground/70"> · {sub}</span>}
        </div>
      </div>
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

function FilterSelect({ label, value, options, onChange, valueWidth = 92 }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} className="h-9 gap-2 rounded-full text-[13px]">
        <span className="text-muted-foreground">{label}:</span>
        <span className="inline-block text-left font-semibold" style={{ minWidth: valueWidth }}>
          {value}
        </span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-30 max-h-[280px] min-w-[160px] overflow-y-auto rounded-xl border bg-card p-1.5 shadow-md">
            {options.map((o) => (
              <button
                key={o}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted",
                  value === o && "font-semibold text-primary-600",
                )}
              >
                {o}
                {value === o && <Check className="size-3.5" strokeWidth={2.4} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const dotStyle = (color: ChipColor, half: boolean): CSSProperties =>
  half ? { boxShadow: `inset 0 0 0 2px var(--chip-${color}-ink)` } : { background: `var(--chip-${color}-ink)` };

interface MarkCellProps {
  value?: MarkKey;
  weekend: boolean;
  onChange: (key: MarkKey) => void;
}

function MarkCell({ value, weekend, onChange }: MarkCellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const m = value ? MARKS[value] : null;
  const half = value ? isHalfMark(value) : false;
  return (
    <td className={cn("relative px-0 py-2 text-center", weekend && "bg-slate-50/40")}>
      <button
        ref={ref}
        onClick={() => setOpen((o) => !o)}
        className="group/dot inline-flex size-7 items-center justify-center rounded-full transition hover:bg-muted"
        title={m ? m.label : "Chưa chấm"}
        aria-label={m ? m.label : "Chưa chấm"}
      >
        {m ? (
          <span className="block size-2.5 rounded-full" style={dotStyle(m.color, half)} />
        ) : (
          <span
            className={cn(
              "block size-2.5 rounded-full ring-1 ring-inset ring-border",
              weekend ? "opacity-40" : "opacity-0 group-hover/dot:opacity-100",
            )}
          />
        )}
      </button>
      {open && (
        <div className="absolute left-1/2 top-9 z-40 w-[230px] -translate-x-1/2 rounded-xl border bg-card p-1.5 text-left shadow-md">
          {MARK_ORDER.map((key) => {
            const s = MARKS[key];
            return (
              <button
                key={key}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px] transition-colors hover:bg-muted",
                  value === key && "bg-muted",
                )}
              >
                <span className="inline-flex size-5 shrink-0 items-center justify-center">
                  <span className="block size-2.5 rounded-full" style={dotStyle(s.color, isHalfMark(key))} />
                </span>
                <span className="flex-1 text-foreground">{s.label}</span>
                {value === key && <Check className="size-3.5 text-primary-600" strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
      )}
    </td>
  );
}

const num = (n: number): ReactNode =>
  n === 0 ? (
    <span className="text-muted-foreground/50">—</span>
  ) : (
    <span className="tabular-nums">{Number.isInteger(n) ? n : n.toFixed(1)}</span>
  );

function SumTh({ children, first }: { children: ReactNode; first?: boolean }) {
  return (
    <th
      className={cn(
        "sticky top-0 z-20 bg-card px-3 py-2.5 text-right align-bottom text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/70",
        first && "pl-5",
      )}
      style={{ minWidth: 64 }}
    >
      {children}
    </th>
  );
}
function SumTd({ children, first, strong }: { children: ReactNode; first?: boolean; strong?: boolean }) {
  return (
    <td className={cn("px-3 py-2.5 text-right text-[12.5px] tabular-nums", first && "pl-5", strong ? "font-semibold text-foreground" : "text-muted-foreground")}>
      {children}
    </td>
  );
}

const ALL = "Tất cả";

export default function AttendancePage() {
  const [dept, setDept] = useState<string>(ALL);
  const [month, setMonth] = useState("Tháng 6, 2026");
  const [q, setQ] = useState("");
  const [data, setData] = useState<AttendanceEmployee[]>(() => EMPLOYEES.map((e) => ({ ...e, days: { ...e.days } })));

  const rows = useMemo(
    () =>
      data.filter((e) => {
        if (dept !== ALL && e.dept !== dept) return false;
        if (q && !`${e.name} ${e.code} ${e.dept}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [data, dept, q],
  );

  // Đổi trạng thái chấm công cho 1 ô. Các cột tổng hợp (công thực tế, nghỉ phép,
  // nghỉ lễ, nghỉ chế độ, tổng công, phép dư) tự tính lại qua summarize() khi render.
  // Chọn lại đúng trạng thái đang có sẽ bỏ chấm ô đó (toggle off) → không tính vào tổng.
  const setMark = (empIdx: number, day: number, key: MarkKey) =>
    setData((prev) =>
      prev.map((e, i) => {
        if (i !== empIdx) return e;
        const days = { ...e.days };
        if (days[day] === key) {
          delete days[day];
        } else {
          days[day] = key;
        }
        return { ...e, days };
      }),
    );

  const totals = useMemo(() => {
    const c = (k: MarkKey) => data.reduce((s, e) => s + MONTH_DAYS.filter((d) => e.days[d] === k).length, 0);
    return {
      late: c("late"),
      annual: c("annual") + c("half_w_p") * 0.5 + c("half_p_unpaid") * 0.5,
      remote: c("remote"),
    };
  }, [data]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="att" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Chấm công"]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Chấm công</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  Bảng công {month} · {WORKING_DAYS} ngày công chuẩn · ô chấm cấu hình tại Cài đặt hệ thống.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect
                  label="Tháng"
                  value={month}
                  valueWidth={92}
                  options={["Tháng 4, 2026", "Tháng 5, 2026", "Tháng 6, 2026"]}
                  onChange={setMonth}
                />
                <FilterSelect label="Phòng ban" value={dept} valueWidth={84} options={DEPTS} onChange={setDept} />
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full text-[13px]">
                  <Download className="size-3.5" strokeWidth={1.8} /> Xuất Excel
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <StatCard chip="blue" icon="Users" label="Nhân sự chấm công" value={data.length} />
              <StatCard chip="amber" icon="Clock" label="Lượt đi muộn" value={totals.late} sub="trong tháng" />
              <StatCard chip="violet" icon="CalendarDays" label="Ngày phép đã dùng" value={totals.annual} />
              <StatCard chip="blue" icon="History" label="Ngày remote" value={totals.remote} />
            </div>

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã NV…" className="h-9 pl-10 text-[13px]" />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
                  {(["full", "late", "annual", "remote", "unpaid", "holiday", "makeup"] as MarkKey[]).map((k) => {
                    const s = MARKS[k];
                    return (
                      <span key={k} className="inline-flex items-center gap-1.5">
                        <span className="block size-2 rounded-full" style={{ background: `var(--chip-${s.color}-ink)` }} />
                        <span className="text-muted-foreground">{s.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
                <table className="border-separate text-[12px]" style={{ borderSpacing: 0, minWidth: "100%" }}>
                  <thead>
                    <tr>
                      <th
                        className="sticky left-0 top-0 z-30 bg-card px-5 py-3 text-left align-bottom text-[11px] font-medium tracking-wide text-muted-foreground"
                        style={{ minWidth: 210 }}
                      >
                        NHÂN VIÊN
                      </th>
                      {MONTH_DAYS.map((d) => (
                        <th key={d} className="sticky top-0 z-20 bg-card px-0 py-2.5 text-center align-bottom" style={{ minWidth: 34 }}>
                          <div className={cn("text-[9px] font-medium uppercase leading-none", isWeekend(d) ? "text-rose-300" : "text-muted-foreground/45")}>
                            {DOW_LABEL[dow(d)]}
                          </div>
                          <div className={cn("mt-1 text-[12px] font-semibold leading-none tabular-nums", isWeekend(d) ? "text-rose-400" : "text-foreground/70")}>
                            {d}
                          </div>
                        </th>
                      ))}
                      <SumTh first>Công thực tế</SumTh>
                      <SumTh>Nghỉ phép</SumTh>
                      <SumTh>Nghỉ lễ</SumTh>
                      <SumTh>Nghỉ chế độ</SumTh>
                      <SumTh>Tổng công</SumTh>
                      <SumTh>Phép dư</SumTh>
                      <th
                        className="sticky top-0 z-20 bg-card px-4 py-2.5 text-left align-bottom text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70"
                        style={{ minWidth: 150 }}
                      >
                        Ghi chú
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => {
                      const realIdx = data.indexOf(e);
                      const sm = summarize(e);
                      return (
                        <tr key={e.code} className="group transition-colors hover:bg-slate-50 [&>td]:border-b [&>td]:border-border/40">
                          <td
                            className="sticky left-0 z-10 bg-card px-5 py-2.5 transition-colors group-hover:bg-slate-50"
                            style={{ boxShadow: "1px 0 0 0 var(--border)" }}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8 text-[11px]">
                                <AvatarFallback>{e.initials}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-medium text-foreground">{e.name}</div>
                                <div className="truncate text-[11px] text-muted-foreground/80">
                                  <span className="font-mono">{e.code}</span> · {e.dept}
                                </div>
                              </div>
                            </div>
                          </td>
                          {MONTH_DAYS.map((d) => (
                            <MarkCell key={d} value={e.days[d]} weekend={isWeekend(d)} onChange={(key) => setMark(realIdx, d, key)} />
                          ))}
                          <SumTd first strong>{num(sm.w)}</SumTd>
                          <SumTd>{num(sm.p)}</SumTd>
                          <SumTd>{num(sm.l)}</SumTd>
                          <SumTd>{num(sm.c)}</SumTd>
                          <SumTd strong>{num(sm.total)}</SumTd>
                          <SumTd>
                            <span className={cn("font-semibold tabular-nums", sm.remaining < 0 ? "text-rose-500" : "text-foreground")}>{sm.remaining}</span>
                          </SumTd>
                          <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                            {e.note || <span className="text-muted-foreground/30">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={MONTH_DAYS.length + 8} className="px-4 py-16 text-center text-[13px] text-muted-foreground">
                          Không có nhân viên phù hợp.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-4 py-3 text-[12.5px] text-muted-foreground">
                <span>
                  Hiển thị <b className="text-foreground tabular-nums">{rows.length}</b> / {data.length} nhân viên · {month}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-400" /> Bấm vào ô để chấm công
                </span>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
