import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Building2, Users, ShieldCheck, ScrollText, UserCog, CalendarClock, Wallet, Landmark, Settings2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { useAuthStore } from "@core/store/auth.store";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import { CompanySettings } from "@features/settings/components/CompanySettings";
import { SalaryPerformanceSettings } from "@features/settings/components/SalaryPerformanceSettings";
import { AttendanceCatalogSettings } from "@features/settings/components/AttendanceCatalogSettings";
import { BankTransferProfileSettings } from "@features/settings/components/BankTransferProfileSettings";
import { UsersSettings, RolesSettings } from "@features/iam/components/UserAccessSettings";
import { AuditLogSettings } from "@features/iam/components/AuditLogSettings";

type TabId = "company" | "salary" | "attendance" | "banks" | "users" | "roles" | "audit";
const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: "company", label: "Chung", Icon: Building2 },
  { id: "salary", label: "Lương & Hiệu suất", Icon: Wallet },
  { id: "attendance", label: "Chấm công", Icon: CalendarClock },
  { id: "banks", label: "Ngân hàng", Icon: Landmark },
  { id: "users", label: "Người dùng", Icon: Users },
  { id: "roles", label: "Vai trò & quyền", Icon: ShieldCheck },
  { id: "audit", label: "Nhật ký", Icon: ScrollText },
];

export default function SystemSettingsPage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const isAdmin = roles.includes("admin");
  const isHrOrAdmin = isAdmin || roles.includes("hr_manager");
  const [tab, setTab] = useState<TabId>("company");

  // System settings are admin/HR-only. Everyone else goes to personal options.
  if (!isHrOrAdmin) return <Navigate to="/settings/account" replace />;

  // HR can see company + users + audit is admin-only; gate the tab list.
  const visibleTabs = TABS.filter((t) => (t.id === "audit" || t.id === "roles" ? isAdmin : true));

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Cài đặt hệ thống"]} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
                  <Settings2 className="size-[22px]" strokeWidth={2} />
                </span>
                <div>
                  <h1 className="text-[24px] font-bold leading-tight tracking-tight text-foreground sm:text-[26px]">Cài đặt hệ thống</h1>
                  <p className="mt-1 text-[13.5px] text-muted-foreground">Cấu hình cấp hệ thống: công ty, lương, chấm công, người dùng và phân quyền.</p>
                </div>
              </div>
              <Link to="/settings/account">
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full text-[13px]">
                  <UserCog className="size-3.5" /> Tùy chọn cá nhân
                </Button>
              </Link>
            </div>

            <div
              role="tablist"
              aria-label="Nhóm cài đặt"
              className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-card p-1.5 shadow-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleTabs.map(({ id, label, Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={active ? 2.2 : 1.8} /> {label}
                  </button>
                );
              })}
            </div>

            {tab === "company" && <CompanySettings canManage={isAdmin} />}
            {tab === "salary" && <SalaryPerformanceSettings canManage={isHrOrAdmin} canManagePolicy={isAdmin} />}
            {tab === "attendance" && <AttendanceCatalogSettings canManage={isHrOrAdmin} />}
            {tab === "banks" && <BankTransferProfileSettings canManage={isHrOrAdmin} />}
            {tab === "users" && <UsersSettings canManage={isAdmin} />}
            {tab === "roles" && isAdmin && <RolesSettings />}
            {tab === "audit" && isAdmin && <AuditLogSettings />}
          </div>
        </main>
      </div>
    </div>
  );
}
