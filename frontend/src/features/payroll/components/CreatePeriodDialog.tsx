import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreatePeriodInput } from "@features/payroll/types/payroll.types";
import { fieldErrors, periodFormSchema } from "@features/payroll/schemas/payroll.schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolve on success; throw to surface the error inside the dialog. */
  onSubmit: (input: CreatePeriodInput) => Promise<void>;
}

export function CreatePeriodDialog({ open, onOpenChange, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [payDate, setPayDate] = useState("");
  const [standardWorkDays, setStandardWorkDays] = useState(22);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fErrors, setFErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const values = { name, startDate, endDate, payDate, standardWorkDays };
    const errs = fieldErrors(periodFormSchema, values);
    if (errs) { setFErrors(errs); return; }
    setFErrors({});
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, startDate, endDate, payDate, standardWorkDays });
      onOpenChange(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Không tạo được kỳ lương. Vui lòng thử lại.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo kỳ lương</DialogTitle>
          <DialogDescription>Mỗi kỳ tương ứng một tháng lương, vd 2026-06.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="p-name">Mã kỳ (YYYY-MM) *</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="2026-06" autoFocus />
              {fErrors.name && <span className="text-[11px] text-destructive">{fErrors.name}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-start">Bắt đầu *</Label>
              <Input id="p-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              {fErrors.startDate && <span className="text-[11px] text-destructive">{fErrors.startDate}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-end">Kết thúc *</Label>
              <Input id="p-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              {fErrors.endDate && <span className="text-[11px] text-destructive">{fErrors.endDate}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-pay">Ngày chi *</Label>
              <Input id="p-pay" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              {fErrors.payDate && <span className="text-[11px] text-destructive">{fErrors.payDate}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-days">Ngày công chuẩn</Label>
              <Input id="p-days" type="number" min={1} max={31} value={standardWorkDays}
                onChange={(e) => setStandardWorkDays(Number(e.target.value))} />
              {fErrors.standardWorkDays && <span className="text-[11px] text-destructive">{fErrors.standardWorkDays}</span>}
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>Hủy</Button>
            <Button type="submit" size="sm" disabled={submitting}>{submitting ? "Đang tạo…" : "Tạo kỳ lương"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
