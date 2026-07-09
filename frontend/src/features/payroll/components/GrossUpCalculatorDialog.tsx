import { useState } from "react";
import { Calculator, Loader2, ArrowRight } from "lucide-react";
import { FormModal } from "@shared/components/FormModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fmtVND } from "@/shared/utils/money";
import { payrollService } from "@features/payroll/services/payroll.service";
import type { GrossUpResult, SalaryZone } from "@features/payroll/types/payroll.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ZONES: { value: SalaryZone; label: string }[] = [
  { value: "zone1", label: "Vùng I" },
  { value: "zone2", label: "Vùng II" },
  { value: "zone3", label: "Vùng III" },
  { value: "zone4", label: "Vùng IV" },
];

const fieldCls =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] tabular-nums transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

/** NET → GROSS calculator. Quy đổi lương thực nhận (net) sang gross theo chính sách lương hiệu lực. */
export function GrossUpCalculatorDialog({ open, onOpenChange }: Props) {
  const [net, setNet] = useState(0);
  const [dependentsCount, setDependentsCount] = useState(0);
  const [isResident, setIsResident] = useState(true);
  const [salaryZone, setSalaryZone] = useState<SalaryZone>("zone1");
  const [result, setResult] = useState<GrossUpResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function calculate() {
    if (net <= 0) return;
    setLoading(true); setError(null);
    payrollService
      .calculateGrossUp({ net, dependentsCount, isResident, salaryZone })
      .then((r) => setResult(r))
      .catch((e) => setError(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Không tính được."))
      .finally(() => setLoading(false));
  }

  const footer = (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Đóng</Button>
      <Button size="sm" disabled={loading || net <= 0} onClick={calculate} className="gap-1.5">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />} Tính GROSS
      </Button>
    </>
  );

  return (
    <FormModal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Quy đổi NET → GROSS"
      subtitle="Nhập lương thực nhận mong muốn; hệ thống suy ra lương gross theo BHXH + thuế TNCN hiện hành."
      maxWidth={560}
      footer={footer}
    >
      <div className="flex flex-col gap-4 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label className="text-[12px]">Lương NET mong muốn (₫)</Label>
              <div className="relative">
                <input
                  inputMode="numeric"
                  value={net ? net.toLocaleString("vi-VN") : ""}
                  placeholder="0"
                  onChange={(e) => { setNet(Number(e.target.value.replace(/[^\d]/g, "")) || 0); setResult(null); }}
                  className={`${fieldCls} pr-7 text-right font-medium`}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">₫</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px]">Số người phụ thuộc</Label>
              <input type="number" min={0} value={dependentsCount}
                onChange={(e) => { setDependentsCount(Math.max(0, Number(e.target.value) || 0)); setResult(null); }}
                className={`${fieldCls} text-right`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px]">Vùng lương</Label>
              <select value={salaryZone} onChange={(e) => { setSalaryZone(e.target.value as SalaryZone); setResult(null); }} className={fieldCls}>
                {ZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
              </select>
            </div>
            <label className="col-span-2 flex items-center gap-2 text-[12.5px] text-foreground">
              <input type="checkbox" checked={isResident} onChange={(e) => { setIsResident(e.target.checked); setResult(null); }} className="size-4 accent-primary" />
              Cá nhân cư trú (tính thuế lũy tiến + giảm trừ). Bỏ chọn nếu không cư trú (thuế suất phẳng).
            </label>
          </div>

          {result && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center justify-center gap-3 text-center">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">NET</div>
                  <div className="text-[15px] font-semibold tabular-nums text-foreground">{fmtVND(result.net)} ₫</div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">GROSS</div>
                  <div className="text-[18px] font-bold tabular-nums text-primary">{fmtVND(result.gross)} ₫</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 border-t pt-3 text-[12.5px]">
                <Row label="BH người lao động (10.5%)" value={result.insurance} />
                <Row label="Thuế TNCN" value={result.tax} />
                <Row label="BH doanh nghiệp (20.5%)" value={result.employerInsurance} />
                <Row label="Tổng chi phí DN" value={result.employerCost} strong />
              </div>
            </div>
          )}

          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        </div>
    </FormModal>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold text-foreground" : "text-foreground/80"}`}>{fmtVND(value)} ₫</span>
    </div>
  );
}
