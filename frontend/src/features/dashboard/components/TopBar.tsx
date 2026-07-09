import { Fragment } from "react";
import { Search, ChevronRight, Calendar, ChevronDown, SlidersHorizontal, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@features/notification/NotificationBell";
import { useUiStore } from "@core/store/ui.store";

interface TopBarProps {
  crumbs?: string[];
}

export function TopBar({ crumbs = ["Trang chủ", "Tổng quan"] }: TopBarProps) {
  const openMobileNav = useUiStore((s) => s.openMobileNav);
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-background px-4 sm:gap-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={openMobileNav}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
        aria-label="Mở menu"
      >
        <Menu className="size-5" />
      </button>

      <nav className="flex min-w-0 items-center gap-2 text-[13px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${i}-${c}`}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />}
              <span className={cnCrumb(last, crumbs.length)}>
                {c}
              </span>
            </Fragment>
          );
        })}
      </nav>

      <div className="relative ml-2 hidden max-w-xl flex-1 sm:ml-6 md:block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Tìm nhân viên, phòng ban, đơn nghỉ phép…"
          className="h-9 bg-muted/50 pl-10 pr-16 text-[13px]"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto md:ml-0">
        <NotificationBell />
      </div>
    </header>
  );
}

// On mobile only the last crumb is shown (space); earlier crumbs hide below sm.
function cnCrumb(last: boolean, total: number): string {
  const base = last ? "truncate font-semibold text-foreground" : "text-muted-foreground";
  const hideEarly = !last && total > 1 ? "hidden sm:inline" : "";
  return [base, hideEarly].filter(Boolean).join(" ");
}

export function PageHeader() {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-foreground">Xin chào, Hiếu</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Thứ năm, 28/05/2026 · Bạn có{" "}
          <span className="font-semibold text-foreground">7 yêu cầu</span> đang chờ phê duyệt.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" className="h-9 gap-2 text-[13px] font-medium">
          <Calendar className="size-3.5" />
          Tháng 5, 2026
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
        <Button variant="outline" className="h-9 gap-2 text-[13px] font-medium">
          <SlidersHorizontal className="size-3.5" />
          Tất cả phòng ban
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
