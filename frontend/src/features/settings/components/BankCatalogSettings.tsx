import { useEffect, useState } from "react";
import { Plus, Trash2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { apiErrorMessage } from "@shared/utils/apiError";
import { bankService, type Bank } from "@features/settings/services/bank.service";
import { SettingsSection, CountBadge } from "@features/settings/components/SettingsSection";

const inputCls =
  "flex h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

interface Props { canManage: boolean }

export function BankCatalogSettings({ canManage }: Props) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [rk, setRk] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", code: "" });

  useEffect(() => {
    let cancelled = false;
    bankService
      .list()
      .then((rows) => { if (!cancelled) { setBanks(rows); setLoading(false); } })
      .catch(() => { if (!cancelled) { setBanks([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [rk]);

  const reload = () => setRk((k) => k + 1);
  const activeBanks = banks.filter((b) => b.status !== "archived");

  function addBank() {
    bankService
      .create({ name: form.name.trim(), ...(form.code.trim() ? { code: form.code.trim() } : {}) })
      .then(() => { setForm({ name: "", code: "" }); reload(); toast.success("Đã thêm ngân hàng"); })
      .catch((err) => toast.error(apiErrorMessage(err)));
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-muted/50" />;

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        icon={Landmark}
        tone="cyan"
        title="Ngân hàng"
        description="Danh mục ngân hàng dùng làm nguồn cho các danh sách chọn (VD: tài khoản lương nhân viên)."
        badge={<CountBadge tone="cyan">{activeBanks.length}</CountBadge>}
      >
        {canManage && (
          <div className="mb-4 grid grid-cols-[2fr_1fr_auto] items-end gap-3">
            <input className={inputCls} placeholder="Tên ngân hàng (VD: Vietcombank)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={cn(inputCls, "font-mono uppercase")} placeholder="Mã (VD: VCB)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <Button size="sm" disabled={!form.name.trim()} onClick={addBank} className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm</Button>
          </div>
        )}
        <List rows={activeBanks} empty="Chưa có ngân hàng — hãy thêm ít nhất 1 ngân hàng." render={(b) => (
          <div key={b._id} className="flex items-center gap-3 rounded-lg border p-3 text-[13px]">
            {canManage ? (
              <input
                className={cn(inputCls, "flex-1")}
                defaultValue={b.name}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== b.name) bankService.update(b._id, { name: v }).then(reload).catch((err) => toast.error(apiErrorMessage(err))); }}
              />
            ) : (
              <span className="flex-1 font-medium text-foreground">{b.name}</span>
            )}
            {canManage ? (
              <input
                className={cn(inputCls, "w-[140px] font-mono uppercase")}
                defaultValue={b.code ?? ""}
                placeholder="Mã"
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== (b.code ?? "")) bankService.update(b._id, { code: v }).then(reload).catch((err) => toast.error(apiErrorMessage(err))); }}
              />
            ) : (
              b.code ? <span className="font-mono text-[12px] text-muted-foreground">{b.code}</span> : null
            )}
            {canManage && (
              <Button variant="ghost" size="icon" onClick={() => bankService.archive(b._id).then(() => { reload(); toast.success("Đã lưu trữ ngân hàng"); }).catch((err) => toast.error(apiErrorMessage(err)))} className="size-8 text-muted-foreground hover:text-rose-600" aria-label="Lưu trữ ngân hàng"><Trash2 className="size-4" /></Button>
            )}
          </div>
        )} />
      </SettingsSection>
    </div>
  );
}

function List<T>({ rows, empty, render }: { rows: T[]; empty: string; render: (row: T) => React.ReactNode }) {
  if (rows.length === 0) return <p className="py-4 text-center text-[13px] text-muted-foreground">{empty}</p>;
  return <div className="flex flex-col gap-2">{rows.map(render)}</div>;
}
