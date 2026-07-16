import { useState } from "react";
import {
  Users, UserCheck, UserPlus, CalendarOff, CalendarDays, Clock, Wallet,
  ArrowUp, ArrowDown,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/shared/utils/cn";
import { SectionTitle } from "./primitives";
import {
  TOP_KPIS,
  DEPARTMENTS_CHART,
  ATTENDANCE_TODAY,
  ATTENDANCE_TREND,
  type ChipColor,
  type TopKpi,
} from "@features/dashboard/data";

const KPI_ICONS: Record<string, LucideIcon> = {
  Users, UserCheck, UserPlus, CalendarOff, CalendarDays, Clock, Wallet,
};

const CHIP_CLASS: Record<ChipColor, string> = {
  blue: "bg-[#EFF6FF] text-[#3B82F6]",
  emerald: "bg-[#ECFDF5] text-[#10B981]",
  indigo: "bg-[#EEF2FF] text-[#6366F1]",
  violet: "bg-[#F5F3FF] text-[#8B5CF6]",
  amber: "bg-[#FFFBEB] text-[#F59E0B]",
  rose: "bg-[#FFF1F2] text-[#F43F5E]",
  cyan: "bg-[#ECFEFF] text-[#06B6D4]",
};

function CompactKpi({ label, value, suffix, delta, icon, chip = "blue" }: TopKpi) {
  const Icon = KPI_ICONS[icon];
  const positive = delta == null ? null : delta >= 0;
  return (
    <Card className="rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-[14px]",
            CHIP_CLASS[chip],
          )}
        >
          {Icon && <Icon className="size-[18px]" strokeWidth={1.9} />}
        </span>
        {delta != null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
              positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600",
            )}
          >
            {positive
              ? <ArrowUp className="size-3" strokeWidth={2.6} />
              : <ArrowDown className="size-3" strokeWidth={2.6} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-3 text-[11.5px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-[22px] font-bold tracking-tight tabular-nums text-foreground">
          {value}
        </span>
        {suffix && (
          <span className="text-[12px] font-medium text-muted-foreground">{suffix}</span>
        )}
      </div>
    </Card>
  );
}

export function TopSummary({ kpis = TOP_KPIS }: { kpis?: TopKpi[] }) {
  return (
    <section>
      <SectionTitle title="Tổng quan" subtitle="Chỉ số chính tại thời điểm hiện tại" />
      <div className="mt-4 grid grid-cols-7 gap-4">
        {kpis.map((k, i) => (
          <CompactKpi key={`${i}-${k.label}`} {...k} />
        ))}
      </div>
    </section>
  );
}

interface DeptSlice {
  name: string;
  count: number;
  color: string;
}

