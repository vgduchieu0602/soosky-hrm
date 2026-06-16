import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { settingsService } from "@features/settings/services/settings.service";
import type { PerformanceCriterion, SalaryPolicy } from "@features/settings/types/settings.types";

const inputCls =
  "flex h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

interface Props { canManage: boolean }

export function SalaryPerformanceSettings({ canManage }: Props) {
  const [policies, setPolicies] = useState<SalaryPolicy[]>([]);
  const [criteria, setCriteria] = useState<PerformanceCriterion[]>([]);
  const [rk, setRk] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([settingsService.listPolicies().catch(() => []), settingsService.listCriteria(true).catch(() => [])])
      .then(([p, c]) => { if (!cancelled) { setPolicies(p); setCriteria(c); setLoading(false); } });
    return () => { cancelled = true; };
  }, [rk]);

  const activeWeightSum = criteria
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + c.weight, 0);

  // add-criterion form
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ key: "", label: "", weight: "25" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function addCriterion() {
    setBusy(true); setErr(null);
    settingsService.createCriterion({ key: f.key.trim(), label: f.label.trim(), weight: Number(f.weight) || 0 })
      .then(() => { setAdding(false); setF({ key: "", label: "", weight: "25" }); setRk((k) => k + 1); })
      .catch((e) => setErr(e?.response?.data?.error?.message ?? "Không thể thêm tiêu chí."))
      .finally(() => setBusy(false));
  }

  function archive(id: string) {
    settingsService.archiveCriterion(id).then(() => setRk((k) => k + 1)).catch(() => {});
  }

  const latest = policies[0];

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <h3 className="text-[15px] font-semibold text-foreground">Cấu hình lương 20/60/20</h3>
        <p className="mb-4 mt-1 text-[12.5px] text-muted-foreground">
          Lương cơ bản chia 3 cấu phần: ngày công · hiệu suất · mục tiêu.
        </p>
        {loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-muted/50" />
        ) : latest ? (
          <div className="grid max-w-[520px] grid-cols-3 gap-3">
            <WeightCard label="Ngày công" value={latest.salaryComponentWeights.attendance} tone="blue" />
            <WeightCard label="Hiệu suất" value={latest.salaryComponentWeights.performance} tone="violet" />
            <WeightCard label="Mục tiêu" value={latest.salaryComponentWeights.goal} tone="emerald" />
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Chưa có chính sách lương. {canManage ? "Tạo qua API /admin/settings/salary-policies." : ""}
          </p>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Tiêu chí hiệu suất (60%)</h3>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Tổng trọng số tiêu chí đang dùng:{" "}
              <b className={cn(activeWeightSum === 100 ? "text-emerald-600" : "text-amber-600")}>{activeWeightSum}%</b>
              {activeWeightSum !== 100 && " (nên bằng 100%)"}
            </p>
          </div>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setAdding((a) => !a)} className="h-8 gap-1.5 rounded-lg text-[12.5px]">
              <Plus className="size-3.5" /> Thêm tiêu chí
            </Button>
          )}
        </div>

        {adding && (
          <div className="mb-4 grid grid-cols-[1fr_2fr_100px] gap-3 rounded-xl border bg-muted/20 p-3.5">
            <input className={cn(inputCls, "font-mono")} placeholder="key" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} />
            <input className={inputCls} placeholder="Tên tiêu chí" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
            <input type="number" className={inputCls} placeholder="%" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
            {err && <p className="col-span-3 text-[12px] text-destructive">{err}</p>}
            <div className="col-span-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)} className="rounded-lg">Huỷ</Button>
              <Button size="sm" disabled={busy || !f.key.trim() || !f.label.trim()} onClick={addCriterion} className="rounded-lg">Lưu</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/50" />
        ) : criteria.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">Chưa có tiêu chí nào.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {criteria.map((c) => (
              <div key={c._id} className={cn("flex items-center gap-3 rounded-xl border p-3", c.status === "archived" && "opacity-50")}>
                <span className="font-mono text-[11px] text-muted-foreground">{c.key}</span>
                <span className="flex-1 text-[13px] text-foreground">{c.label}</span>
                <span className="rounded-md bg-primary-50 px-2 py-0.5 text-[12px] font-semibold text-primary-700">{c.weight}%</span>
                {canManage && c.status === "active" && (
                  <Button variant="ghost" size="icon" onClick={() => archive(c._id)} className="size-8 text-muted-foreground hover:text-rose-600"><Trash2 className="size-4" /></Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function WeightCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border p-4 text-center" style={{ background: `var(--chip-${tone}-bg)` }}>
      <div className="text-[24px] font-bold tabular-nums" style={{ color: `var(--chip-${tone}-ink)` }}>{value}%</div>
      <div className="mt-1 text-[12px] text-foreground/70">{label}</div>
    </div>
  );
}
