import { X } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Form body (usually a <form id="…"> with the fields). */
  children: React.ReactNode;
  /** Footer actions (Cancel + submit). Submit buttons use `form="…"` to submit a body form. */
  footer?: React.ReactNode;
  /** Max width in px. Default 560. */
  maxWidth?: number;
}

/**
 * Shared create/edit modal shell, matching the "Tạo nhân viên" style:
 * dimmed backdrop, rounded card, navy gradient header (title + subtitle + close),
 * scrollable body, bordered footer. Use across features for a consistent look.
 */
export function FormModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 560,
}: FormModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-secondary-900/50 backdrop-blur-[2px]"
        style={{ animation: "fadeIn .2s ease" }}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-background shadow-2xl",
        )}
        style={{ maxWidth, animation: "fadeIn .2s ease" }}
      >
        {/* header */}
        <div
          className="relative shrink-0 overflow-hidden px-6 pb-5 pt-6 text-white"
          style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
          <h2 className="text-[20px] font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-[13px] text-white/70">{subtitle}</p>}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* footer */}
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-card px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
