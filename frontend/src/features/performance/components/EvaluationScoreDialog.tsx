import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { performanceService } from "@features/performance/services/performance.service";
import type { Evaluation } from "@features/performance/types/performance.types";
import type { PerformanceCriterion } from "@features/settings/types/settings.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  payrollPeriodId: string;
  /** Existing evaluation for this employee/period (to prefill), if any. */
  existing: Evaluation | null;
  criteria: PerformanceCriterion[];
  employeeName: string;
  onSaved: () => void;
}

export function EvaluationScoreDialog({
  open, onOpenChange, employeeId, payrollPeriodId, existing, criteria, employeeName, onSaved,
}: Props) {
  const active = criteria.filter((c) => c.status === "active");
  const perf = active.filter((c) => c.type === "performance");
  const goal = active.filter((c) => c.type === "goal");
  const prefill = (id: string) => existing?.criteriaScores.find((s) => s.criterionId === id)?.score ?? 0;

  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(active.map((c) => [c._id, prefill(c._id)])),
  );
  const [strengths, setStrengths] = useState(() => existing?.strengths ?? "");
  const [improvements, setImprovements] = useState(() => existing?.improvements ?? "");
  const [developmentPlan, setDevelopmentPlan] = useState(() => existing?.developmentPlan ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupRatio = (group: PerformanceCriterion[]) => {
    if (group.length === 0) return 0;
    return Math.round(group.reduce((sum, c) => sum + (scores[c._id] ?? 0), 0) / group.length);
  };

  async function save(finalize: boolean) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const criteriaScores = active.map((c) => ({ criterionId: c._id, score: scores[c._id] ?? 0 }));
    try {
      await performanceService.evaluate({
        employeeId, payrollPeriodId, criteriaScores,
        strengths: strengths.trim(),
        improvements: improvements.trim(),
        developmentPlan: developmentPlan.trim(),
        finalize,
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const d = (err as { response?: { data?: { message?: string; error?: { message?: string } } } })?.response?.data;
      setError(d?.message ?? d?.error?.message ?? "Lưu thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đánh giá nhân viên</DialogTitle>
          <DialogDescription>{employeeName} · chấm 0–100 từng chỉ số. "Lưu nháp" để sửa sau, "Duyệt" để chốt.</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save(true); }} className="flex max-h-[64vh] flex-col gap-4 overflow-y-auto pr-1">
          <ScoreGroup title="Chỉ số Hiệu suất (60%)" items={perf} scores={scores} setScores={setScores} />
          <ScoreGroup title="Chỉ số Mục tiêu (20%)" items={goal} scores={scores} setScores={setScores} />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-lg bg-secondary-50 px-3 py-2 text-[13px]">
              <span className="text-secondary-700">Hiệu suất</span>
              <span className="font-bold tabular-nums text-secondary-700">{groupRatio(perf)}%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-[13px]">
              <span className="text-emerald-700">Mục tiêu</span>
              <span className="font-bold tabular-nums text-emerald-700">{groupRatio(goal)}%</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-str">Điểm mạnh</Label>
              <Textarea id="ev-str" value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Điểm nổi bật trong kỳ…" maxLength={2000} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-imp">Cần cải thiện</Label>
              <Textarea id="ev-imp" value={improvements} onChange={(e) => setImprovements(e.target.value)} placeholder="Điểm cần cải thiện…" maxLength={2000} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-dev">Kế hoạch phát triển</Label>
              <Textarea id="ev-dev" value={developmentPlan} onChange={(e) => setDevelopmentPlan(e.target.value)} placeholder="Hướng phát triển / đào tạo…" maxLength={2000} />
            </div>
          </div>

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => save(false)}>
              {submitting ? "Đang lưu…" : "Lưu nháp"}
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Đang lưu…" : "Duyệt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScoreGroup({ title, items, scores, setScores }: {
  title: string;
  items: PerformanceCriterion[];
  scores: Record<string, number>;
  setScores: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
        <p className="text-[12px] text-amber-600">Chưa có chỉ số — thêm trong Cài đặt.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {items.map((c) => (
        <div key={c._id} className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground" title={c.label}>{c.label}</span>
          <div className="relative w-20">
            <Input
              type="number" min={0} max={100}
              value={scores[c._id] ?? 0}
              onChange={(e) => setScores((s) => ({ ...s, [c._id]: Number(e.target.value) }))}
              className="h-8 w-full pr-6 text-right text-[13px] tabular-nums"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
