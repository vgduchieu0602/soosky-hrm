import { useState } from "react";
import { FormModal } from "@shared/components/FormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { performanceService } from "@features/performance/services/performance.service";
import { scoreBand } from "@features/performance/utils/score-band";
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
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  async function reopen() {
    if (!existing || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await performanceService.reopen(existing._id, reopenReason.trim() || undefined);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const d = (err as { response?: { data?: { message?: string; error?: { message?: string } } } })?.response?.data;
      setError(d?.message ?? d?.error?.message ?? "Không mở lại được.");
    } finally {
      setSubmitting(false);
    }
  }

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

  const footer = (
    <>
      <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => save(false)}>
        {submitting ? "Đang lưu…" : "Lưu nháp"}
      </Button>
      <Button type="submit" form="evaluation-form" size="sm" disabled={submitting}>
        {submitting ? "Đang lưu…" : "Duyệt"}
      </Button>
    </>
  );

  return (
    <FormModal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Đánh giá nhân viên"
      subtitle={`${employeeName} · chấm 0–100 từng chỉ số. "Lưu nháp" để sửa sau, "Duyệt" để chốt.`}
      maxWidth={640}
      footer={footer}
    >
        <form id="evaluation-form" onSubmit={(e) => { e.preventDefault(); save(true); }} className="flex flex-col gap-4">
          <ScoreGroup title="Chỉ số Hiệu suất (60%)" items={perf} scores={scores} setScores={setScores} />
          <ScoreGroup title="Chỉ số Mục tiêu (20%)" items={goal} scores={scores} setScores={setScores} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-lg bg-secondary-50 px-3 py-2 text-[13px]">
              <span className="text-secondary-700">Hiệu suất</span>
              <span className="flex items-center gap-1.5"><span className="font-bold tabular-nums text-secondary-700">{groupRatio(perf)}%</span><Badge variant={scoreBand(groupRatio(perf)).tone}>{scoreBand(groupRatio(perf)).label}</Badge></span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-[13px]">
              <span className="text-emerald-700">Mục tiêu</span>
              <span className="flex items-center gap-1.5"><span className="font-bold tabular-nums text-emerald-700">{groupRatio(goal)}%</span><Badge variant={scoreBand(groupRatio(goal)).tone}>{scoreBand(groupRatio(goal)).label}</Badge></span>
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

          {existing?.status === "approved" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              {!reopening ? (
                <button type="button" onClick={() => setReopening(true)} className="text-[12.5px] font-medium text-amber-700 hover:underline">
                  Mở lại để sửa (ghi nhận lý do)…
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ev-reopen" className="text-amber-700">Lý do mở lại</Label>
                  <Input id="ev-reopen" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="VD: cập nhật lại điểm mục tiêu" maxLength={500} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => setReopening(false)}>Huỷ</Button>
                    <Button type="button" size="sm" disabled={submitting} onClick={reopen}>{submitting ? "Đang mở…" : "Xác nhận mở lại"}</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">{error}</p>}
        </form>
    </FormModal>
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
          <div className="relative w-24 shrink-0">
            <Input
              type="number" min={0} max={100}
              value={scores[c._id] ?? 0}
              onChange={(e) => {
                // Cap at 100 immediately (111 → 100), floor at 0; blanks → 0.
                const n = Number(e.target.value);
                const clamped = Number.isNaN(n) ? 0 : Math.min(100, Math.max(0, n));
                setScores((s) => ({ ...s, [c._id]: clamped }));
              }}
              className="h-8 w-full pr-7 text-right text-[13px] tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
