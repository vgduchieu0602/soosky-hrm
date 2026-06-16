import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/shared/utils/cn";
import type {
  CreatePositionInput,
  Position,
  UpdatePositionInput,
} from "@features/organization/types/organization.types";
import {
  fieldErrors,
  positionFormSchema,
} from "@features/organization/schemas/organization.schema";

export type PositionFormMode = "create" | "edit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PositionFormMode;
  /** Department the position belongs to (name for the header). */
  departmentName: string;
  /** Position being edited (edit mode). */
  target?: Position | null;
  /** Resolve on success; throw to surface the error inside the dialog. */
  onSubmit: (input: CreatePositionInput | UpdatePositionInput) => Promise<void>;
}

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function PositionFormDialog({
  open,
  onOpenChange,
  mode,
  departmentName,
  target,
  onSubmit,
}: Props) {
  // Parent remounts via a changing `key` per open, so lazy initialisers reset
  // state without a state-syncing effect.
  const isEdit = mode === "edit" && target;
  const [title, setTitle] = useState(() => (isEdit ? target.title : ""));
  const [code, setCode] = useState(() => (isEdit ? target.code : ""));
  const [level, setLevel] = useState<number>(() => (isEdit ? target.level : 1));
  const [description, setDescription] = useState(() =>
    isEdit ? (target.description ?? "") : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fErrors, setFErrors] = useState<Record<string, string>>({});

  const canSubmit =
    title.trim().length > 0 && (mode === "edit" || code.trim().length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const errs = fieldErrors(positionFormSchema, {
      title, code: code.toUpperCase(), level, description,
    });
    if (errs) { setFErrors(errs); return; }
    setFErrors({});
    setSubmitting(true);
    setError(null);

    const payload: CreatePositionInput | UpdatePositionInput =
      mode === "create"
        ? {
            title: title.trim(),
            code: code.trim().toUpperCase(),
            departmentId: "", // filled by the page (it owns the selected dept id)
            level,
            description: description.trim() || undefined,
          }
        : {
            title: title.trim(),
            level,
            description: description.trim() || undefined,
          };

    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Đã có lỗi xảy ra. Vui lòng thử lại.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Thêm chức vụ" : "Chỉnh sửa chức vụ"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? `Thêm chức vụ mới vào phòng ban “${departmentName}”.`
              : `Cập nhật chức vụ trong phòng ban “${departmentName}”.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="pos-title">Tên chức vụ *</Label>
              <Input
                id="pos-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Senior Backend Engineer"
                maxLength={120}
                autoFocus
              />
              {fErrors.title && <span className="text-[11px] text-destructive">{fErrors.title}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pos-code">Mã *</Label>
              <Input
                id="pos-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: BE-SR"
                maxLength={20}
                disabled={mode === "edit"}
                className={cn(mode === "edit" && "opacity-60")}
              />
              {mode === "edit" ? (
                <span className="text-[11px] text-muted-foreground">
                  Mã không thể thay đổi sau khi tạo.
                </span>
              ) : (
                fErrors.code && <span className="text-[11px] text-destructive">{fErrors.code}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pos-level">Cấp bậc</Label>
              <select
                id="pos-level"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    Level {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="pos-desc">Mô tả</Label>
              <Textarea
                id="pos-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn về chức vụ…"
                maxLength={500}
              />
            </div>
          </div>

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
            <Button type="submit" size="sm" disabled={!canSubmit || submitting}>
              {submitting
                ? "Đang lưu…"
                : mode === "create"
                  ? "Thêm chức vụ"
                  : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
