import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Lock, PlayCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import EvaluationScoreDialog from "@features/performance/components/EvaluationScoreDialog";
import { performanceService } from "@features/performance/services/performance.service";
import type {
  AppraisalCycle,
  CriteriaSet,
  Criterion,
  CycleReadiness,
  PerformanceReview,
  ReviewStatus,
} from "@features/performance/types/performance.types";
import { buildCriteriaIndex } from "@features/performance/utils/criteria-index";
import { scoreBand } from "@features/performance/utils/score-band";

type BadgeVariant = "slate" | "amber" | "emerald" | "blue" | "violet" | "rose";

const STATUS: Record<ReviewStatus, { label: string; variant: BadgeVariant }> = {
  draft:        { label: "Chờ chấm", variant: "slate" },
  submitted:    { label: "Chờ HR duyệt", variant: "amber" },
  approved:     { label: "Chờ NV xác nhận", variant: "blue" },
  acknowledged: { label: "Đã xác nhận", variant: "emerald" },
  appealed:     { label: "Khiếu nại", variant: "rose" },
  locked:       { label: "Đã khoá", variant: "violet" },
};

/**
 * Trang quản trị đánh giá (HR) + hàng việc chấm điểm (quản lý).
 *
 * Bố cục theo đúng thứ tự quy trình, để người dùng không phải đoán bước tiếp
 * theo: chu kỳ (mở/tiến độ/đóng) → hàng phiếu (chấm → duyệt → chờ NV xác nhận →
 * khoá). Nút nào không được phép thì backend từ chối; ở đây chỉ ẩn theo trạng
 * thái phiếu để đỡ bấm oan.
 */
