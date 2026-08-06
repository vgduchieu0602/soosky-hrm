import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { FormModal } from "@shared/components/FormModal";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/shared/utils/cn";
import { settingsService } from "@features/settings/services/settings.service";
import { apiErrorMessage } from "@shared/utils/apiError";
import type { SalaryPolicy } from "@features/settings/types/settings.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chính sách đang dùng — dùng làm giá trị khởi tạo cho bản mới. */
  previous?: SalaryPolicy | null;
  onSaved: () => void;
}

const fieldCls =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] tabular-nums transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

const fmt = (n: number) => (n ? n.toLocaleString("vi-VN") : "0");

/** Ô nhập tiền: hiện nhóm nghìn (1.234.567) + hậu tố ₫, trả về number. */
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

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint != null && <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Tạo MỘT chính sách lương mới có hiệu lực từ một ngày.
 *
 * Không có chế độ "sửa": backend chỉ nhận tạo mới, vì phiếu lương đã tính giữ id
 * chính sách đã dùng — sửa tại chỗ sẽ làm số cũ tự đổi nghĩa mà không ai biết.
 *
 * Bậc thuế TNCN và tỷ lệ bảo hiểm nằm trong entity phía backend (theo luật), UI
 * không nhập — chỉ bật/tắt việc áp thuế và đoàn phí.
 */
export function SalaryPolicyDialog({ open, onOpenChange, previous, onSaved }: Props) {
  const [form, setForm] = useState({
    effectiveFrom: new Date().toISOString().slice(0, 10),
    baseSalaryReference: previous?.baseSalaryReference ?? 20_000_000,
    regionalMinWage: previous?.regionalMinWage ?? 4_960_000,
    socialInsuranceSalary: previous?.socialInsuranceSalary ?? previous?.baseSalaryReference ?? 20_000_000,
    probationPayRate: previous?.probationPayRate ?? 85,
    taxEnabled: previous?.taxEnabled ?? true,
    unionFeeEnabled: previous?.unionFeeEnabled ?? false,
    unionFeeRate: previous?.unionFeeRate ?? 1,
    prorateByAttendance: previous?.prorateByAttendance ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (form.effectiveFrom === "") { setError("Chọn ngày bắt đầu hiệu lực."); return; }

    setSaving(true); setError(null);
    settingsService.createPolicy({
      effectiveFrom: `${form.effectiveFrom}T00:00:00.000Z`,
      baseSalaryReference: form.baseSalaryReference,
      regionalMinWage: form.regionalMinWage,
      socialInsuranceSalary: form.socialInsuranceSalary,
      probationPayRate: form.probationPayRate,
      taxEnabled: form.taxEnabled,
      unionFeeEnabled: form.unionFeeEnabled,
      unionFeeRate: form.unionFeeRate,
      prorateByAttendance: form.prorateByAttendance,
    })
      .then(() => { onSaved(); onOpenChange(false); })
      .catch((e) => setError(apiErrorMessage(e, "Không tạo được chính sách lương.")))
      .finally(() => setSaving(false));
  }

  const footer = (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Đóng</Button>
      <Button type="button" size="sm" onClick={save} disabled={saving}>{saving ? "Đang lưu…" : "Tạo chính sách"}</Button>
    </>
  );

  return (
    <FormModal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Chính sách lương mới"
      subtitle="Có hiệu lực từ ngày bạn chọn. Phiếu lương đã tính vẫn giữ chính sách cũ."
      maxWidth={560}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hiệu lực từ" htmlFor="policy-effective-from">
            <DateField className={fieldCls} value={form.effectiveFrom} onChange={(v) => setForm((f) => ({ ...f, effectiveFrom: v }))} />
          </Field>
          <Field label="Lương tham chiếu" htmlFor="policy-base" hint="Dùng khi cần một mức lương mặc định (gross-up, preflight).">
            <MoneyInput id="policy-base" value={form.baseSalaryReference} onChange={(v) => setForm((f) => ({ ...f, baseSalaryReference: v }))} />
          </Field>
          <Field label="Lương tối thiểu vùng" htmlFor="policy-min-wage">
            <MoneyInput id="policy-min-wage" value={form.regionalMinWage} onChange={(v) => setForm((f) => ({ ...f, regionalMinWage: v }))} />
          </Field>
          <Field label="Nền đóng BHXH" htmlFor="policy-si" hint="Mức lương dùng để tính bảo hiểm và đoàn phí.">
            <MoneyInput id="policy-si" value={form.socialInsuranceSalary} onChange={(v) => setForm((f) => ({ ...f, socialInsuranceSalary: v }))} />
          </Field>
          <Field label="Tỷ lệ lương thử việc" htmlFor="policy-probation" hint="Áp cho hợp đồng ở trạng thái thử việc.">
            <PercentInput id="policy-probation" value={form.probationPayRate} onChange={(v) => setForm((f) => ({ ...f, probationPayRate: v }))} />
          </Field>
          <Field label="Tỷ lệ đoàn phí" htmlFor="policy-union">
            <PercentInput id="policy-union" value={form.unionFeeRate} onChange={(v) => setForm((f) => ({ ...f, unionFeeRate: v }))} />
          </Field>
        </div>

        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5 rounded-lg border bg-muted/30 p-3 text-[13px]">
            <input type="checkbox" checked={form.taxEnabled} onChange={(e) => setForm((f) => ({ ...f, taxEnabled: e.target.checked }))} className="size-4 accent-primary" />
            <span className="flex-1 text-foreground">Tính thuế TNCN <span className="text-muted-foreground">(tắt thì thuế luôn bằng 0)</span></span>
          </label>
          <label className="flex items-center gap-2.5 rounded-lg border bg-muted/30 p-3 text-[13px]">
            <input type="checkbox" checked={form.unionFeeEnabled} onChange={(e) => setForm((f) => ({ ...f, unionFeeEnabled: e.target.checked }))} className="size-4 accent-primary" />
            <span className="flex-1 text-foreground">Trừ đoàn phí công đoàn</span>
          </label>
          <label className="flex items-center gap-2.5 rounded-lg border bg-muted/30 p-3 text-[13px]">
            <input type="checkbox" checked={form.prorateByAttendance} onChange={(e) => setForm((f) => ({ ...f, prorateByAttendance: e.target.checked }))} className="size-4 accent-primary" />
            <span className="flex-1 text-foreground">
              Cắt cả phần hiệu suất/mục tiêu theo ngày công
              <span className="block text-[11.5px] text-muted-foreground">Tắt: chỉ phần chuyên cần bị cắt theo công.</span>
            </span>
          </label>
        </div>

        {error != null && (
          <p className="flex items-start gap-1.5 text-[12.5px] text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}</p>
        )}
      </div>
    </FormModal>
  );
}
