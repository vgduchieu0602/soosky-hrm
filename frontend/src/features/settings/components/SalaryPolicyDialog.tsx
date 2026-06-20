import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/utils/cn";
import { settingsService } from "@features/settings/services/settings.service";
import type { SalaryPolicy } from "@features/settings/types/settings.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target?: SalaryPolicy | null;
  onSaved: () => void;
}

const num = (v: string | number | undefined, d = 0) => Number(v ?? d) || d;
const fmt = (n: number) => (n ? n.toLocaleString("vi-VN") : "0");

const VN_TAX_BRACKETS = [
  { upTo: 5_000_000, rate: 5 }, { upTo: 10_000_000, rate: 10 }, { upTo: 18_000_000, rate: 15 },
  { upTo: 32_000_000, rate: 20 }, { upTo: 52_000_000, rate: 25 }, { upTo: 80_000_000, rate: 30 }, { upTo: null, rate: 35 },
];
/** Money input: shows grouped digits (1.234.567) + ₫ suffix, emits a number. */
function MoneyInput({ id, value, onChange }: {
  id?: string; value: number; onChange: (n: number) => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        inputMode="numeric"
        value={fmt(value)}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
        className="h-9 w-full rounded-lg border border-input bg-card pl-2.5 pr-7 text-right text-[13px] font-medium tabular-nums focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">₫</span>
    </div>
  );
}

