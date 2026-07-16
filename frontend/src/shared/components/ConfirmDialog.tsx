import { FormModal } from "@shared/components/FormModal";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  title: string;
  /** Body text (supports multi-line via \n). */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Danger styling for destructive confirmations. */
  tone?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation modal — replaces window.confirm() with an in-app dialog
 * matching the FormModal look (backdrop, card, gradient header, footer actions).
 */
export function ConfirmDialog({
  open, title, message, confirmLabel = "Xác nhận", cancelLabel = "Huỷ",
  tone = "default", loading = false, onConfirm, onCancel,
}: Props) {
  const footer = (
    <>
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={tone === "danger" ? "destructive" : "default"}
        disabled={loading}
        onClick={onConfirm}
      >
        {loading ? "Đang xử lý…" : confirmLabel}
      </Button>
    </>
  );

  return (
    <FormModal open={open} onClose={onCancel} title={title} footer={footer} maxWidth={440}>
      {message && (
        <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-foreground/80">{message}</p>
      )}
    </FormModal>
  );
}
