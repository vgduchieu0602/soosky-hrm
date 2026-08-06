import { useEffect, useState } from "react";
import { Check, Loader2, MessageSquareWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import { performanceService } from "@features/performance/services/performance.service";
import type { Criterion, PerformanceReview, ReviewStatus } from "@features/performance/types/performance.types";
import { buildCriteriaIndex, KIND_LABEL } from "@features/performance/utils/criteria-index";
import { scoreBand } from "@features/performance/utils/score-band";

type BadgeVariant = "slate" | "amber" | "emerald" | "blue" | "violet" | "rose";

const STATUS: Record<ReviewStatus, { label: string; variant: BadgeVariant }> = {
  draft:        { label: "Quản lý đang chấm", variant: "slate" },
  submitted:    { label: "Chờ HR duyệt", variant: "amber" },
  approved:     { label: "Đã duyệt — chờ bạn xác nhận", variant: "blue" },
  acknowledged: { label: "Bạn đã xác nhận", variant: "emerald" },
  appealed:     { label: "Bạn đang khiếu nại", variant: "rose" },
  locked:       { label: "Đã khoá điểm", variant: "violet" },
};

/**
 * Trang tự phục vụ: phiếu đánh giá của CHÍNH nhân viên.
 *
 * Backend đã thu hẹp theo phạm vi `performance:read:self`, nên trang này không
 * gửi employeeId và cũng không thể xem của người khác.
 *
 * Phiếu ở `draft`/`submitted` vẫn ẩn: điểm chưa được HR duyệt thì chưa phải kết
 * quả, hiện ra chỉ gây tranh cãi về con số còn đang sửa.
 */
export default function MyEvaluations() {
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [criteriaOf, setCriteriaOf] = useState<(setId: string, version: number) => Criterion[]>(() => () => []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [appealFor, setAppealFor] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([performanceService.myReviews(), performanceService.criteriaSets()])
      .then(([rows, sets]) => {
        if (!active) return;
        setReviews(rows);
        setCriteriaOf(() => buildCriteriaIndex(sets));
        setLoading(false);
      })
      .catch(() => { if (active) { setReviews([]); setLoading(false); } });
    return () => { active = false; };
  }, [reloadKey]);

  const visible = reviews.filter((r) => r.status !== "draft" && r.status !== "submitted");
  const detail  = detailId != null ? visible.find((r) => r.id === detailId) ?? null : null;

  function acknowledge(review: PerformanceReview) {
    setBusy(true); setErr(null);
    performanceService.acknowledge(review.id)
      .then(() => { setReloadKey((k) => k + 1); setDetailId(null); })
      .catch((e) => setErr(e?.response?.data?.message ?? "Xác nhận thất bại."))
      .finally(() => setBusy(false));
  }

  function appeal() {
    if (appealFor == null || appealReason.trim() === "") return;
    setBusy(true); setErr(null);
    performanceService.appeal(appealFor, appealReason.trim())
      .then(() => { setReloadKey((k) => k + 1); setAppealFor(null); setAppealReason(""); setDetailId(null); })
      .catch((e) => setErr(e?.response?.data?.message ?? "Gửi khiếu nại thất bại."))
      .finally(() => setBusy(false));
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="myeval" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Đánh giá của tôi</h1>
          <p className="mb-5 text-sm text-slate-500">
            Kết quả đánh giá sau khi HR duyệt. Bạn xác nhận, hoặc khiếu nại kèm lý do.
          </p>

          {err != null && <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}

          {loading ? (
            <p className="text-sm text-slate-500">Đang tải…</p>
          ) : visible.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">Chưa có kết quả đánh giá nào được duyệt.</Card>
          ) : (
            <div className="grid gap-3">
              {visible.map((review) => {
                const band = review.totals != null ? scoreBand(review.totals.performanceScore) : null;
                return (
                  <Card key={review.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          Kỳ đánh giá · bộ tiêu chí v{review.criteriaVersion}
                        </p>
                        <p className="text-xs text-slate-500">
                          {review.totals != null
                            ? `Hiệu suất ${review.totals.performanceScore} · Mục tiêu ${review.totals.goalScore} · KPI ${review.totals.kpiScore}`
                            : "Chưa có điểm"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {band != null && <Badge variant={band.tone}>{band.label}</Badge>}
                        <Badge variant={STATUS[review.status].variant}>{STATUS[review.status].label}</Badge>
                        <Button
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => setDetailId(review.id === detailId ? null : review.id)}
                        >
                          Chi tiết
                        </Button>
                      </div>
                    </div>

                    {detail?.id === review.id && (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <div className="grid gap-2">
                          {criteriaOf(review.criteriaSetId, review.criteriaVersion).map((criterion) => (
                            <div key={criterion.id} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700">
                                {criterion.name}
                                <span className="ml-2 text-xs text-slate-400">
                                  {KIND_LABEL[criterion.kind] ?? criterion.kind} · {criterion.weight}%
                                </span>
                              </span>
                              <span className="font-medium text-slate-900">
                                {review.scores.find((s) => s.criterionId === criterion.id)?.score ?? "—"}
                              </span>
                            </div>
                          ))}
                        </div>

                        {review.managerNote != null && (
                          <p className="mt-3 text-sm text-slate-600"><strong>Nhận xét:</strong> {review.managerNote}</p>
                        )}
                        {review.appealNote != null && (
                          <p className="mt-2 text-sm text-rose-700"><strong>Khiếu nại của bạn:</strong> {review.appealNote}</p>
                        )}
                        {review.hrNote != null && (
                          <p className="mt-2 text-sm text-blue-700"><strong>Phản hồi HR:</strong> {review.hrNote}</p>
                        )}

                        {review.status === "approved" && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button onClick={() => acknowledge(review)} disabled={busy} className="cursor-pointer">
                              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                              Xác nhận
                            </Button>
                            <Button
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() => setAppealFor(appealFor === review.id ? null : review.id)}
                            >
                              <MessageSquareWarning className="mr-2 h-4 w-4" />
                              Khiếu nại
                            </Button>
                          </div>
                        )}

                        {appealFor === review.id && (
                          <div className="mt-3">
                            <textarea
                              rows={3}
                              value={appealReason}
                              onChange={(e) => setAppealReason(e.target.value)}
                              placeholder="Nêu rõ lý do khiếu nại (bắt buộc)"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-cyan-500 focus:outline-none"
                            />
                            <Button
                              onClick={appeal}
                              disabled={busy || appealReason.trim() === ""}
                              className="mt-2 cursor-pointer"
                            >
                              Gửi khiếu nại
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
