import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { employeeService } from "@features/employee/services/employee.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeIds: string[];
  /** Called after a successful bulk termination. */
  onDone: (result: { terminated: number; skipped: { id: string; reason: string }[] }) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function BulkTerminateDialog({ open, onOpenChange, employeeIds, onDone }: Props) {
  const [terminationDate, setTerminationDate] = useState(today());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (submitting || employeeIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await employeeService.terminateMany(employeeIds, {
        terminationDate,
        reason: reason.trim() || undefined,
      });
      onDone(result);
      onOpenChange(false);
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Không thể cho nghỉ việc hàng loạt. Vui lòng thử lại.",
      );
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
              <DialogTitle>Cho nghỉ việc hàng loạt</DialogTitle>
              <DialogDescription className="mt-1">
                Cho <span className="font-semibold text-foreground">{employeeIds.length}</span> nhân viên đã chọn
                nghỉ việc. Nhân viên đã nghỉ trước đó sẽ được bỏ qua.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bt-date">Ngày nghỉ việc</Label>
            <Input id="bt-date" type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bt-reason">Lý do (tuỳ chọn)</Label>
            <Input id="bt-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="VD: Tái cơ cấu phòng ban" />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>Hủy</Button>
          <Button type="button" size="sm" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Đang xử lý…" : `Cho nghỉ ${employeeIds.length} người`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
