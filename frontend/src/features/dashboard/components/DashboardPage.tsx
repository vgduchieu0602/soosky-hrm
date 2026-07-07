import { useEffect, useState } from "react";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar, PageHeader } from "@features/dashboard/components/TopBar";
import {
  TopSummary,
  EmployeesByDept,
  AttendanceToday,
  AttendanceTrend,
} from "@features/dashboard/components/Charts";
import {
  LeavePending,
  UpcomingLeaves,
  PayrollSection,
  TopPerformers,
  RecentActivities,
} from "@features/dashboard/components/Panels";
import { Loader2, AlertTriangle } from "lucide-react";
import { SectionTitle } from "@features/dashboard/components/primitives";
import { dashboardService } from "@features/dashboard/services/dashboard.service";
import type { DashboardOverview } from "@features/dashboard/types/dashboard.types";
import type { TopKpi } from "@features/dashboard/data";
import { attendanceService } from "@features/attendance/services/attendance.service";
import { toast } from "sonner";

const DEPT_PALETTE = ["#00B8F5", "#367BFF", "#8B5CF6", "#10B981", "#F59E0B", "#94A3B8"];

// Map API KPI numbers → the CompactKpi card shape (icon + chip color preserved).
function buildKpis(o: DashboardOverview): TopKpi[] {
  const k = o.kpis;
  return [
    { label: "Tổng nhân viên", value: String(k.totalEmployees), icon: "Users", chip: "blue" },
    { label: "Đang làm việc", value: String(k.activeEmployees), icon: "UserCheck", chip: "emerald" },
    { label: "Tuyển mới tháng này", value: String(k.newHiresThisMonth), icon: "UserPlus", chip: "indigo" },
    { label: "Đang nghỉ hôm nay", value: String(k.onLeaveToday), icon: "CalendarOff", chip: "violet" },
    { label: "Đơn nghỉ chờ duyệt", value: String(k.pendingLeaves), icon: "CalendarDays", chip: "amber" },
    { label: "Đi muộn hôm nay", value: String(k.lateToday), icon: "Clock", chip: "rose" },
    { label: `Lương kỳ ${k.payrollThisMonth.period}`, value: k.payrollThisMonth.total, suffix: "₫", icon: "Wallet", chip: "cyan" },
  ];
}

type LoadState = "loading" | "error" | "ok";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [busyLeave, setBusyLeave] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setState("loading");
    dashboardService
      .overview()
      .then((d) => { if (active) { setData(d); setState("ok"); } })
      .catch(() => { if (active) { setData(null); setState("error"); } });
    return () => { active = false; };
  }, [reloadKey]);

  function approveLeave(id: string) {
    setBusyLeave(id);
    attendanceService
      .approveLeave(id)
      .then(() => { toast.success("Đã phê duyệt đơn nghỉ"); setReloadKey((k) => k + 1); })
      .catch((e) => toast.error(e?.response?.data?.error?.message ?? "Không thể phê duyệt"))
      .finally(() => setBusyLeave(null));
  }

  function rejectLeave(id: string) {
    const reason = window.prompt("Lý do từ chối đơn nghỉ:");
    if (reason == null || !reason.trim()) return;
    setBusyLeave(id);
    attendanceService
      .rejectLeave(id, reason.trim())
      .then(() => { toast.success("Đã từ chối đơn nghỉ"); setReloadKey((k) => k + 1); })
      .catch((e) => toast.error(e?.response?.data?.error?.message ?? "Không thể từ chối"))
      .finally(() => setBusyLeave(null));
  }

  const kpis = data ? buildKpis(data) : [];
  const departments = data
    ? data.departments.map((d, i) => ({ ...d, color: DEPT_PALETTE[i % DEPT_PALETTE.length] }))
    : undefined;
  const attendanceToday = data
    ? [
        { label: "Đúng giờ", value: data.attendanceToday.onTime, color: "#10B981" },
        { label: "Đi muộn", value: data.attendanceToday.late, color: "#F59E0B" },
        { label: "Đang nghỉ", value: data.attendanceToday.onLeave, color: "#8B5CF6" },
        { label: "Chưa chấm", value: data.attendanceToday.notChecked, color: "#CBD5E1" },
      ]
    : undefined;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="dash" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-8">
            <PageHeader />

            {state === "loading" && (
              <div className="flex flex-col items-center justify-center gap-3 py-32 text-muted-foreground">
                <Loader2 className="size-7 animate-spin text-primary-500" />
                <span className="text-[13px]">Đang tải dữ liệu…</span>
              </div>
            )}

            {state === "error" && (
              <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
                <AlertTriangle className="size-8 text-amber-500" />
                <div className="text-[14px] font-semibold text-foreground">Không tải được dữ liệu bảng điều khiển</div>
                <div className="max-w-md text-[12.5px] text-muted-foreground">
                  Kiểm tra kết nối tới máy chủ API và thử lại. (Máy chủ backend phải đang chạy.)
                </div>
                <button
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-1 rounded-lg bg-primary-500 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-600"
                >
                  Thử lại
                </button>
              </div>
            )}

            {state === "ok" && (
              <>
            <TopSummary kpis={kpis} />

            <section className="flex flex-col gap-4">
              <SectionTitle title="Nhân sự & chấm công" subtitle="Phân bố và tình hình hôm nay" />
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-4">
                  <EmployeesByDept items={departments} />
                </div>
                <div className="col-span-4">
                  <AttendanceToday items={attendanceToday} />
                </div>
                <div className="col-span-4">
                  <AttendanceTrend trend={data?.attendanceTrend} />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <SectionTitle title="Nghỉ phép" subtitle="Đơn chờ duyệt và lịch nghỉ sắp tới" />
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-8">
                  <LeavePending items={data?.pendingLeaves} onApprove={approveLeave} onReject={rejectLeave} busyId={busyLeave} />
                </div>
                <div className="col-span-4">
                  <UpcomingLeaves items={data?.upcomingLeaves} />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <SectionTitle title="Lương & hiệu suất" subtitle="Kỳ lương hiện tại và top performers" />
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-5">
                  <PayrollSection data={data?.payroll ?? undefined} />
                </div>
                <div className="col-span-4">
                  <TopPerformers items={data?.performers} />
                </div>
                <div className="col-span-3">
                  <RecentActivities items={data?.activities} />
                </div>
              </div>
            </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
