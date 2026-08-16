import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CalendarDays, ClipboardList, Clock, Loader2, ReceiptText, Wallet,
} from "lucide-react";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import { SectionTitle } from "@features/dashboard/components/primitives";
import { useAuthStore } from "@core/store/auth.store";
import { attendanceService } from "@features/attendance/services/attendance.service";
import { payrollService } from "@features/payroll/services/payroll.service";
import { performanceService } from "@features/performance/services/performance.service";
import type { AttendanceRecord, LeaveBalanceRecord, LeaveRequestRecord } from "@features/attendance/types/attendance.types";
import type { PayrollRecord } from "@features/payroll/types/payroll.types";
import type { Evaluation } from "@features/performance/types/performance.types";

/**
 * Bảng điều khiển TỰ PHỤC VỤ cho nhân viên thường.
 *
 * Chỉ ghép các endpoint `/me` mà tài khoản nhân viên vốn đã được phép gọi —
 * KHÔNG chạm tới `/admin/dashboard` (dữ liệu toàn công ty, chỉ HR/Admin). Nhờ
 * vậy màn hình đầu tiên sau khi đăng nhập của nhân viên không còn là lỗi 403.
 */

type LoadState = "loading" | "error" | "ok";

interface SelfData {
  attendance: AttendanceRecord[];
  leaves: LeaveRequestRecord[];
  balances: LeaveBalanceRecord[];
  payslips: PayrollRecord[];
  evaluations: Evaluation[];
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

function money(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString("vi-VN") : "0";
}

export default function EmployeeDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<SelfData | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;

    // `allSettled`: một mảng dữ liệu lỗi (ví dụ chưa có kỳ lương nào) không được
    // làm hỏng cả trang.
    Promise.allSettled([
      attendanceService.myMonth(currentMonth()),
      attendanceService.myLeaves(),
      attendanceService.myBalances(),
      payrollService.myPayslips(),
      performanceService.mine(),
    ]).then((results) => {
      if (!active) return;
      const [attendance, leaves, balances, payslips, evaluations] = results;
      const allFailed = results.every((r) => r.status === "rejected");
      if (allFailed) {
        setState("error");
        return;
      }
      setData({
        attendance: attendance.status === "fulfilled" ? attendance.value.records : [],
        leaves: leaves.status === "fulfilled" ? leaves.value : [],
        balances: balances.status === "fulfilled" ? balances.value : [],
        payslips: payslips.status === "fulfilled" ? payslips.value : [],
        evaluations: evaluations.status === "fulfilled" ? evaluations.value : [],
      });
      setState("ok");
    });

    return () => { active = false; };
  }, []);

  const present = data?.attendance.filter((r) => r.status === "present" || r.status === "late").length ?? 0;
  const late = data?.attendance.filter((r) => r.status === "late").length ?? 0;
  const pendingLeaves = data?.leaves.filter((l) => l.status === "pending").length ?? 0;
  const annual = data?.balances.find((b) => b.leaveType === "annual");
  const remainingAnnual = annual ? annual.entitled - annual.used : null;
  const latestPayslip = data?.payslips[0] ?? null;
  const latestEvaluation = data?.evaluations[0] ?? null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar active="dash" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-6 pb-10 pt-4">
          <div className="mb-2">
            <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
              Xin chào, {user?.username ?? "bạn"}
            </h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Thông tin cá nhân của bạn trong tháng này.
            </p>
          </div>

          {state === "loading" && (
            <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải dữ liệu của bạn…
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
              <AlertTriangle className="size-6 text-amber-500" />
              <p className="text-[13px] text-muted-foreground">
                Không tải được dữ liệu cá nhân. Thử tải lại trang.
              </p>
            </div>
          )}

          {state === "ok" && data && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={Clock} label="Ngày công tháng này" value={String(present)} tone="cyan" />
                <StatCard icon={Clock} label="Lần đi muộn" value={String(late)} tone="rose" />
                <StatCard
                  icon={CalendarDays}
                  label="Phép năm còn lại"
                  value={remainingAnnual === null ? "—" : String(remainingAnnual)}
                  tone="emerald"
                />
                <StatCard icon={CalendarDays} label="Đơn nghỉ chờ duyệt" value={String(pendingLeaves)} tone="amber" />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <Panel title="Phiếu lương gần nhất" icon={Wallet} to="/me/payslips" linkLabel="Xem tất cả">
                  {latestPayslip ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[24px] font-bold tabular-nums text-foreground">
                        {money(latestPayslip.netSalary)}
                      </span>
                      <span className="text-[13px] text-muted-foreground">₫ thực nhận</span>
                    </div>
                  ) : (
                    <Empty text="Chưa có phiếu lương nào được duyệt." />
                  )}
                </Panel>

                <Panel title="Đánh giá gần nhất" icon={ClipboardList} to="/me/evaluations" linkLabel="Xem tất cả">
                  {latestEvaluation ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[24px] font-bold tabular-nums text-foreground">
                        {latestEvaluation.performanceRatio}
                      </span>
                      <span className="text-[13px] text-muted-foreground">điểm hiệu suất</span>
                    </div>
                  ) : (
                    <Empty text="Chưa có kỳ đánh giá nào." />
                  )}
                </Panel>
              </div>

              <div className="mt-8">
                <SectionTitle title="Đơn nghỉ của tôi" />
              </div>
              <div className="mt-3 rounded-2xl border bg-card">
                {data.leaves.length === 0 ? (
                  <Empty text="Bạn chưa gửi đơn nghỉ nào." />
                ) : (
                  <ul className="divide-y">
                    {data.leaves.slice(0, 5).map((leave) => (
                      <li key={leave._id} className="flex items-center justify-between px-4 py-3 text-[13px]">
                        <span>
                          {String(leave.startDate).slice(0, 10)} → {String(leave.endDate).slice(0, 10)}
                        </span>
                        <span className="text-muted-foreground">{leave.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t px-4 py-2.5">
                  <Link to="/leave" className="text-[12.5px] font-medium text-primary-600 hover:underline">
                    Quản lý nghỉ phép
                  </Link>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, tone,
}: { icon: typeof Clock; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Icon className="size-3.5" style={{ color: `var(--chip-${tone}-ink)` }} /> {label}
      </div>
      <div className="mt-1.5 text-[22px] font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function Panel({
  title, icon: Icon, to, linkLabel, children,
}: {
  title: string;
  icon: typeof ReceiptText;
  to: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <Icon className="size-4 text-primary-600" /> {title}
        </h3>
        <Link to={to} className="text-[12.5px] font-medium text-primary-600 hover:underline">
          {linkLabel}
        </Link>
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-center text-[13px] text-muted-foreground">{text}</p>;
}
