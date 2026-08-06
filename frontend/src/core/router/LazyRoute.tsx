import { Component, Suspense, type ReactNode } from "react";
import { Loader2, WifiOff } from "lucide-react";

/**
 * Khung cho một route được nạp theo nhu cầu: chờ chunk (`Suspense`) và bắt lỗi
 * khi chunk KHÔNG tải được (`ChunkErrorBoundary`).
 *
 * Vì sao cần error fallback riêng: sau khi deploy bản mới, tab đang mở của người
 * dùng vẫn trỏ tới file chunk cũ đã bị xoá — `import()` reject và React unmount
 * cả nhánh route, cho ra trang trắng. Ở đây hiện thông báo + nút tải lại.
 */
export function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </ChunkErrorBoundary>
  );
}

function RouteLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background" role="status" aria-live="polite">
      <span className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
        <Loader2 className="size-5 animate-spin text-primary-500" /> Đang tải trang…
      </span>
    </div>
  );
}

interface BoundaryState { failed: boolean }

class ChunkErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    // Ghi log để phân biệt "chunk mất sau deploy" với lỗi render thật của trang.
    console.error("Không tải được chunk của route:", error);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <WifiOff className="size-8 text-amber-500" />
        <div className="text-[14px] font-semibold text-foreground">Không tải được trang này</div>
        <p className="max-w-md text-[12.5px] text-muted-foreground">
          Có thể do mất kết nối, hoặc hệ thống vừa được cập nhật nên phiên bản đang mở đã cũ. Tải lại trang để lấy bản mới.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-1 cursor-pointer rounded-lg bg-primary-500 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-600"
        >
          Tải lại
        </button>
      </div>
    );
  }
}
