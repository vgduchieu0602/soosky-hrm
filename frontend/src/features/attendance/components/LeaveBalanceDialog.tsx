import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { attendanceService } from "@features/attendance/services/attendance.service";
import { employeeService } from "@features/employee/services/employee.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Paid leave types that carry a quota (unpaid is always allowed → no quota).
const QUOTA_TYPES: { key: string; label: string }[] = [
  { key: "annual", label: "Phép năm" },
  { key: "sick", label: "Nghỉ ốm" },
  { key: "personal", label: "Việc riêng" },
  { key: "maternity", label: "Thai sản" },
  { key: "paternity", label: "Vợ sinh" },
];

const fieldCls =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

/** HR sets the leave quota (entitled days) per employee/type/year. */
export function LeaveBalanceDialog({ open, onOpenChange }: Props) {
  const [emps, setEmps] = useState<{ id: string; label: string }[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [entitled, setEntitled] = useState<Record<string, number>>({});
  const [used, setUsed] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    employeeService.list({ limit: 500 }).then(({ items }) => {
      if (!active) return;
      const opts = items.map((e) => {
        const p = e.profile;
        const name = p ? [p.lastName, p.middleName, p.firstName].filter(Boolean).join(" ") : e.employeeCode;
        return { id: e._id, label: `${name} · ${e.employeeCode}` };
      });
      setEmps(opts);
      setEmployeeId((cur) => cur || opts[0]?.id || "");
    }).catch(() => setEmps([]));
    return () => { active = false; };
  }, []);

  // Load existing balances when employee/year changes. (No synchronous setState
  // in the effect body — updates happen only in the promise callbacks.)
  useEffect(() => {
    if (!employeeId) return;
    let active = true;
    attendanceService.adminBalances(employeeId, year)
      .then((rows) => {
        if (!active) return;
        const ent: Record<string, number> = {};
        const usd: Record<string, number> = {};
        for (const r of rows) { ent[r.leaveType] = r.entitled; usd[r.leaveType] = r.used; }
        setEntitled(ent); setUsed(usd); setLoading(false);
      })
      .catch(() => { if (active) { setEntitled({}); setUsed({}); setLoading(false); } });
    return () => { active = false; };
  }, [employeeId, year]);

  function save() {
    if (!employeeId) return;
    setSaving(true); setError(null); setMsg(null);
    Promise.all(
      QUOTA_TYPES.map((t) =>
        attendanceService.upsertBalance({ employeeId, leaveType: t.key, year, entitled: Number(entitled[t.key]) || 0 }),
      ),
    )
      .then(() => setMsg("Đã lưu hạn mức phép."))
      .catch((e) => setError(e?.response?.data?.error?.message ?? "Không lưu được."))
      .finally(() => setSaving(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Hạn mức nghỉ phép</DialogTitle>
          <DialogDescription>Thiết lập số ngày phép (entitled) theo từng loại cho nhân viên. Nghỉ không lương không cần hạn mức.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px]">Nhân viên</Label>
              <select className={fieldCls} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                {emps.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px]">Năm</Label>
              <input type="number" className={`${fieldCls} text-right tabular-nums`} value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
            </div>
          </div>

          {loading ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted/50" />
          ) : (
            <div className="flex flex-col gap-2">
              {QUOTA_TYPES.map((t) => (
                <div key={t.key} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <span className="flex-1 text-[13px] text-foreground">{t.label}</span>
                  <span className="text-[11.5px] text-muted-foreground tabular-nums">Đã dùng {used[t.key] ?? 0}</span>
                  <div className="flex items-center gap-1.5">
                    <input type="number" min={0} className={`${fieldCls} w-[80px] text-right tabular-nums`}
                      value={entitled[t.key] ?? 0}
                      onChange={(e) => setEntitled((s) => ({ ...s, [t.key]: Number(e.target.value) || 0 }))} />
                    <span className="text-[12px] text-muted-foreground">ngày</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="min-h-[18px] text-[12.5px]" aria-live="polite">
            {error && <span className="text-destructive">{error}</span>}
            {msg && <span className="flex items-center gap-1.5 text-emerald-600"><Check className="size-4" /> {msg}</span>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button size="sm" disabled={saving || !employeeId} onClick={save} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Lưu hạn mức
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
