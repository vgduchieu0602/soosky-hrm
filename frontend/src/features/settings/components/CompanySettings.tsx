import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { settingsService } from "@features/settings/services/settings.service";
import type { CompanyConfig } from "@features/settings/types/settings.types";

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

interface Props { canManage: boolean }

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
      .catch(() => { if (!cancelled) { setError("Không tải được cấu hình công ty."); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  function set<K extends keyof CompanyConfig>(k: K, v: CompanyConfig[K]) {
    setCfg((c) => (c ? { ...c, [k]: v } : c));
  }

  function save() {
    if (!cfg) return;
    setSaving(true); setMsg(null); setError(null);
    settingsService.updateCompany({
      companyName: cfg.companyName,
      timezone: cfg.timezone,
      locale: cfg.locale,
      currency: cfg.currency,
      standardWorkDays: cfg.standardWorkDays,
      payCycleStartDay: cfg.payCycleStartDay,
      graceLateMinutes: cfg.graceLateMinutes,
      graceEarlyMinutes: cfg.graceEarlyMinutes,
      contactEmail: cfg.contactEmail || undefined,
      address: cfg.address || undefined,
    })
      .then((c) => { setCfg(c); setMsg("Đã lưu cấu hình công ty."); })
      .catch((e) => setError(e?.response?.data?.error?.message ?? "Không thể lưu."))
      .finally(() => setSaving(false));
  }

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-muted/50" />;
  if (!cfg) return <p className="text-[13px] text-destructive">{error}</p>;

  return (
    <Card className="p-6">
      <h3 className="text-[15px] font-semibold text-foreground">Thông tin công ty</h3>
      <p className="mb-5 mt-1 text-[12.5px] text-muted-foreground">Cấu hình chung áp dụng toàn hệ thống.</p>
      <div className="grid max-w-[680px] grid-cols-2 gap-4">
        <Field label="Tên công ty" span>
          <input className={inputCls} disabled={!canManage} value={cfg.companyName} onChange={(e) => set("companyName", e.target.value)} />
        </Field>
        <Field label="Múi giờ">
          <input className={inputCls} disabled={!canManage} value={cfg.timezone} onChange={(e) => set("timezone", e.target.value)} />
        </Field>
        <Field label="Ngôn ngữ">
          <input className={inputCls} disabled={!canManage} value={cfg.locale} onChange={(e) => set("locale", e.target.value)} />
        </Field>
        <Field label="Tiền tệ">
          <input className={cn(inputCls, "font-mono")} disabled={!canManage} value={cfg.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
        </Field>
        <Field label="Ngày công chuẩn / tháng">
          <input type="number" className={inputCls} disabled={!canManage} value={cfg.standardWorkDays} onChange={(e) => set("standardWorkDays", Number(e.target.value))} />
        </Field>
        <Field label="Ngày bắt đầu kỳ lương">
          <input type="number" className={inputCls} disabled={!canManage} value={cfg.payCycleStartDay} onChange={(e) => set("payCycleStartDay", Number(e.target.value))} />
        </Field>
        <Field label="Dung sai đi muộn (phút)">
          <input type="number" min={0} className={inputCls} disabled={!canManage} value={cfg.graceLateMinutes} onChange={(e) => set("graceLateMinutes", Number(e.target.value))} />
        </Field>
        <Field label="Dung sai về sớm (phút)">
          <input type="number" min={0} className={inputCls} disabled={!canManage} value={cfg.graceEarlyMinutes} onChange={(e) => set("graceEarlyMinutes", Number(e.target.value))} />
        </Field>
        <Field label="Email liên hệ">
          <input className={inputCls} disabled={!canManage} value={cfg.contactEmail ?? ""} onChange={(e) => set("contactEmail", e.target.value)} />
        </Field>
        <Field label="Địa chỉ" span>
          <input className={inputCls} disabled={!canManage} value={cfg.address ?? ""} onChange={(e) => set("address", e.target.value)} />
        </Field>
      </div>
      {error && <p className="mt-4 text-[12.5px] text-destructive">{error}</p>}
      {msg && <p className="mt-4 text-[12.5px] text-emerald-600">{msg}</p>}
      {canManage && (
        <div className="mt-5">
          <Button onClick={save} disabled={saving} className="rounded-xl">{saving ? "Đang lưu…" : "Lưu thay đổi"}</Button>
        </div>
      )}
    </Card>
  );
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={cn(span && "col-span-2")}>
      <label className="text-[12px] font-medium text-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
