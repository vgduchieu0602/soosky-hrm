import { useState } from "react";
import { FormModal } from "@shared/components/FormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/utils/cn";
import { payrollService } from "@features/payroll/services/payroll.service";
import type { PayrollPeriod } from "@features/payroll/types/payroll.types";
import {
  allowanceFormSchema, bonusFormSchema, deductionFormSchema, fieldErrors, taxProfileFormSchema,
} from "@features/payroll/schemas/payroll.schema";

export type CompKind = "allowance" | "bonus" | "deduction" | "taxProfile";

export interface EmpOption {
  id: string;
  name: string;
  code: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmpOption[];
  periods: PayrollPeriod[];
  defaultPeriodId?: string;
  /** Called after a successful save so the parent can refetch. */
  onSaved: () => void;
}

const KINDS: { value: CompKind; label: string }[] = [
  { value: "allowance", label: "Phụ cấp" },
  { value: "bonus", label: "Thưởng" },
  { value: "deduction", label: "Khấu trừ" },
  { value: "taxProfile", label: "Hồ sơ thuế" },
];

const today = () => new Date().toISOString().slice(0, 10);
const fieldCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function CompensationDialog({
  open, onOpenChange, employees, periods, defaultPeriodId, onSaved,
}: Props) {
  const [kind, setKind] = useState<CompKind>("allowance");
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"fixed" | "percentage">("fixed");
  const [amount, setAmount] = useState(0);
  const [isTaxable, setIsTaxable] = useState(true);
  const [isInsuranceBase, setIsInsuranceBase] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [payrollPeriodId, setPayrollPeriodId] = useState(defaultPeriodId ?? "");
  const [recurring, setRecurring] = useState(true);
  const [dependentsCount, setDependentsCount] = useState(0);
  const [isResident, setIsResident] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fErrors, setFErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs =
      kind === "allowance"
        ? fieldErrors(allowanceFormSchema, { employeeId, name, type, amount, effectiveDate })
        : kind === "bonus"
          ? fieldErrors(bonusFormSchema, { employeeId, payrollPeriodId, name, amount })
          : kind === "deduction"
            ? fieldErrors(deductionFormSchema, { employeeId, name, type, amount, effectiveDate })
            : fieldErrors(taxProfileFormSchema, { employeeId, dependentsCount, effectiveDate });
    setFErrors(errs ?? {});
    return !errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (kind === "allowance") {
        await payrollService.createAllowance({ employeeId, name, type, amount, isTaxable, isInsuranceBase, effectiveDate });
      } else if (kind === "bonus") {
        await payrollService.createBonus({ employeeId, payrollPeriodId, name, amount, isTaxable });
      } else if (kind === "deduction") {
        await payrollService.createDeduction({
          employeeId, name, type, amount, effectiveDate,
          payrollPeriodId: recurring ? null : (payrollPeriodId || null),
        });
      } else {
        await payrollService.upsertTaxProfile({ employeeId, dependentsCount, isResident, effectiveDate });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Lưu thất bại. Vui lòng thử lại.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const footer = (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>Hủy</Button>
      <Button type="submit" form="compensation-form" size="sm" disabled={submitting}>{submitting ? "Đang lưu…" : "Lưu"}</Button>
    </>
  );

  return (
    <FormModal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Nhập cấu phần lương"
      subtitle="Thêm phụ cấp, thưởng, khấu trừ hoặc hồ sơ thuế cho nhân viên."
      maxWidth={640}
      footer={footer}
    >
        {/* kind tabs */}
        <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
          {KINDS.map((kd) => (
            <button key={kd.value} type="button" onClick={() => { setKind(kd.value); setFErrors({}); }}
              className={cn("flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                kind === kd.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {kd.label}
            </button>
          ))}
        </div>

        <form id="compensation-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-emp">Nhân viên *</Label>
            <select id="c-emp" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={fieldCls}>
              <option value="">— Chọn nhân viên —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.code} · {e.name}</option>)}
            </select>
            {fErrors.employeeId && <span className="text-[11px] text-destructive">{fErrors.employeeId}</span>}
          </div>

          {kind !== "taxProfile" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="c-name">Tên khoản *</Label>
                <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={kind === "allowance" ? "VD: Phụ cấp ăn trưa" : "VD: Thưởng quý 2"} maxLength={120} />
                {fErrors.name && <span className="text-[11px] text-destructive">{fErrors.name}</span>}
              </div>

              {(kind === "allowance" || kind === "deduction") && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="c-type">Loại</Label>
                  <select id="c-type" value={type} onChange={(e) => setType(e.target.value as "fixed" | "percentage")} className={fieldCls}>
                    <option value="fixed">Cố định (VND)</option>
                    <option value="percentage">{kind === "deduction" ? "% lương gross" : "% lương cơ bản"}</option>
                  </select>
                </div>
              )}

              {kind === "bonus" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="c-period">Kỳ lương *</Label>
                  <select id="c-period" value={payrollPeriodId} onChange={(e) => setPayrollPeriodId(e.target.value)} className={fieldCls}>
                    <option value="">— Chọn kỳ —</option>
                    {periods.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  {fErrors.payrollPeriodId && <span className="text-[11px] text-destructive">{fErrors.payrollPeriodId}</span>}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-amount">{type === "percentage" && (kind === "allowance" || kind === "deduction") ? "Tỷ lệ (%)" : "Số tiền (VND)"} *</Label>
                <Input id="c-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                {fErrors.amount && <span className="text-[11px] text-destructive">{fErrors.amount}</span>}
              </div>

              {kind === "deduction" && (
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Phạm vi áp dụng</Label>
                  <div className="flex gap-1 rounded-lg bg-muted p-1">
                    <button type="button" onClick={() => setRecurring(true)}
                      className={cn("flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                        recurring ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                      Định kỳ (mọi kỳ)
                    </button>
                    <button type="button" onClick={() => setRecurring(false)}
                      className={cn("flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                        !recurring ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                      Một kỳ
                    </button>
                  </div>
                  {!recurring && (
                    <select value={payrollPeriodId} onChange={(e) => setPayrollPeriodId(e.target.value)} className={cn(fieldCls, "mt-1")}>
                      <option value="">— Chọn kỳ áp dụng —</option>
                      {periods.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              {kind !== "deduction" && (
                <label className="col-span-2 flex items-center gap-2 text-[13px] text-foreground">
                  <input type="checkbox" checked={isTaxable} onChange={(e) => setIsTaxable(e.target.checked)} />
                  Chịu thuế TNCN
                </label>
              )}
              {kind === "allowance" && (
                <label className="col-span-2 flex items-center gap-2 text-[13px] text-foreground">
                  <input type="checkbox" checked={isInsuranceBase} onChange={(e) => setIsInsuranceBase(e.target.checked)} />
                  Tính vào nền đóng bảo hiểm
                </label>
              )}
            </div>
          )}

          {kind === "taxProfile" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-deps">Số người phụ thuộc *</Label>
                <Input id="c-deps" type="number" min={0} value={dependentsCount} onChange={(e) => setDependentsCount(Number(e.target.value))} />
                {fErrors.dependentsCount && <span className="text-[11px] text-destructive">{fErrors.dependentsCount}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-eff">Hiệu lực từ *</Label>
                <Input id="c-eff" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                {fErrors.effectiveDate && <span className="text-[11px] text-destructive">{fErrors.effectiveDate}</span>}
              </div>
              <label className="col-span-2 flex items-center gap-2 text-[13px] text-foreground">
                <input type="checkbox" checked={isResident} onChange={(e) => setIsResident(e.target.checked)} />
                Cá nhân cư trú (thuế lũy tiến)
              </label>
            </div>
          )}

          {(kind === "allowance" || kind === "deduction") && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-eff2">Hiệu lực từ *</Label>
              <Input id="c-eff2" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              {fErrors.effectiveDate && <span className="text-[11px] text-destructive">{fErrors.effectiveDate}</span>}
            </div>
          )}

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">{error}</p>}
        </form>
    </FormModal>
  );
}
