import { Loader2 } from "lucide-react";

/**
 * Màn hình chờ trung tính dùng trong lúc chưa biết người dùng đã đăng nhập hay
 * chưa. Cố tình KHÔNG mang dấu hiệu của trang đăng nhập hay của workspace, để
 * người dùng không thấy giao diện nhấp nháy qua lại.
 */
export function LoadingScreen({ label = "Đang khởi tạo phiên làm việc…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-background"
    >
      <Loader2 className="size-6 animate-spin text-primary-500" />
      <p className="text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}
