import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DepartmentNode } from "@features/organization/types/organization.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DepartmentNode | null;
  /** Resolve with success; throw to surface the error message. */
  onConfirm: () => Promise<void>;
}

export function DeleteDepartmentDialog({
  open,
  onOpenChange,
  target,
  onConfirm,
}: Props) {
  // Parent remounts this component (via a changing `key`) each time a new
  // target is chosen, so these reset per session without an effect.
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ??
        "Không thể xóa phòng ban. Vui lòng thử lại.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const hasChildren = (target?.children.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4.5" strokeWidth={2} />
            </span>
            <div>
              <DialogTitle>Xóa phòng ban</DialogTitle>
              <DialogDescription className="mt-1">
                Bạn có chắc muốn xóa{" "}
                <span className="font-semibold text-foreground">
                  {target?.name}
                </span>
                ? Hành động này xóa vĩnh viễn phòng ban và không thể hoàn tác.
                Nếu phòng ban còn nhân viên, vị trí hoặc phòng ban con, hệ thống
                sẽ báo và không cho xóa.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {hasChildren && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">
            Phòng ban này có {target?.children.length} đơn vị con. Các đơn vị con
            sẽ không bị lưu trữ tự động.
          </p>
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Đang xóa…" : "Xóa vĩnh viễn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
