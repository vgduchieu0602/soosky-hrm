import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { performanceService } from "@features/performance/services/performance.service";
import type { Criterion, PerformanceReview } from "@features/performance/types/performance.types";
import { KIND_LABEL } from "@features/performance/utils/criteria-index";

interface Props {
  review: PerformanceReview;
  criteria: Criterion[];
  onClose: () => void;
  onScored: () => void;
}

/**
 * Form chấm điểm của người chấm (quản lý trực tiếp hoặc HR).
 *
 * Chỉ gửi điểm TỪNG TIÊU CHÍ; ba điểm tổng hợp (KPI/Mục tiêu/Hiệu suất) do
 * backend tính theo trọng số của đúng phiên bản tiêu chí. Không tính ở client để
 * con số vào lương không bao giờ lệch với điểm chi tiết.
 */
export default function EvaluationScoreDialog({ review, criteria, onClose, onScored }: Props) {
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(review.scores.map((s) => [s.criterionId, s.score])),
  );
  const [managerNote, setManagerNote] = useState(review.managerNote ?? "");
  const [strengths, setStrengths] = useState(review.strengths ?? "");
  const [improvements, setImprovements] = useState(review.improvements ?? "");
  const [developmentPlan, setDevelopmentPlan] = useState(review.developmentPlan ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const missing = criteria.filter((c) => scores[c.id] == null);

  function submit() {
    setBusy(true);
    setErr(null);
    performanceService
      .score(review.id, {
        scores: criteria.map((c) => ({ criterionId: c.id, score: scores[c.id] ?? 0 })),
        managerNote,
        strengths,
        improvements,
        developmentPlan,
      })
      .then(() => onScored())
      .catch((e) => setErr(e?.response?.data?.message ?? "Lưu điểm thất bại."))
      .finally(() => setBusy(false));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Chấm điểm đánh giá</h2>
            <p className="text-sm text-slate-500">
              Bộ tiêu chí phiên bản {review.criteriaVersion} — thang điểm 0–100 cho từng tiêu chí.
            </p>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {criteria.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            Không đọc được bộ tiêu chí của phiếu này (phiên bản {review.criteriaVersion}).
          </p>
        ) : (
          <div className="space-y-3">
            {criteria.map((criterion) => (
              <div key={criterion.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{criterion.name}</p>
                  <p className="text-xs text-slate-500">
                    {KIND_LABEL[criterion.kind] ?? criterion.kind} · trọng số {criterion.weight}%
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scores[criterion.id] ?? ""}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [criterion.id]: Number(e.target.value) }))
                  }
                  className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-cyan-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {[
            { label: "Nhận xét chung", value: managerNote, set: setManagerNote },
            { label: "Điểm mạnh", value: strengths, set: setStrengths },
            { label: "Cần cải thiện", value: improvements, set: setImprovements },
            { label: "Kế hoạch phát triển", value: developmentPlan, set: setDevelopmentPlan },
          ].map((field) => (
            <label key={field.label} className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">{field.label}</span>
              <textarea
                rows={2}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-cyan-500 focus:outline-none"
              />
            </label>
          ))}
        </div>

        {err != null && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
        {missing.length > 0 && (
          <p className="mt-3 text-sm text-amber-700">Còn {missing.length} tiêu chí chưa có điểm.</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">
            Huỷ
          </Button>
          <Button onClick={submit} disabled={busy || missing.length > 0 || criteria.length === 0} className="cursor-pointer">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Nộp điểm
          </Button>
        </div>
      </div>
    </div>
  );
}