export default function PerformancePage() {
  const [cycles, setCycles] = useState<AppraisalCycle[]>([]);
  const [criteriaSets, setCriteriaSets] = useState<CriteriaSet[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [readiness, setReadiness] = useState<CycleReadiness | null>(null);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scoringId, setScoringId] = useState<string | null>(null);

  // Nạp chu kỳ + bộ tiêu chí một lần; chọn chu kỳ đang mở làm mặc định.
  useEffect(() => {
    let active = true;
    Promise.all([performanceService.cycles(), performanceService.criteriaSets()])
      .then(([cycleRows, sets]) => {
        if (!active) return;
        setCycles(cycleRows);
        setCriteriaSets(sets);
        setActiveCycleId((current) => current ?? cycleRows.find((c) => c.status === "active")?.id ?? cycleRows[0]?.id ?? null);
        setLoading(false);
      })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  // Phiếu + tiến độ phụ thuộc chu kỳ đang chọn.
  useEffect(() => {
    if (activeCycleId == null) return;
    let active = true;

    performanceService.reviews({ cycleId: activeCycleId })
      .then((rows) => { if (active) setReviews(rows); })
      .catch(() => { if (active) setReviews([]); });

    // Tiến độ chỉ HR đọc được (`performance:manage`); quản lý gọi sẽ 403 và
    // trang vẫn dùng được cho phần chấm điểm.
    performanceService.cycleReadiness(activeCycleId)
      .then((r) => { if (active) setReadiness(r); })
      .catch(() => { if (active) setReadiness(null); });

    return () => { active = false; };
  }, [activeCycleId, reloadKey]);

  const criteriaOf: (setId: string, version: number) => Criterion[] = buildCriteriaIndex(criteriaSets);
  const reload = () => setReloadKey((k) => k + 1);

  function run(action: () => Promise<unknown>, failMessage: string) {
    setBusy(true); setErr(null);
    action()
      .then(() => { reload(); setScoringId(null); })
      .catch((e) => setErr(e?.response?.data?.message ?? failMessage))
      .finally(() => setBusy(false));
  }

  const cycle   = cycles.find((c) => c.id === activeCycleId) ?? null;
  const shown   = statusFilter === "all" ? reviews : reviews.filter((r) => r.status === statusFilter);
  const scoring = scoringId != null ? reviews.find((r) => r.id === scoringId) ?? null : null;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="performance" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Đánh giá hiệu suất</h1>
          <p className="mb-5 text-sm text-slate-500">
            Quản lý chấm → HR duyệt → nhân viên xác nhận → HR khoá điểm. Điểm đã khoá được chụp sang kỳ lương.
          </p>

          {err != null && <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}

          {loading ? (
            <p className="text-sm text-slate-500">Đang tải…</p>
          ) : cycles.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">
              Chưa có chu kỳ đánh giá nào. Tạo bộ tiêu chí rồi mở chu kỳ gắn với một kỳ lương.
            </Card>
          ) : (
            <>
              <Card className="mb-4 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm font-medium text-slate-700">Chu kỳ</label>
                  <select
                    value={activeCycleId ?? ""}
                    onChange={(e) => setActiveCycleId(e.target.value)}
                    className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-cyan-500 focus:outline-none"
                  >
                    {cycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.status} (tiêu chí v{c.criteriaVersion})
                      </option>
                    ))}
                  </select>

                  {cycle?.status === "draft" && (
                    <Button
                      onClick={() => run(() => performanceService.activateCycle(cycle.id), "Mở chu kỳ thất bại.")}
                      disabled={busy}
                      className="cursor-pointer"
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Mở chu kỳ &amp; phân công
                    </Button>
                  )}

                  {cycle?.status === "active" && (
                    <Button
                      variant="outline"
                      onClick={() => run(() => performanceService.closeCycle(cycle.id), "Đóng chu kỳ thất bại.")}
                      disabled={busy || readiness?.ready === false}
                      title={readiness?.ready === false ? "Còn nhân viên chưa khoá điểm" : undefined}
                      className="cursor-pointer"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Đóng chu kỳ
                    </Button>
                  )}
                </div>

                {readiness != null && (
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                    <span>Đã khoá: <strong>{readiness.lockedCount}</strong>/{readiness.totalActiveEmployees}</span>
                    <span>Còn thiếu: <strong>{readiness.pendingEmployeeIds.length}</strong></span>
                    <Badge variant={readiness.ready ? "emerald" : "amber"}>
                      {readiness.ready ? "Đủ điểm — chốt lương được" : "Chưa đủ điểm"}
                    </Badge>
                  </div>
                )}
              </Card>

              <div className="mb-3 flex flex-wrap gap-2">
                {(["all", "draft", "submitted", "approved", "acknowledged", "appealed", "locked"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      statusFilter === key
                        ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {key === "all" ? "Tất cả" : STATUS[key].label}
                  </button>
                ))}
              </div>

              {shown.length === 0 ? (
                <Card className="p-6 text-sm text-slate-500">Không có phiếu nào ở trạng thái này.</Card>
              ) : (
                <div className="grid gap-3">
                  {shown.map((review) => {
                    const band = review.totals != null ? scoreBand(review.totals.performanceScore) : null;
                    return (
                      <Card key={review.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">Nhân viên {review.employeeId}</p>
                          <p className="text-xs text-slate-500">
                            {review.totals != null
                              ? `Hiệu suất ${review.totals.performanceScore} · Mục tiêu ${review.totals.goalScore} · KPI ${review.totals.kpiScore}`
                              : "Chưa có điểm"}
                            {" · "}tiêu chí v{review.criteriaVersion}
                          </p>
                          {review.appealNote != null && (
                            <p className="mt-1 text-xs text-rose-700">Khiếu nại: {review.appealNote}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {band != null && <Badge variant={band.tone}>{band.label}</Badge>}
                          <Badge variant={STATUS[review.status].variant}>{STATUS[review.status].label}</Badge>

                          {(review.status === "draft" || review.status === "submitted") && (
                            <Button variant="outline" className="cursor-pointer" onClick={() => setScoringId(review.id)}>
                              Chấm điểm
                            </Button>
                          )}
                          {review.status === "submitted" && (
                            <>
                              <Button
                                className="cursor-pointer"
                                disabled={busy}
                                onClick={() => run(() => performanceService.approve(review.id), "Duyệt thất bại.")}
                              >
                                Duyệt
                              </Button>
                              <Button
                                variant="outline"
                                className="cursor-pointer"
                                disabled={busy}
                                onClick={() => run(
                                  () => performanceService.requestChanges(review.id, "Cần chấm lại"),
                                  "Trả phiếu thất bại.",
                                )}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Chấm lại
                              </Button>
                            </>
                          )}
                          {review.status === "appealed" && (
                            <>
                              <Button
                                variant="outline"
                                className="cursor-pointer"
                                disabled={busy}
                                onClick={() => run(
                                  () => performanceService.resolveAppeal(review.id, "Giữ nguyên điểm", false),
                                  "Xử lý khiếu nại thất bại.",
                                )}
                              >
                                Giữ điểm
                              </Button>
                              <Button
                                variant="outline"
                                className="cursor-pointer"
                                disabled={busy}
                                onClick={() => run(
                                  () => performanceService.resolveAppeal(review.id, "Cho chấm lại", true),
                                  "Xử lý khiếu nại thất bại.",
                                )}
                              >
                                Cho chấm lại
                              </Button>
                            </>
                          )}
                          {review.status === "acknowledged" && (
                            <Button
                              className="cursor-pointer"
                              disabled={busy}
                              onClick={() => run(() => performanceService.lock(review.id), "Khoá điểm thất bại.")}
                            >
                              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                              Khoá điểm
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {scoring != null && (
        <EvaluationScoreDialog
          review={scoring}
          criteria={criteriaOf(scoring.criteriaSetId, scoring.criteriaVersion)}
          onClose={() => setScoringId(null)}
          onScored={reload}
        />
      )}
    </div>
  );
}
