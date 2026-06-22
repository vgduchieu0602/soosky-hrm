import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Wallet, Gauge, Target, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { settingsService } from "@features/settings/services/settings.service";
import { SalaryPolicyDialog } from "@features/settings/components/SalaryPolicyDialog";
import { SettingsSection, CountBadge } from "@features/settings/components/SettingsSection";
import type { PerformanceCriterion, SalaryPolicy } from "@features/settings/types/settings.types";

const inputCls =
  "flex h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

interface Props {
  /** HR or admin — may manage performance/goal criteria. */
  canManage: boolean;
  /** Admin only — may create/edit the salary policy (BE gates these as adminOnly). */
  canManagePolicy: boolean;
}

export function SalaryPerformanceSettings({ canManage, canManagePolicy }: Props) {
  const [policies, setPolicies] = useState<SalaryPolicy[]>([]);
  const [criteria, setCriteria] = useState<PerformanceCriterion[]>([]);
  const [rk, setRk] = useState(0);
  const [loading, setLoading] = useState(true);
  const [policyDlg, setPolicyDlg] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([settingsService.listPolicies().catch(() => []), settingsService.listCriteria(true).catch(() => [])])
      .then(([p, c]) => { if (!cancelled) { setPolicies(p); setCriteria(c); setLoading(false); } });
    return () => { cancelled = true; };
  }, [rk]);

  const latest = policies[0];
  const reload = () => setRk((k) => k + 1);

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        icon={Wallet}
        tone="cyan"
        title="Cấu hình lương"
        description={`Lương cơ bản chia 3 cấu phần: ngày công · hiệu suất · mục tiêu.${latest ? ` Lương cơ sở ${Number(latest.baseSalary).toLocaleString("vi-VN")}đ.` : ""}`}
        action={canManagePolicy && (
          <Button variant="outline" size="sm" onClick={() => setPolicyDlg(true)} className="h-8 gap-1.5 rounded-lg text-[12.5px]">
            {latest ? <><Pencil className="size-3.5" /> Sửa chính sách</> : <><Plus className="size-3.5" /> Tạo chính sách</>}
          </Button>
        )}
      >
        {loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-muted/50" />
        ) : latest ? (
          <div className="grid max-w-[520px] grid-cols-3 gap-3">
            <WeightCard label="Ngày công" value={latest.salaryComponentWeights.attendance} tone="blue" />
            <WeightCard label="Hiệu suất" value={latest.salaryComponentWeights.performance} tone="violet" />
            <WeightCard label="Mục tiêu" value={latest.salaryComponentWeights.goal} tone="emerald" />
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Chưa có chính sách lương. {canManagePolicy ? "Bấm “Tạo chính sách” để khởi tạo." : "Liên hệ quản trị viên để khởi tạo."}</p>
        )}
      </SettingsSection>

      <CriteriaSection
        title="Chỉ số Hiệu suất"
        icon={Gauge}
        tone="violet"
        hint="Hiệu suất (60% lương) = trung bình các chỉ số dưới đây."
        type="performance"
        criteria={criteria.filter((c) => c.type === "performance")}
        canManage={canManage}
        loading={loading}
        onReload={reload}
      />
      <CriteriaSection
        title="Chỉ số mục tiêu"
        icon={Target}
        tone="emerald"
        hint="Mục tiêu (20% lương) = trung bình các chỉ số dưới đây."
        type="goal"
        criteria={criteria.filter((c) => c.type === "goal")}
        canManage={canManage}
        loading={loading}
        onReload={reload}
      />

      {policyDlg && (
        <SalaryPolicyDialog open onOpenChange={setPolicyDlg} target={latest ?? null} onSaved={reload} />
      )}
    </div>
  );
}

function CriteriaSection({ title, icon, tone, hint, type, criteria, canManage, loading, onReload }: {
  title: string; icon: LucideIcon; tone: "violet" | "emerald"; hint: string; type: "performance" | "goal";
  criteria: PerformanceCriterion[]; canManage: boolean; loading: boolean; onReload: () => void;
}) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const active = criteria.filter((c) => c.status === "active");

  function add() {
    const name = label.trim();
    if (!name) return;
    setBusy(true); setErr(null);
    settingsService.createCriterion({ label: name, type })
      .then(() => { setLabel(""); onReload(); })
      .catch((e) => setErr(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Không thể thêm chỉ số."))
      .finally(() => setBusy(false));
  }
  function archive(id: string) {
    settingsService.archiveCriterion(id).then(onReload).catch(() => {});
  }

  return (
    <SettingsSection
      icon={icon}
      tone={tone}
      title={title}
      description={`${hint} Điểm là trung bình các chỉ số dưới đây.`}
      badge={!loading && <CountBadge tone={tone}>{active.length}</CountBadge>}
    >
      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted/50" />
      ) : (
        <div className="flex flex-col gap-2">
          {active.length === 0 && (
            <p className="rounded-xl border border-dashed py-5 text-center text-[12.5px] text-muted-foreground">
              Chưa có chỉ số nào{canManage ? " — thêm chỉ số đầu tiên bên dưới." : "."}
            </p>
          )}
          {active.map((c, i) => (
            <div key={c._id} className="group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors hover:border-slate-300 hover:bg-muted/40">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="flex-1 text-[13px] text-foreground">{c.label}</span>
              {canManage && (
                <Button variant="ghost" size="icon" onClick={() => archive(c._id)} aria-label={`Xoá chỉ số ${c.label}`} className="size-8 text-muted-foreground hover:text-rose-600"><Trash2 className="size-4" /></Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="mt-3 flex items-center gap-2">
          <input
            className={cn(inputCls, "flex-1")}
            placeholder="Tên chỉ số mới…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          />
          <Button size="sm" disabled={busy || !label.trim()} onClick={add} className="h-9 gap-1.5 rounded-lg">
            <Plus className="size-3.5" /> Thêm
          </Button>
        </div>
      )}
      {err && <p className="mt-2 text-[12px] text-destructive">{err}</p>}
    </SettingsSection>
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
