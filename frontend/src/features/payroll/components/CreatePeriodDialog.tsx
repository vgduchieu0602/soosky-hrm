import { useState } from "react";
import { FormModal } from "@shared/components/FormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { MonthField } from "@/components/ui/month-field";
import { Label } from "@/components/ui/label";
import type { CreatePeriodInput } from "@features/payroll/types/payroll.types";
import { fieldErrors, periodFormSchema } from "@features/payroll/schemas/payroll.schema";

/** Canonical "YYYY-MM" → the month's calendar bounds (first/last day), yyyy-mm-dd. */
function monthBounds(name: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(name);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const last = new Date(y, mo, 0).getDate();
  const p2 = (n: number) => String(n).padStart(2, "0");
  return { start: `${m[1]}-${m[2]}-01`, end: `${m[1]}-${m[2]}-${p2(last)}` };
}

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
  const [autoDays, setAutoDays] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fErrors, setFErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    // When "auto" is on, the backend derives standardWorkDays from the period
    // calendar (minus weekends + holidays); pass a dummy only to satisfy the schema.
    const values = { name, startDate, endDate, payDate, standardWorkDays: autoDays ? 22 : standardWorkDays };
    const errs = fieldErrors(periodFormSchema, values);
    if (errs) { setFErrors(errs); return; }
    setFErrors({});
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, startDate, endDate, payDate, ...(autoDays ? {} : { standardWorkDays }) });
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

  // When the month is set, pre-fill the date fields with that month's bounds
  // (user can still override). Keeps "tạo kỳ" to two quick steps.
  function onMonthChange(canonical: string) {
    setName(canonical);
    const b = monthBounds(canonical);
    if (b) {
      setStartDate((cur) => cur || b.start);
      setEndDate((cur) => cur || b.end);
      setPayDate((cur) => cur || b.end);
    }
  }

  const footer = (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>Hủy</Button>
      <Button type="submit" form="period-form" size="sm" disabled={submitting}>{submitting ? "Đang tạo…" : "Tạo kỳ"}</Button>
    </>
  );

  return (
    <FormModal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Tạo kỳ"
      subtitle="Một kỳ dùng chung cho chấm công, đánh giá và bảng lương. Nhập tháng vd 072026 → 07-2026."
      footer={footer}
    >
        <form id="period-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="p-name">Tháng kỳ (MM-YYYY) *</Label>
              <MonthField id="p-name" value={name} onChange={onMonthChange} autoFocus />
              {fErrors.name && <span className="text-[11px] text-destructive">{fErrors.name}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-start">Bắt đầu *</Label>
              <DateField id="p-start" className="h-9 w-full rounded-md border border-input bg-background px-3" value={startDate} onChange={setStartDate} />
              {fErrors.startDate && <span className="text-[11px] text-destructive">{fErrors.startDate}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-end">Kết thúc *</Label>
              <DateField id="p-end" className="h-9 w-full rounded-md border border-input bg-background px-3" value={endDate} onChange={setEndDate} />
              {fErrors.endDate && <span className="text-[11px] text-destructive">{fErrors.endDate}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-pay">Ngày chi *</Label>
              <DateField id="p-pay" className="h-9 w-full rounded-md border border-input bg-background px-3" value={payDate} onChange={setPayDate} />
              {fErrors.payDate && <span className="text-[11px] text-destructive">{fErrors.payDate}</span>}
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="p-days">Ngày công chuẩn</Label>
              <label className="flex items-center gap-2 text-[12.5px] text-foreground">
                <input type="checkbox" checked={autoDays} onChange={(e) => setAutoDays(e.target.checked)} className="size-4 accent-primary-500" />
                Tự tính theo lịch (trừ T7/CN &amp; ngày lễ)
              </label>
              {!autoDays && (
                <Input id="p-days" type="number" min={1} max={31} value={standardWorkDays}
                  onChange={(e) => setStandardWorkDays(Number(e.target.value))} className="mt-1" />
              )}
              {!autoDays && fErrors.standardWorkDays && <span className="text-[11px] text-destructive">{fErrors.standardWorkDays}</span>}
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">{error}</p>
          )}
        </form>
    </FormModal>
  );
}
