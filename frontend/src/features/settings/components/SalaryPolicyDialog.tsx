import { useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const fieldCls =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] tabular-nums transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

/** Money input: grouped digits (1.234.567) + ₫ suffix, emits a number. */
function MoneyInput({ id, value, onChange }: { id?: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="relative">
      <input
        id={id}
        inputMode="numeric"
        value={fmt(value)}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
        className={cn(fieldCls, "pr-7 text-right font-medium")}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">₫</span>
    </div>
  );
}

function PercentInput({ id, value, onChange }: { id?: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="relative">
      <input id={id} type="number" min={0} max={100} step="0.5" value={value}
        onChange={(e) => onChange(Number(e.target.value))} className={cn(fieldCls, "pr-7 text-right")} />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">%</span>
    </div>
  );
}

/** Minimal section: a quiet label row with hairline divider, then content. */
function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between border-b pb-2">
        <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-foreground">{label}</label>
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
  // Insurance rates (%). Employee total 10.5 · Employer total 20.5.
  const [eeSocial, setEeSocial] = useState(8);
  const [eeHealth, setEeHealth] = useState(1.5);
  const [eeUnemp, setEeUnemp] = useState(1);
  const [erSocial, setErSocial] = useState(17);
  const [erHealth, setErHealth] = useState(3);
  const [erUnemp, setErUnemp] = useState(0.5);
  const [erOccup, setErOccup] = useState(0);
  // Fixed BHXH contribution salary (mức đóng BHXH) + union fee.
  const [socialInsuranceSalary, setSocialInsuranceSalary] = useState(() => num(target?.socialInsuranceSalary ?? undefined, 5_500_000));
  const [unionFeeEnabled, setUnionFeeEnabled] = useState(() => target?.unionFeeEnabled ?? true);
  const [unionFeeRate, setUnionFeeRate] = useState(() => target?.unionFeeRate ?? 1);
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
      socialInsuranceSalary,
      unionFeeRate,
      unionFeeEnabled,
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

  const zones: { label: string; value: number; set: (n: number) => void }[] = [
    { label: "Vùng I", value: zone1, set: setZone1 },
    { label: "Vùng II", value: zone2, set: setZone2 },
    { label: "Vùng III", value: zone3, set: setZone3 },
    { label: "Vùng IV", value: zone4, set: setZone4 },
  ];

  const total = (ok: boolean, label: string) => (
    <span className={cn("text-[12px] font-semibold tabular-nums", ok ? "text-emerald-600" : "text-amber-600")}>{label}</span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa chính sách lương" : "Tạo chính sách lương (VN)"}</DialogTitle>
          <DialogDescription>Tham số BHXH · thuế TNCN · trần đóng và trọng số 20/60/20 dùng để tính lương.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex max-h-[66vh] flex-col gap-7 overflow-y-auto px-0.5 py-1">
          <Section title="Kỳ áp dụng & mức lương">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Field label="Năm áp dụng">
                <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 text-[13px]" />
              </Field>
              <Field label="Hiệu lực từ">
                <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="h-9 text-[13px]" />
              </Field>
              <Field label="Lương cơ sở tính BHXH" hint="Trần BHXH/BHYT = ×20">
                <MoneyInput value={baseSalary} onChange={setBaseSalary} />
              </Field>
              <Field label="Giảm trừ bản thân">
                <MoneyInput value={personalDeduction} onChange={setPersonalDeduction} />
              </Field>
              <Field label="Giảm trừ / người phụ thuộc">
                <MoneyInput value={dependentDeduction} onChange={setDependentDeduction} />
              </Field>
            </div>
          </Section>

          <Section title="Thuế thu nhập cá nhân">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Field label="Người cư trú">
                <div className="flex h-9 items-center rounded-lg border border-dashed bg-muted/30 px-2.5 text-[12.5px] text-muted-foreground">
                  Lũy tiến 7 bậc (5%→35%)
                </div>
              </Field>
              <Field label="Không cư trú" hint="Thuế suất phẳng">
                <PercentInput value={nonResidentTaxRate} onChange={setNonResidentTaxRate} />
              </Field>
            </div>
          </Section>

          <Section title="Mức đóng bảo hiểm" aside={<span className="flex gap-3">{total(eeTotal === 10.5, `NLĐ ${eeTotal}%`)}{total(erTotal === 20.5, `DN ${erTotal}%`)}</span>}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              <Field label="NLĐ · BHXH"><PercentInput value={eeSocial} onChange={setEeSocial} /></Field>
              <Field label="NLĐ · BHYT"><PercentInput value={eeHealth} onChange={setEeHealth} /></Field>
              <Field label="NLĐ · BHTN"><PercentInput value={eeUnemp} onChange={setEeUnemp} /></Field>
              <div className="hidden sm:block" />
              <Field label="DN · BHXH"><PercentInput value={erSocial} onChange={setErSocial} /></Field>
              <Field label="DN · BHYT"><PercentInput value={erHealth} onChange={setErHealth} /></Field>
              <Field label="DN · BHTN"><PercentInput value={erUnemp} onChange={setErUnemp} /></Field>
              <Field label="DN · TNLĐ-BNN"><PercentInput value={erOccup} onChange={setErOccup} /></Field>
            </div>
          </Section>

          <Section title="Mức đóng BHXH cố định & đoàn phí công đoàn">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Field label="Mức lương đóng BHXH" hint="Cố định toàn công ty (vd 5.500.000)">
                <MoneyInput value={socialInsuranceSalary} onChange={setSocialInsuranceSalary} />
              </Field>
              <Field label="Đoàn phí công đoàn (%)" hint="% của mức đóng BHXH">
                <PercentInput value={unionFeeRate} onChange={setUnionFeeRate} />
              </Field>
              <Field label="Áp dụng đoàn phí">
                <label className="flex h-9 cursor-pointer items-center gap-2 text-[12.5px] text-foreground">
                  <input type="checkbox" checked={unionFeeEnabled} onChange={(e) => setUnionFeeEnabled(e.target.checked)} className="size-4 accent-primary" />
                  Trừ đoàn phí vào lương
                </label>
              </Field>
            </div>
          </Section>

          <Section title="Lương tối thiểu vùng">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              {zones.map((z) => (
                <Field key={z.label} label={z.label}>
                  <MoneyInput value={z.value} onChange={z.set} />
                </Field>
              ))}
            </div>
          </Section>

          <Section title="Trọng số cấu phần lương" aside={total(weightOk, `Tổng ${weightSum}%`)}>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
              <Field label="Ngày công"><PercentInput value={wA} onChange={setWA} /></Field>
              <Field label="Hiệu suất"><PercentInput value={wP} onChange={setWP} /></Field>
              <Field label="Mục tiêu"><PercentInput value={wG} onChange={setWG} /></Field>
            </div>
            {!weightOk && <p className="text-[11.5px] text-amber-600">Tổng đang là {weightSum}% — cần điều chỉnh về đúng 100% trước khi lưu.</p>}
          </Section>

          {error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive" role="alert">
              <AlertCircle className="size-4 shrink-0" /> {error}
            </p>
          )}

          <DialogFooter className="sticky bottom-0 -mx-0.5 border-t bg-background/95 px-0.5 pt-3 backdrop-blur">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>Hủy</Button>
            <Button type="submit" size="sm" disabled={submitting || !weightOk}>{submitting ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Tạo chính sách"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
