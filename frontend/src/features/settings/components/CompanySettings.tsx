import { useEffect, useState } from "react";
import { Building2, Globe2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { settingsService } from "@features/settings/services/settings.service";
import { SettingsSection } from "@features/settings/components/SettingsSection";
import { apiErrorMessage } from "@shared/utils/apiError";
import type { CompanyConfig } from "@features/settings/types/settings.types";

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] text-foreground transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";

const TIMEZONES = ["Asia/Ho_Chi_Minh", "Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo", "Asia/Seoul", "UTC"];
const CURRENCIES = ["VND", "USD"];

/** Hồ sơ mặc định khi hệ thống chưa cấu hình công ty lần nào. */
const EMPTY_COMPANY: CompanyConfig = {
  companyName: "",
  timezone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  standardWorkHoursPerDay: 8,
  standardWorkDaysPerMonth: 22,
};

interface Props { canManage: boolean }

/**
 * Hồ sơ công ty — đúng những trường backend lưu (`CompanyProfile`).
 *
 * Dung sai đi muộn/về sớm và hạn mức phép mặc định KHÔNG ở đây: dung sai thuộc
 * ca làm việc (`/attendance/shifts`), hạn mức phép là số dư từng nhân viên
 * (`/attendance/leave-balances`). Ghép chúng vào hồ sơ công ty là tạo cấu hình
 * không có nơi lưu.
 */
export function CompanySettings({ canManage }: Props) {
  const [cfg, setCfg] = useState<CompanyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    settingsService.getCompany()
      .then((c) => { if (!cancelled) { setCfg(c); setLoading(false); } })
      .catch(() => {
        // 404 = chưa cấu hình lần nào -> mở form trắng để tạo mới.
        if (!cancelled) { setCfg(EMPTY_COMPANY); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  function set<K extends keyof CompanyConfig>(k: K, v: CompanyConfig[K]) {
    setCfg((c) => (c ? { ...c, [k]: v } : c));
    setMsg(null);
  }

  function save() {
    if (!cfg) return;
    if (cfg.companyName.trim() === "") { setError("Tên công ty là bắt buộc."); return; }

    setSaving(true); setMsg(null); setError(null);
    settingsService.updateCompany(cfg)
      .then((c) => { setCfg(c); setMsg("Đã lưu hồ sơ công ty."); })
      .catch((e) => setError(apiErrorMessage(e, "Không thể lưu.")))
      .finally(() => setSaving(false));
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-muted/50" />;
  if (!cfg) return <p className="text-[13px] text-destructive">{error}</p>;

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection icon={Building2} tone="cyan" title="Thông tin công ty" description="Tên và thông tin liên hệ hiển thị trong toàn hệ thống.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên công ty" span>
            <input className={inputCls} disabled={!canManage} value={cfg.companyName} onChange={(e) => set("companyName", e.target.value)} />
          </Field>
          <Field label="Mã số thuế">
            <input className={inputCls} disabled={!canManage} value={cfg.taxCode ?? ""} onChange={(e) => set("taxCode", e.target.value)} />
          </Field>
          <Field label="Điện thoại">
            <input className={inputCls} disabled={!canManage} value={cfg.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Email liên hệ">
            <input type="email" className={inputCls} disabled={!canManage} placeholder="hr@congty.com" value={cfg.contactEmail ?? ""} onChange={(e) => set("contactEmail", e.target.value)} />
          </Field>
          <Field label="Địa chỉ">
            <input className={inputCls} disabled={!canManage} placeholder="Số nhà, đường, quận…" value={cfg.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Logo (URL)" span>
            <input className={inputCls} disabled={!canManage} placeholder="https://…" value={cfg.logoUrl ?? ""} onChange={(e) => set("logoUrl", e.target.value)} />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Globe2}
        tone="indigo"
        title="Khu vực & lịch làm việc"
        description="Múi giờ dùng cho chấm công; giờ/ngày công chuẩn dùng khi quy đổi tỷ lệ."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Múi giờ" hint="Backend dùng giá trị này để cắt ngày chấm công.">
            <select className={inputCls} disabled={!canManage} value={cfg.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Tiền tệ">
            <select className={inputCls} disabled={!canManage} value={cfg.currency ?? "VND"} onChange={(e) => set("currency", e.target.value)}>
              {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </Field>
          <Field label="Giờ công chuẩn / ngày">
            <input type="number" min={1} max={24} className={inputCls} disabled={!canManage}
              value={cfg.standardWorkHoursPerDay ?? 8}
              onChange={(e) => set("standardWorkHoursPerDay", Number(e.target.value))} />
          </Field>
          <Field label="Ngày công chuẩn / tháng" hint="Kỳ lương vẫn khai riêng số ngày công của chính kỳ đó.">
            <input type="number" min={1} max={31} className={inputCls} disabled={!canManage}
              value={cfg.standardWorkDaysPerMonth ?? 22}
              onChange={(e) => set("standardWorkDaysPerMonth", Number(e.target.value))} />
          </Field>
        </div>
      </SettingsSection>

      {canManage && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-card/95 px-5 py-3.5 shadow-lg backdrop-blur">
          <div className="min-h-[20px] text-[12.5px]" aria-live="polite">
            {error && <span className="flex items-center gap-1.5 text-destructive"><AlertCircle className="size-4" /> {error}</span>}
            {msg && <span className="flex items-center gap-1.5 text-emerald-600"><Check className="size-4" /> {msg}</span>}
            {!error && !msg && <span className="text-muted-foreground">Thay đổi sẽ áp dụng toàn hệ thống.</span>}
          </div>
          <Button onClick={save} disabled={saving} className="rounded-xl">{saving ? "Đang lưu…" : "Lưu thay đổi"}</Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, span, hint }: { label: string; children: React.ReactNode; span?: boolean; hint?: string }) {
  return (
    <div className={cn(span && "sm:col-span-2")}>
      <label className="text-[12px] font-medium text-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
