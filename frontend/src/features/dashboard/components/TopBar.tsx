import { Fragment } from "react";
import { Search, Bell, ChevronRight, Calendar, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  crumbs?: string[];
}

export function TopBar({ crumbs = ["Trang chủ", "Tổng quan"] }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-8">
      <nav className="flex items-center gap-2 text-[13px]">
        {crumbs.map((c, i) => (
          <Fragment key={`${i}-${c}`}>
            {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground/60" />}
            <span
              className={
                i === crumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground"
              }
            >
              {c}
            </span>
          </Fragment>
        ))}
      </nav>

      <div className="relative ml-6 max-w-xl flex-1">
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

      <Button variant="outline" size="icon" className="relative size-9" aria-label="Thông báo">
        <Bell className="size-4" />
        <span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" />
      </Button>
    </header>
  );
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