function PercentInput({ id, value, onChange }: { id?: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="relative">
      <Input id={id} type="number" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="h-9 pr-7 text-right text-[13px] tabular-nums" />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">%</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}

/** Fixed-width labelled field block — keeps the form tidy & horizontal. */
function FieldBlock({ label, hint, width = "w-[180px]", children }: {
  label: string; hint?: string; width?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", width)}>
      <Label>{label}</Label>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function SalaryPolicyDialog({ open, onOpenChange, target, onSaved }: Props) {
  const isEdit = !!target;
  const [year, setYear] = useState(() => target?.year ?? new Date().getFullYear());
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => target?.effectiveFrom?.slice(0, 10) ?? `${new Date().getFullYear()}-01-01`,
  );
  const [baseSalary, setBaseSalary] = useState(() => num(target?.baseSalary, 2_340_000));
  const [personalDeduction, setPersonalDeduction] = useState(() => num(target?.personalDeduction, 11_000_000));
  const [dependentDeduction, setDependentDeduction] = useState(() => num(target?.dependentDeduction, 4_400_000));
  const [nonResidentTaxRate, setNonResidentTaxRate] = useState(() => target?.nonResidentTaxRate ?? 20);
  const [zone1, setZone1] = useState(4_960_000);
  const [zone2, setZone2] = useState(4_410_000);
  const [zone3, setZone3] = useState(3_860_000);
  const [zone4, setZone4] = useState(3_450_000);
  const [wA, setWA] = useState(() => target?.salaryComponentWeights.attendance ?? 20);
  const [wP, setWP] = useState(() => target?.salaryComponentWeights.performance ?? 60);
  const [wG, setWG] = useState(() => target?.salaryComponentWeights.goal ?? 20);
  // Insurance rates (%). Employee total 10.5 · Employer total 21.5.
  const [eeSocial, setEeSocial] = useState(8);
  const [eeHealth, setEeHealth] = useState(1.5);
  const [eeUnemp, setEeUnemp] = useState(1);
  const [erSocial, setErSocial] = useState(17);
  const [erHealth, setErHealth] = useState(3);
  const [erUnemp, setErUnemp] = useState(1);
  const [erOccup, setErOccup] = useState(0.5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weightSum = wA + wP + wG;
  const weightOk = weightSum === 100;
  const eeTotal = +(eeSocial + eeHealth + eeUnemp).toFixed(2);
  const erTotal = +(erSocial + erHealth + erUnemp + erOccup).toFixed(2);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !weightOk) return;
    setSubmitting(true);
    setError(null);
    const payload = {
      country: "VN", year, effectiveFrom, baseSalary,
      regionalMinWage: { zone1, zone2, zone3, zone4 },
      insuranceCeilingMultiplier: 20,
      personalDeduction, dependentDeduction, nonResidentTaxRate,
      taxBrackets: VN_TAX_BRACKETS,
      insuranceRates: {
        employee: { social: eeSocial, health: eeHealth, unemployment: eeUnemp },
        employer: { social: erSocial, health: erHealth, unemployment: erUnemp, occupational: erOccup },
      },
      salaryComponentWeights: { attendance: wA, performance: wP, goal: wG },
    };
    try {
      if (isEdit && target) await settingsService.updatePolicy(target._id, payload);
      else await settingsService.createPolicy(payload);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const d = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
      setError(d?.error?.message ?? d?.message ?? "Không lưu được chính sách.");
    } finally {
      setSubmitting(false);
    }
  }

  const zones: { label: string; value: number; set: (n: number) => void; hint: string }[] = [
    { label: "Vùng I", value: zone1, set: setZone1, hint: "Nội thành HN, HCM…" },
    { label: "Vùng II", value: zone2, set: setZone2, hint: "Ngoại thành, TP lớn" },
    { label: "Vùng III", value: zone3, set: setZone3, hint: "Thành phố tỉnh" },
    { label: "Vùng IV", value: zone4, set: setZone4, hint: "Còn lại" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa chính sách lương" : "Tạo chính sách lương (VN)"}</DialogTitle>
          <DialogDescription>Tham số BHXH/thuế/trần & trọng số 20/60/20 dùng để tính lương.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex max-h-[68vh] flex-col gap-5 overflow-y-auto px-0.5 pb-1">
          {/* Kỳ áp dụng + mức lương & giảm trừ */}
          <section className="flex flex-col gap-3">
            <SectionTitle>Kỳ áp dụng & mức lương</SectionTitle>
            <div className="flex flex-wrap gap-4">
              <FieldBlock label="Năm áp dụng" width="w-[120px]">
                <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 text-[13px]" />
              </FieldBlock>
              <FieldBlock label="Hiệu lực từ" width="w-[160px]">
                <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="h-9 text-[13px]" />
              </FieldBlock>
              <FieldBlock label="Mức lương cơ sở tính BHXH" hint="Trần BHXH/BHYT = ×20" width="w-[220px]">
                <MoneyInput value={baseSalary} onChange={setBaseSalary} />
              </FieldBlock>
              <FieldBlock label="Giảm trừ bản thân" width="w-[180px]">
                <MoneyInput value={personalDeduction} onChange={setPersonalDeduction} />
              </FieldBlock>
              <FieldBlock label="Giảm trừ / người phụ thuộc" width="w-[180px]">
                <MoneyInput value={dependentDeduction} onChange={setDependentDeduction} />
              </FieldBlock>
            </div>
          </section>

          {/* Thuế TNCN */}
          <section className="flex flex-col gap-3">
            <SectionTitle>Loại thuế TNCN</SectionTitle>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                <span className="text-[12.5px] font-medium text-foreground">Cư trú</span>
                <span className="text-[12px] text-muted-foreground">Biểu thuế lũy tiến 7 bậc</span>
              </div>
              <FieldBlock label="Không cư trú (thuế suất phẳng)" width="w-[200px]">
                <PercentInput value={nonResidentTaxRate} onChange={setNonResidentTaxRate} />
              </FieldBlock>
            </div>
          </section>

          {/* Mức đóng bảo hiểm */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SectionTitle>Mức đóng bảo hiểm</SectionTitle>
              <span className="text-[12px] text-muted-foreground">
                NLĐ <b className={cn("tabular-nums", eeTotal === 10.5 ? "text-emerald-600" : "text-amber-600")}>{eeTotal}%</b>
                {" · "}DN <b className={cn("tabular-nums", erTotal === 21.5 ? "text-emerald-600" : "text-amber-600")}>{erTotal}%</b>
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-foreground">Người lao động (NLĐ)</span>
              <div className="flex flex-wrap gap-4">
                <FieldBlock label="BHXH" width="w-[100px]"><PercentInput value={eeSocial} onChange={setEeSocial} /></FieldBlock>
                <FieldBlock label="BHYT" width="w-[100px]"><PercentInput value={eeHealth} onChange={setEeHealth} /></FieldBlock>
                <FieldBlock label="BHTN" width="w-[100px]"><PercentInput value={eeUnemp} onChange={setEeUnemp} /></FieldBlock>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-foreground">Doanh nghiệp (DN)</span>
              <div className="flex flex-wrap gap-4">
                <FieldBlock label="BHXH" width="w-[100px]"><PercentInput value={erSocial} onChange={setErSocial} /></FieldBlock>
                <FieldBlock label="BHYT" width="w-[100px]"><PercentInput value={erHealth} onChange={setErHealth} /></FieldBlock>
                <FieldBlock label="BHTN" width="w-[100px]"><PercentInput value={erUnemp} onChange={setErUnemp} /></FieldBlock>
                <FieldBlock label="TNLĐ-BNN" width="w-[100px]"><PercentInput value={erOccup} onChange={setErOccup} /></FieldBlock>
              </div>
            </div>
          </section>

          {/* Lương tối thiểu vùng */}
          <section className="flex flex-col gap-3">
            <SectionTitle>Lương tối thiểu vùng (BHTN ×20)</SectionTitle>
            <div className="flex flex-wrap gap-4">
              {zones.map((z) => (
                <FieldBlock key={z.label} label={z.label} hint={z.hint} width="w-[180px]">
                  <MoneyInput value={z.value} onChange={z.set} />
                </FieldBlock>
              ))}
            </div>
          </section>

          {/* Trọng số 20/60/20 */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SectionTitle>Trọng số cấu phần lương</SectionTitle>
              <span className={cn("text-[12px] font-semibold tabular-nums", weightOk ? "text-emerald-600" : "text-amber-600")}>
                Tổng {weightSum}%{!weightOk && " (phải = 100%)"}
              </span>
            </div>
            <div className="flex flex-wrap gap-4">
              {[
                { label: "Ngày công", v: wA, set: setWA },
                { label: "Hiệu suất", v: wP, set: setWP },
                { label: "Mục tiêu", v: wG, set: setWG },
              ].map((w) => (
                <FieldBlock key={w.label} label={w.label} width="w-[120px]">
                  <PercentInput value={w.v} onChange={w.set} />
                </FieldBlock>
              ))}
            </div>
          </section>

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">{error}</p>}

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>Hủy</Button>
            <Button type="submit" size="sm" disabled={submitting || !weightOk}>{submitting ? "Đang lưu…" : "Lưu chính sách"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
