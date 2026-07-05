import {
  Check, X, Wallet, CalendarDays, Clock, UserPlus, Pencil, Send, MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/shared/utils/cn";
import {
  PENDING_LEAVES, UPCOMING_LEAVES, PAYROLL, PERFORMERS, ACTIVITIES,
} from "@features/dashboard/data";

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  Wallet, Check, UserPlus, CalendarDays, Clock, Pencil, Send,
};

function Initials({ initials, className }: { initials: string; className?: string }) {
  return (
    <Avatar className={cn("size-9", className)}>
      <AvatarFallback className="bg-muted text-[12px] font-semibold text-muted-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

type PendingLeave = (typeof PENDING_LEAVES)[number] & { id?: string };

interface LeavePendingProps {
  items?: PendingLeave[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  busyId?: string | null;
}

export function LeavePending({ items = PENDING_LEAVES, onApprove, onReject, busyId }: LeavePendingProps) {
  const PENDING_LEAVES = items;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-[15px] font-semibold tracking-tight">
              Leave Requests · Chờ phê duyệt
            </CardTitle>
            <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 tabular-nums">
              {PENDING_LEAVES.length}
            </Badge>
          </div>
          <CardDescription className="mt-0.5 text-[12.5px]">
            {PENDING_LEAVES.length} đơn xin nghỉ mới nhất
          </CardDescription>
        </div>
        <Button variant="link" className="h-auto p-0 text-[12px] font-medium text-primary-600">
          Xem tất cả →
        </Button>
      </CardHeader>

      {PENDING_LEAVES.length === 0 && (
        <div className="border-t px-6 py-10 text-center text-[13px] text-muted-foreground">
          Không có đơn chờ duyệt
        </div>
      )}
      <ul className="flex flex-col">
        {PENDING_LEAVES.map((p, i) => (
          <li
            key={i}
            className="group flex items-center gap-4 border-t px-6 py-3.5 transition-colors hover:bg-muted/40"
          >
            <Initials initials={p.initials} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-foreground">{p.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span className="text-foreground/80">{p.type}</span>
                <span>·</span>
                <span>{p.duration}</span>
                <span>·</span>
                <span className="font-medium text-foreground/80 tabular-nums">{p.range}</span>
              </div>
            </div>
            <div className="hidden text-right text-[11px] text-muted-foreground md:block">
              Gửi {p.submitted}
            </div>
            <div className="flex items-center gap-1.5 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
              <Button
                variant="outline"
                size="icon"
                disabled={!p.id || busyId === p.id}
                onClick={() => p.id && onReject?.(p.id)}
                className="size-8 text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                aria-label="Từ chối"
              >
                <X className="size-3.5" strokeWidth={2} />
              </Button>
              <Button
                size="icon"
                disabled={!p.id || busyId === p.id}
                onClick={() => p.id && onApprove?.(p.id)}
                className="size-8 bg-emerald-500 hover:bg-emerald-600"
                aria-label="Phê duyệt"
              >
                <Check className="size-3.5" strokeWidth={2.4} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

type UpcomingLeave = (typeof UPCOMING_LEAVES)[number] & { id?: string };

export function UpcomingLeaves({ items = UPCOMING_LEAVES }: { items?: UpcomingLeave[] }) {
  const UPCOMING_LEAVES = items;
  return (
    <Card className="flex h-full flex-col p-6">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-0">
        <div>
          <CardTitle className="text-[15px] font-semibold tracking-tight">Upcoming Leaves</CardTitle>
          <CardDescription className="mt-0.5 text-[12.5px]">
            Nhân viên sắp nghỉ trong 30 ngày tới
          </CardDescription>
        </div>
        <Button variant="link" className="h-auto p-0 text-[12px] font-medium text-primary-600">
          Lịch →
        </Button>
      </CardHeader>

      <CardContent className="mt-3 flex flex-col p-0">
        {UPCOMING_LEAVES.map((u, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 py-3",
              i < UPCOMING_LEAVES.length - 1 && "border-b",
            )}
          >
            <Initials initials={u.initials} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-foreground">{u.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{u.code}</span>
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                {u.type} · {u.duration}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[12.5px] font-semibold tabular-nums text-foreground">
                {u.range}
              </div>
              <div className="text-[11px] text-muted-foreground">{u.relative}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type PayrollData = typeof PAYROLL;

export function PayrollSection({ data = PAYROLL }: { data?: PayrollData }) {
  const p = data;
  const computed = Math.round(p.computedRatio * 100);
  return (
    <Card className="flex h-full flex-col border-secondary-700 bg-secondary-800 p-6 text-white">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Kỳ lương {p.period}
            </span>
            <Badge className="bg-amber-400/15 text-[10px] uppercase tracking-wider text-amber-200 hover:bg-amber-400/15">
              {p.status}
            </Badge>
          </div>
          <CardTitle className="mt-1 text-[18px] font-semibold tracking-tight text-white">
            Bảng lương kỳ {p.period}
          </CardTitle>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-8 border-white/15 bg-transparent text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Tuỳ chọn"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </CardHeader>

      <div className="mt-5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-white/45">
          Total Payroll · Tổng quỹ lương
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[32px] font-semibold tracking-tight tabular-nums">{p.total}</span>
          <span className="text-[14px] font-medium text-white/60">₫</span>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/55">
            Đã tính {Math.round(p.computedRatio * p.headcount)} / {p.headcount} nhân sự
          </span>
          <span className="font-semibold tabular-nums text-white/85">{computed}%</span>
        </div>
        <Progress value={computed} className="mt-2 h-1.5 bg-white/10 [&>div]:bg-primary-500" />
      </div>

      <Separator className="my-5 bg-white/10" />

      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {p.breakdown.map((b, i) => (
          <div key={i}>
            <div className="text-[10px] font-medium uppercase tracking-wider text-white/45">
              {b.label}
            </div>
            <div
              className={cn(
                "mt-0.5 text-[15px] font-semibold tabular-nums",
                "tone" in b && b.tone === "neg" ? "text-amber-300" : "text-white",
              )}
            >
              {b.value} <span className="text-[11px] font-medium text-white/45">₫</span>
            </div>
          </div>
        ))}
      </div>

      <CardFooter className="mt-auto flex items-center justify-between p-0 pt-5">
        <span className="text-[11.5px] text-white/55">
          Dự kiến chi:{" "}
          <span className="font-semibold text-white/85 tabular-nums">{p.payDate}</span>
        </span>
        <Button className="h-auto bg-primary-500 px-3 py-1.5 text-[12px] hover:bg-primary-600">
          Xem chi tiết
        </Button>
      </CardFooter>
    </Card>
  );
}

type Performer = (typeof PERFORMERS)[number];

export function TopPerformers({ items = PERFORMERS }: { items?: Performer[] }) {
  const PERFORMERS = items;
  return (
    <Card className="flex h-full flex-col p-6">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-0">
        <div>
          <CardTitle className="text-[15px] font-semibold tracking-tight">Top Performers</CardTitle>
          <CardDescription className="mt-0.5 text-[12.5px]">
            Tháng 5, 2026 · theo điểm hiệu suất
          </CardDescription>
        </div>
        <Button variant="link" className="h-auto p-0 text-[12px] font-medium text-primary-600">
          Tất cả →
        </Button>
      </CardHeader>

      <CardContent className="mt-3 flex flex-col p-0">
        {PERFORMERS.map((p, i) => (
          <div
            key={p.rank}
            className={cn(
              "flex items-center gap-3 py-3",
              i < PERFORMERS.length - 1 && "border-b",
            )}
          >
            <span className="w-5 text-right font-mono text-[12px] font-medium tabular-nums text-muted-foreground">
              {p.rank}
            </span>
            <Initials initials={p.initials} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-foreground">{p.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                {p.role} · {p.dept}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-semibold tabular-nums text-foreground">{p.score}</div>
              <div className="text-[10.5px] text-muted-foreground">Điểm</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type Activity = (typeof ACTIVITIES)[number];

export function RecentActivities({ items = ACTIVITIES }: { items?: Activity[] }) {
  const ACTIVITIES = items;
  return (
    <Card className="flex h-full flex-col p-6">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-0">
        <div>
          <CardTitle className="text-[15px] font-semibold tracking-tight">Recent Activities</CardTitle>
          <CardDescription className="mt-0.5 text-[12.5px]">Nhật ký hoạt động gần đây</CardDescription>
        </div>
        <Button variant="link" className="h-auto p-0 text-[12px] font-medium text-primary-600">
          Xem nhật ký →
        </Button>
      </CardHeader>

      <CardContent className="relative mt-3 p-0">
        <span className="pointer-events-none absolute bottom-3 left-[15px] top-3 w-px bg-border" />
        <ol>
          {ACTIVITIES.map((a, i) => {
            const Icon = ACTIVITY_ICONS[a.icon];
            return (
              <li key={i} className="relative flex items-start gap-3 py-2.5">
                <span className="relative z-10 flex size-8 flex-shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
                  {Icon && <Icon className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="text-[13px] leading-snug text-foreground/80">
                    <span className="font-semibold text-foreground">{a.who}</span> {a.what}{" "}
                    <span className="font-semibold text-foreground">{a.target}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{a.when}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
