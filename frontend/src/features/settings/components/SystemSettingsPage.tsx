import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Building2, Users, ShieldCheck, ScrollText, UserCog, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { useAuthStore } from "@core/store/auth.store";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import { CompanySettings } from "@features/settings/components/CompanySettings";
import { UsersSettings, RolesSettings } from "@features/iam/components/UserAccessSettings";
import { AuditLogSettings } from "@features/iam/components/AuditLogSettings";

type TabId = "company" | "users" | "roles" | "audit";
const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: "company", label: "Chung", Icon: Building2 },
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
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Cài đặt hệ thống</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">Cấu hình cấp hệ thống: công ty, người dùng, phân quyền và nhật ký.</p>
              </div>
              <Link to="/settings/account">
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full text-[13px]">
                  <UserCog className="size-3.5" /> Tùy chọn cá nhân
                </Button>
              </Link>
            </div>

            <div className="flex gap-1 border-b">
              {visibleTabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-4 py-3 text-[13px] font-medium transition-colors",
                    tab === id ? "border-primary-500 text-primary-600" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.8} /> {label}
                </button>
              ))}
            </div>

            {tab === "company" && <CompanySettings canManage={isAdmin} />}
            {tab === "users" && <UsersSettings canManage={isAdmin} />}
            {tab === "roles" && isAdmin && <RolesSettings />}
            {tab === "audit" && isAdmin && <AuditLogSettings />}
          </div>
        </main>
      </div>
    </div>
  );
}
