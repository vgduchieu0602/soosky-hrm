import {
  LayoutDashboard, Users, Building2, Clock, CalendarDays, Wallet, Trophy,
  ReceiptText, ClipboardList, Settings, ChevronDown, LogOut,
  type LucideIcon,
} from "lucide-react";
import { X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { NAV_ITEMS } from "@features/dashboard/data";
import { useAuthStore } from "@core/store/auth.store";
import { useUiStore } from "@core/store/ui.store";
import { authService } from "@features/auth/services/auth.service";
import logoMark from "@/assets/LOGO.png";

const ROLE_LABEL: Record<string, string> = {
  admin: "Quản trị viên",
  hr_manager: "Quản lý nhân sự",
  manager: "Quản lý",
  employee: "Nhân viên",
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/[\s.@]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "U";
}

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Building2,
  Clock,
  CalendarDays,
  Wallet,
  Trophy,
  ReceiptText,
  ClipboardList,
};

interface SidebarProps {
  active?: string;
}

export default function Sidebar({ active }: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.logout);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const closeMobileNav = useUiStore((s) => s.closeMobileNav);

  const displayName = user?.username ?? "Người dùng";
  const roleLabel = user?.roles?.length ? ROLE_LABEL[user.roles[0]] ?? user.roles[0] : "—";

  function handleLogout() {
    authService.logout().catch(() => {}).finally(() => {
      clearAuth();
      navigate("/auth/login", { replace: true });
    });
  }

  return (
    <>
      {/* Mobile overlay — click to dismiss the drawer. */}
      <div
        onClick={closeMobileNav}
        className={cn(
          "fixed inset-0 z-40 bg-secondary-900/50 backdrop-blur-[2px] transition-opacity lg:hidden",
          mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
      />
      <aside
        className={cn(
          "flex w-[260px] flex-shrink-0 flex-col text-white",
          // Desktop: static column. Mobile: off-canvas drawer.
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0",
          mobileNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0",
        )}
        style={{ background: "#11295C" }}
      >
        <div className="flex items-center gap-3 px-6 pt-6">
          <img src={logoMark} alt="Soosky" className="h-7 w-10 object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="text-[16px] font-bold tracking-tight">Soosky</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
              HRM Admin
            </span>
          </div>
          <button
            type="button"
            onClick={closeMobileNav}
            className="ml-auto flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Đóng menu"
          >
            <X className="size-4" />
          </button>
        </div>

      <Button
        variant="ghost"
        className="mx-4 mt-6 flex h-auto items-center justify-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left hover:bg-white/[0.08] hover:text-white"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-500 text-[13px] font-bold text-white">
          SK
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-white">Soosky JSC</span>
          <span className="block truncate text-[11px] font-normal text-white/45">
            Hà Nội · 248 nhân sự
          </span>
        </span>
        <ChevronDown className="size-3.5 text-white/40" />
      </Button>

      <nav className="mt-6 flex flex-1 flex-col gap-0.5 px-3">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
          Quản lý
        </p>
        {NAV_ITEMS.filter((n) => {
          // "Phiếu lương của tôi" là self-service: ẩn với admin (tài khoản hệ
          // thống không gắn hồ sơ nhân viên nên không có phiếu lương cá nhân).
          if ((n.id === "mypayslips" || n.id === "myeval") && user?.roles?.includes("admin")) return false;
          return true;
        }).map((n) => {
          const Icon = ICONS[n.icon];
          const isActive = active ? n.id === active : pathname.startsWith(n.to);
          return (
            <Link
              key={n.id}
              to={n.to}
              onClick={closeMobileNav}
              className={cn(
                "group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-150",
                isActive
                  ? "bg-white/12 text-white"
                  : "text-white/60 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {Icon && (
                <Icon
                  className={cn(
                    "size-[18px]",
                    isActive ? "text-white" : "text-white/55 group-hover:text-white/80",
                  )}
                  strokeWidth={1.7}
                />
              )}
              <span className="flex-1">{n.label}</span>
            </Link>
          );
        })}

        <p className="mt-6 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
          Hệ thống
        </p>
        <Link
          to="/settings"
          onClick={closeMobileNav}
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <Settings
            className="size-[18px] text-white/55 group-hover:text-white/80"
            strokeWidth={1.7}
          />
          <span className="flex-1">Cài đặt</span>
        </Link>
      </nav>

      <div className="mx-4 mb-5 mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="size-9 bg-white/10 text-[12px] font-semibold text-white">
              <AvatarFallback className="bg-transparent text-white">{initialsFrom(displayName)}</AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-secondary-800 bg-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-white">{displayName}</div>
            <div className="truncate text-[11px] text-white/45">{roleLabel}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Đăng xuất"
          >
            <LogOut className="size-[15px]" />
          </Button>
        </div>
      </div>
      </aside>
    </>
  );
}