export function EmployeesByDept({ items = DEPARTMENTS_CHART }: { items?: DeptSlice[] }) {
  const DEPARTMENTS_CHART = items.length ? items : [{ name: "Chưa có dữ liệu", count: 1, color: "#CBD5E1" }];
  const total = DEPARTMENTS_CHART.reduce((s, d) => s + d.count, 0);
  const cx = 100;
  const cy = 100;
  const r = 78;
  const ir = 50;
  const offsets = DEPARTMENTS_CHART.map((_, i) =>
    DEPARTMENTS_CHART.slice(0, i).reduce((s, d) => s + d.count, 0),
  );
  const slices = DEPARTMENTS_CHART.map((d, i) => {
    const startAngle = (offsets[i] / total) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((offsets[i] + d.count) / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + ir * Math.cos(endAngle);
    const iy1 = cy + ir * Math.sin(endAngle);
    const ix2 = cx + ir * Math.cos(startAngle);
    const iy2 = cy + ir * Math.sin(startAngle);
    const large = d.count / total > 0.5 ? 1 : 0;
    const path = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2}`,
      "Z",
    ].join(" ");
    return { path, color: d.color };
  });

  return (
    <Card className="flex h-full flex-col p-6">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-0">
        <div>
          <CardTitle className="text-[15px] font-semibold tracking-tight">
            Employees by Department
          </CardTitle>
          <CardDescription className="mt-0.5 text-[12.5px]">
            Phân bố theo phòng ban
          </CardDescription>
        </div>
        <Badge variant="secondary" className="tabular-nums">{total}</Badge>
      </CardHeader>

      <CardContent className="mt-4 flex flex-1 items-center gap-5 p-0">
        <div className="relative flex-shrink-0">
          <svg viewBox="0 0 200 200" className="h-[150px] w-[150px]">
            {slices.map((s, i) => (
              <path
                key={i}
                d={s.path}
                fill={s.color}
                stroke="hsl(var(--background))"
                strokeWidth="1.5"
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[22px] font-semibold tabular-nums text-foreground">{total}</span>
            <span className="text-[10.5px] text-muted-foreground">Tổng NV</span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-1.5">
          {DEPARTMENTS_CHART.map((d, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span
                className="size-2.5 flex-shrink-0 rounded-sm"
                style={{ background: d.color }}
              />
              <span className="flex-1 truncate text-[12px] text-foreground/80">{d.name}</span>
              <span className="text-[12px] font-semibold tabular-nums text-foreground">
                {d.count}
              </span>
              <span className="w-9 text-right text-[10.5px] tabular-nums text-muted-foreground">
                {((d.count / total) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

interface AttSlice {
  label: string;
  value: number;
  color: string;
}

export function AttendanceToday({ items = ATTENDANCE_TODAY }: { items?: AttSlice[] }) {
  const ATTENDANCE_TODAY = items;
  const max = Math.max(...ATTENDANCE_TODAY.map((a) => a.value), 1);
  const total = ATTENDANCE_TODAY.reduce((s, a) => s + a.value, 0);
  const checked = ATTENDANCE_TODAY[0].value + ATTENDANCE_TODAY[1].value;
  return (
    <Card className="flex h-full flex-col p-6">
      <CardHeader className="p-0">
        <CardTitle className="text-[15px] font-semibold tracking-tight">Attendance Today</CardTitle>
        <CardDescription className="mt-0.5 text-[12.5px]">
          Cập nhật{" "}
          {new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date())}
          {" · "}{total} nhân sự
        </CardDescription>
      </CardHeader>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[26px] font-semibold tabular-nums text-foreground">{checked}</span>
        <span className="text-[13px] font-medium text-muted-foreground">/ {total} đã chấm</span>
      </div>

      <CardContent className="mt-5 flex flex-1 flex-col p-0">
        <div className="flex flex-1 items-end gap-5 px-1" style={{ minHeight: 170 }}>
          {ATTENDANCE_TODAY.map((s, i) => {
            const h = Math.max((s.value / max) * 100, 6);
            return (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[12.5px] font-semibold tabular-nums text-foreground">
                  {s.value}
                </span>
                <div
                  className="w-full rounded-t"
                  style={{ height: `${h}%`, background: s.color, minHeight: 8 }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2.5 flex gap-5 px-1">
          {ATTENDANCE_TODAY.map((s, i) => (
            <span key={i} className="flex-1 text-center text-[11.5px] text-muted-foreground">
              {s.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type TrendRange = "week" | "month";

type TrendData = typeof ATTENDANCE_TREND;

export function AttendanceTrend({ trend = ATTENDANCE_TREND }: { trend?: TrendData }) {
  const [range, setRange] = useState<TrendRange>("month");
  const data = trend[range];

  const W = 600;
  const H = 240;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = data.labels.length;
  const xAt = (i: number) => padL + (i / (n - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - (v / 100) * innerH;
  const attPath = data.attend.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i)} ${yAt(v)}`).join(" ");
  const latePath = data.late.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i)} ${yAt(v)}`).join(" ");

  return (
    <Card className="flex h-full flex-col p-6">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-0">
        <div>
          <CardTitle className="text-[15px] font-semibold tracking-tight">Attendance Trend</CardTitle>
          <CardDescription className="mt-0.5 text-[12.5px]">
            Tỷ lệ đi làm &amp; tỷ lệ đi muộn theo thời gian
          </CardDescription>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as TrendRange)}>
          <TabsList className="h-8">
            <TabsTrigger value="week" className="text-[12px]">Tuần</TabsTrigger>
            <TabsTrigger value="month" className="text-[12px]">Tháng</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <div className="mt-3 flex items-center gap-5 text-[12px]">
        <span className="inline-flex items-center gap-1.5 text-foreground/80">
          <span className="h-2 w-3 rounded-sm bg-primary-500" /> Tỷ lệ đi làm
        </span>
        <span className="inline-flex items-center gap-1.5 text-foreground/80">
          <span className="h-2 w-3 rounded-sm bg-rose-400" /> Tỷ lệ đi muộn
        </span>
      </div>

      <CardContent className="mt-3 flex-1 p-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          style={{ minHeight: 240 }}
        >
          {[0, 25, 50, 75, 100].map((y) => (
            <g key={y}>
              <line
                x1={padL}
                y1={yAt(y)}
                x2={W - padR}
                y2={yAt(y)}
                stroke="hsl(var(--border))"
                strokeDasharray="2 4"
              />
              <text
                x={padL - 6}
                y={yAt(y) + 3}
                fontSize="10"
                fill="#94A3B8"
                textAnchor="end"
                fontFamily="JetBrains Mono"
              >
                {y}
              </text>
            </g>
          ))}

          <path
            d={attPath}
            fill="none"
            stroke="#00B8F5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {data.attend.map((v, i) => (
            <circle
              key={`a${i}`}
              cx={xAt(i)}
              cy={yAt(v)}
              r="3"
              fill="hsl(var(--background))"
              stroke="#00B8F5"
              strokeWidth="1.5"
            />
          ))}

          <path
            d={latePath}
            fill="none"
            stroke="#FB7185"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {data.late.map((v, i) => (
            <circle
              key={`l${i}`}
              cx={xAt(i)}
              cy={yAt(v)}
              r="3"
              fill="hsl(var(--background))"
              stroke="#FB7185"
              strokeWidth="1.5"
            />
          ))}

          {data.labels.map((l, i) => (
            <text
              key={i}
              x={xAt(i)}
              y={H - 8}
              fontSize="10.5"
              fill="#64748B"
              textAnchor="middle"
            >
              {l}
            </text>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}
