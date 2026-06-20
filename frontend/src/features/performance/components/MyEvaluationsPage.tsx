import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import { settingsService } from "@features/settings/services/settings.service";
import { performanceService } from "@features/performance/services/performance.service";
import type { Evaluation, EvaluationStatus } from "@features/performance/types/performance.types";
import type { PerformanceCriterion } from "@features/settings/types/settings.types";

type BadgeVariant = "slate" | "amber" | "emerald" | "blue" | "violet" | "rose";
const STATUS: Record<EvaluationStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Đang đánh giá", variant: "slate" },
  approved: { label: "Đã duyệt — chờ bạn xác nhận", variant: "blue" },
  acknowledged: { label: "Bạn đã xác nhận", variant: "emerald" },
};
/** Employees only see finalized results, not in-progress scoring. */
const VISIBLE: EvaluationStatus[] = ["approved", "acknowledged"];

export default function MyEvaluations() {
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [criteria, setCriteria] = useState<PerformanceCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([performanceService.mine(), settingsService.listCriteria(true)])
      .then(([rows, crit]) => { if (active) { setEvals(rows); setCriteria(crit); setLoading(false); } })
      .catch(() => { if (active) { setEvals([]); setLoading(false); } });
    return () => { active = false; };
  }, [reloadKey]);

  const metaOf = useMemo(() => {
    const m = new Map(criteria.map((c) => [c._id, { label: c.label, type: c.type }]));
    return (id: string) => m.get(id) ?? { label: "Tiêu chí", type: "performance" as const };
  }, [criteria]);

  const visible = evals.filter((e) => VISIBLE.includes(e.status));
  const detail = detailId ? evals.find((e) => e._id === detailId) ?? null : null;

  function acknowledge(ev: Evaluation) {
    if (!window.confirm("Xác nhận bạn đã xem kết quả đánh giá này?")) return;
    setBusy(true); setErr(null);
    performanceService.acknowledge(ev._id)
      .then(() => { setReloadKey((k) => k + 1); setDetailId(null); })
      .catch((e) => setErr(e?.response?.data?.message ?? "Xác nhận thất bại."))
      .finally(() => setBusy(false));
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="myeval" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Đánh giá của tôi"]} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[860px] flex-col gap-6">
            <div>
              <h1 className="text-[26px] font-bold tracking-tight text-foreground">Đánh giá của tôi</h1>
              <p className="mt-1 text-[13.5px] text-muted-foreground">Kết quả đánh giá hiệu suất do quản lý / HR thực hiện.</p>
            </div>

            {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{err}</div>}

            <Card className="overflow-hidden">
              {loading && <div className="px-5 py-16 text-center text-[13px] text-muted-foreground">Đang tải…</div>}
              {!loading && visible.length === 0 && (
                <div className="px-5 py-16 text-center text-[13px] text-muted-foreground">Chưa có kết quả đánh giá nào được duyệt.</div>
              )}
              {!loading && visible.map((ev) => (
                <button key={ev._id} onClick={() => setDetailId(ev._id)}
                  className="group flex w-full items-center gap-4 border-b border-border/40 px-5 py-4 text-left transition-colors last:border-0 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">Kỳ đánh giá</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">Hiệu suất {Math.round(ev.performanceRatio)}% · Mục tiêu {Math.round(ev.goalRatio)}%</div>
                  </div>
                  <Badge variant={STATUS[ev.status].variant}>{STATUS[ev.status].label}</Badge>
                  <ChevronRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              ))}
            </Card>
          </div>
        </main>
      </div>

      {detail && (
        <DetailDrawer ev={detail} metaOf={metaOf} busy={busy} onAcknowledge={() => acknowledge(detail)} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

function DetailDrawer({ ev, metaOf, busy, onAcknowledge, onClose }: {
  ev: Evaluation;
  metaOf: (id: string) => { label: string; type: "performance" | "goal" };
  busy: boolean; onAcknowledge: () => void; onClose: () => void;
}) {
  const perfScores = ev.criteriaScores.filter((s) => metaOf(s.criterionId).type === "performance");
  const goalScores = ev.criteriaScores.filter((s) => metaOf(s.criterionId).type === "goal");

  const scoreRows = (rows: typeof ev.criteriaScores) => (
    <div className="flex flex-col gap-2.5">
      {rows.length === 0 && <p className="text-[13px] text-muted-foreground">Không có chỉ số.</p>}
      {rows.map((s) => (
        <div key={s.criterionId} className="flex items-center gap-3 text-[13px]">
          <span className="min-w-0 flex-1 truncate text-muted-foreground" title={metaOf(s.criterionId).label}>{metaOf(s.criterionId).label}</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-secondary-500" style={{ width: `${s.score}%` }} />
          </div>
          <span className="w-12 text-right font-semibold tabular-nums text-foreground">{s.score}%</span>
        </div>
      ))}
    </div>
  );

  const note = (label: string, value?: string | null) =>
    value ? (
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</div>
        <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">{value}</p>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-secondary-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-[520px] max-w-[94vw] flex-col bg-background shadow-2xl animate-[slideOver_.28s_cubic-bezier(.2,.8,.2,1)]">
        <div className="relative shrink-0 overflow-hidden px-6 pb-5 pt-6 text-white" style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}>
          <button onClick={onClose} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Kết quả đánh giá</div>
          <div className="mt-3 flex gap-8">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/45">Hiệu suất</div>
              <div className="text-[28px] font-bold tabular-nums">{Math.round(ev.performanceRatio)}%</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/45">Mục tiêu</div>
              <div className="text-[28px] font-bold tabular-nums">{Math.round(ev.goalRatio)}%</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-5">
            <Card className="p-5">
              <h3 className="mb-3 text-[14px] font-semibold text-foreground">Chỉ số Hiệu suất (60%)</h3>
              {scoreRows(perfScores)}
            </Card>
            <Card className="p-5">
              <h3 className="mb-3 text-[14px] font-semibold text-foreground">Chỉ số Mục tiêu (20%)</h3>
              {scoreRows(goalScores)}
            </Card>

            {(ev.strengths || ev.improvements || ev.developmentPlan || ev.note) && (
              <Card className="flex flex-col gap-4 p-5">
                <h3 className="text-[14px] font-semibold text-foreground">Nhận xét</h3>
                {note("Điểm mạnh", ev.strengths)}
                {note("Cần cải thiện", ev.improvements)}
                {note("Kế hoạch phát triển", ev.developmentPlan)}
                {note("Ghi chú", ev.note)}
              </Card>
            )}

            {ev.status === "acknowledged" ? (
              <div className={cn("flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-5 py-3 text-[13px] font-semibold text-emerald-700")}>
                <Check className="size-4" strokeWidth={2.4} /> Bạn đã xác nhận kết quả này
              </div>
            ) : (
              <Button disabled={busy} onClick={onAcknowledge} className="w-full gap-2 rounded-xl">
                <Check className="size-4" strokeWidth={2.4} /> Xác nhận đã xem
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
