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
import { SectionTitle } from "@features/dashboard/components/primitives";

export default function DashboardPage() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="dash" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-8">
            <PageHeader />

            <TopSummary />

            <section className="flex flex-col gap-4">
              <SectionTitle title="Nhân sự & chấm công" subtitle="Phân bố và tình hình hôm nay" />
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-4">
                  <EmployeesByDept />
                </div>
                <div className="col-span-4">
                  <AttendanceToday />
                </div>
                <div className="col-span-4">
                  <AttendanceTrend />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <SectionTitle title="Nghỉ phép" subtitle="Đơn chờ duyệt và lịch nghỉ sắp tới" />
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-8">
                  <LeavePending />
                </div>
                <div className="col-span-4">
                  <UpcomingLeaves />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <SectionTitle title="Lương & hiệu suất" subtitle="Kỳ lương hiện tại và top performers" />
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-5">
                  <PayrollSection />
                </div>
                <div className="col-span-4">
                  <TopPerformers />
                </div>
                <div className="col-span-3">
                  <RecentActivities />
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
