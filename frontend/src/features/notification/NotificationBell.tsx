import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, AlertCircle, ShieldCheck, Wallet, CalendarDays, UserPlus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { notificationService, type NotificationItem } from "@features/notification/notification.service";

const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

function iconFor(type: string) {
  switch (type) {
    case "security": return ShieldCheck;
    case "payroll": return Wallet;
    case "leave": return CalendarDays;
    case "account": return UserPlus;
    case "employee": return UserPlus;
    default: return Info;
  }
}

const SEVERITY_INK: Record<string, string> = {
  info: "text-sky-500",
  success: "text-emerald-500",
  warning: "text-amber-500",
  critical: "text-rose-500",
};

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Poll unread count.
  useEffect(() => {
    let active = true;
    const tick = () => { notificationService.unreadCount().then((c) => { if (active) setUnread(c); }).catch(() => {}); };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => { active = false; clearInterval(t); };
  }, []);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      notificationService.list({ limit: 20 }).then(setItems).catch(() => setItems([]));
    }
  }

  function openItem(n: NotificationItem) {
    if (!n.read) {
      notificationService.markRead(n._id).catch(() => {});
      setItems((prev) => prev?.map((x) => (x._id === n._id ? { ...x, read: true } : x)) ?? prev);
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.link) { setOpen(false); navigate(n.link); }
  }

  function markAll() {
    notificationService.markAllRead().then(() => {
      setItems((prev) => prev?.map((x) => ({ ...x, read: true })) ?? prev);
      setUnread(0);
    }).catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="icon" className="relative size-9" aria-label="Thông báo" onClick={toggle}>
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[360px] overflow-hidden rounded-xl border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-[13px] font-semibold text-foreground">Thông báo</span>
            {unread > 0 && (
              <button onClick={markAll} className="inline-flex items-center gap-1 text-[12px] text-primary-600 hover:text-primary-700">
                <CheckCheck className="size-3.5" /> Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {items === null && <p className="px-4 py-6 lg:py-8 text-center text-[13px] text-muted-foreground">Đang tải…</p>}
            {items !== null && items.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
                <Bell className="size-7 opacity-30" />
                <p className="text-[13px]">Chưa có thông báo nào.</p>
              </div>
            )}
            {items?.map((n) => {
              const Icon = iconFor(n.type);
              return (
                <button key={n._id} onClick={() => openItem(n)}
                  className={cn("flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50",
                    !n.read && "bg-primary-50/40")}>
                  {n.severity === "critical" ? <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                    : <Icon className={cn("mt-0.5 size-4 shrink-0", SEVERITY_INK[n.severity] ?? "text-muted-foreground")} />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">{n.title}</span>
                      {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary-500" />}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">{n.message}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground/70">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
