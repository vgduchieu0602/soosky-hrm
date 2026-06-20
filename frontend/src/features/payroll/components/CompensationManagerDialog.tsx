import { useEffect, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { fmtVND, parseDecimal } from "@/shared/utils/money";
import { payrollService } from "@features/payroll/services/payroll.service";
import type { Allowance, Bonus, Deduction } from "@features/payroll/types/payroll.types";
import type { EmpOption } from "@features/payroll/components/CompensationDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmpOption[];
  /** Notify parent (so payroll table can be recomputed) after a change. */
  onChanged?: () => void;
}

type Kind = "allowance" | "bonus" | "deduction";

interface Item {
  _id: string;
  kind: Kind;
  name: string;
  amount: number;
  meta: string;
}

const fieldCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const KIND_LABEL: Record<Kind, string> = { allowance: "Phụ cấp", bonus: "Thưởng", deduction: "Khấu trừ" };

export function CompensationManagerDialog({ open, onOpenChange, employees, onChanged }: Props) {
  const [employeeId, setEmployeeId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    let active = true;
    Promise.all([
      payrollService.allowances(employeeId),
      payrollService.bonuses(employeeId),
      payrollService.deductions(employeeId),
    ])
      .then(([as, bs, ds]: [Allowance[], Bonus[], Deduction[]]) => {
        if (!active) return;
        const rows: Item[] = [
          ...as.map((a) => ({ _id: a._id, kind: "allowance" as Kind, name: a.name, amount: parseDecimal(a.amount), meta: a.type === "percentage" ? "% lương" : "VND" })),
          ...bs.map((b) => ({ _id: b._id, kind: "bonus" as Kind, name: b.name, amount: parseDecimal(b.amount), meta: "theo kỳ" })),
          ...ds.map((d) => ({ _id: d._id, kind: "deduction" as Kind, name: d.name, amount: parseDecimal(d.amount), meta: d.type === "percentage" ? "% gross" : "VND" })),
        ];
        setItems(rows);
        setLoading(false);
      })
      .catch(() => { if (active) { setItems([]); setLoading(false); } });
    return () => { active = false; };
  }, [employeeId, reloadKey]);

  function startEdit(it: Item) {
    setEditing(it._id);
    setEditName(it.name);
    setEditAmount(it.amount);
    setErr(null);
  }

  async function run(fn: () => Promise<unknown>) {
    setErr(null);
    try {
      await fn();
      setEditing(null);
      setReloadKey((n) => n + 1);
      onChanged?.();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(msg ?? "Thao tác thất bại.");
    }
  }

  function saveEdit(it: Item) {
    const patch = { name: editName, amount: editAmount };
    if (it.kind === "allowance") return run(() => payrollService.updateAllowance(it._id, patch));
    if (it.kind === "bonus") return run(() => payrollService.updateBonus(it._id, patch));
    return run(() => payrollService.updateDeduction(it._id, patch));
  }

  function remove(it: Item) {
    if (!window.confirm(`Xóa “${it.name}”?`)) return;
    if (it.kind === "allowance") return run(() => payrollService.deleteAllowance(it._id));
    if (it.kind === "bonus") return run(() => payrollService.deleteBonus(it._id));
    return run(() => payrollService.deleteDeduction(it._id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quản lý cấu phần lương</DialogTitle>
          <DialogDescription>Xem, sửa hoặc xóa phụ cấp / thưởng / khấu trừ của nhân viên.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={fieldCls}>
            <option value="">— Chọn nhân viên —</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.code} · {e.name}</option>)}
          </select>
        </div>

        {err && <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">{err}</p>}

        <div className="max-h-[360px] overflow-y-auto rounded-lg border">
          {!employeeId && <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">Chọn nhân viên để xem cấu phần.</div>}
          {employeeId && loading && <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">Đang tải…</div>}
          {employeeId && !loading && items.length === 0 && (
            <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">Chưa có cấu phần nào.</div>
          )}
          {items.map((it) => (
            <div key={it._id} className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 text-[13px] last:border-0">
              <span className={cn("w-16 shrink-0 rounded-md px-2 py-0.5 text-center text-[11px] font-medium",
                it.kind === "deduction" ? "bg-rose-50 text-rose-600" : "bg-secondary-50 text-secondary-700")}>
                {KIND_LABEL[it.kind]}
              </span>
              {editing === it._id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 flex-1 text-[13px]" />
                  <Input type="number" min={0} value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))} className="h-8 w-32 text-[13px]" />
                  <button onClick={() => saveEdit(it)} className="text-emerald-600 hover:text-emerald-700" title="Lưu"><Check className="size-4" /></button>
                  <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground" title="Hủy"><X className="size-4" /></button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{it.name}</div>
                    <div className="text-[11px] text-muted-foreground">{it.meta}</div>
                  </div>
                  <div className={cn("w-32 text-right font-semibold tabular-nums", it.kind === "deduction" ? "text-rose-500" : "text-foreground")}>
                    {it.kind === "deduction" ? "−" : "+"}{fmtVND(it.amount)}
                  </div>
                  <button onClick={() => startEdit(it)} className="text-muted-foreground hover:text-foreground" title="Sửa"><Pencil className="size-3.5" /></button>
                  <button onClick={() => remove(it)} className="text-muted-foreground hover:text-rose-500" title="Xóa"><Trash2 className="size-3.5" /></button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Đóng</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
