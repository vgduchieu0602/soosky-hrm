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
import type { Position } from "@features/organization/types/organization.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Position | null;
  /** Resolve on success; throw to surface the error message. */
  onConfirm: () => Promise<void>;
}

export function DeletePositionDialog({ open, onOpenChange, target, onConfirm }: Props) {
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
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Không thể lưu trữ chức vụ. Vui lòng thử lại.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="size-4.5" strokeWidth={2} />
            </span>
            <div>
              <DialogTitle>Lưu trữ chức vụ</DialogTitle>
              <DialogDescription className="mt-1">
                Lưu trữ chức vụ{" "}
                <span className="font-semibold text-foreground">{target?.title}</span>? Chức vụ sẽ
                ẩn khỏi danh sách chọn nhưng vẫn giữ cho các hồ sơ nhân viên đã gán.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button type="button" size="sm" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Đang lưu trữ…" : "Lưu trữ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
