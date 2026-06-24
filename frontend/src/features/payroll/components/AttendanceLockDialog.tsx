import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { payrollService } from "@features/payroll/services/payroll.service";
import type { AttendanceReadiness } from "@features/payroll/types/payroll.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  periodName: string;
  /** Perform the actual lock; should resolve after the period is locked. */
  onConfirm: () => Promise<void>;
}

export function AttendanceLockDialog({ open, onOpenChange, periodId, periodName, onConfirm }: Props) {
  const [readiness, setReadiness] = useState<AttendanceReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    payrollService.attendanceReadiness(periodId)
      .then((r) => { if (!cancelled) { setReadiness(r); setLoading(false); } })
      .catch(() => { if (!cancelled) { setReadiness(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [periodId]);

  const hasGaps = !!readiness && (readiness.employeesNoRecords > 0 || readiness.incompleteRecords > 0);

  async function confirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${hasGaps ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
              {hasGaps ? <AlertTriangle className="size-4.5" strokeWidth={2} /> : <CheckCircle2 className="size-4.5" strokeWidth={2} />}
            </span>
            <div>
              <DialogTitle>Chốt chấm công · {periodName}</DialogTitle>
              <DialogDescription className="mt-1">
                Sau khi chốt, dữ liệu chấm công của kỳ sẽ bị khoá để tính lương. Hãy đảm bảo đã chấm công xong.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {loading && <p className="py-4 text-center text-[13px] text-muted-foreground">Đang kiểm tra…</p>}
          {!loading && readiness && (
            <>
              <Row label="Nhân viên đang làm việc" value={readiness.totalActiveEmployees} />
              <Row label="Chưa có dữ liệu chấm công" value={readiness.employeesNoRecords} warn={readiness.employeesNoRecords > 0} />
              <Row label="Bản ghi quên check-out (incomplete)" value={readiness.incompleteRecords} warn={readiness.incompleteRecords > 0} hint={readiness.employeesWithIncomplete > 0 ? `${readiness.employeesWithIncomplete} NV` : undefined} />
              {hasGaps ? (
                <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">
                  Vẫn còn dữ liệu chưa hoàn tất. Bạn nên hoàn thiện chấm công trước khi chốt — hoặc vẫn chốt nếu chấp nhận.
                </p>
              ) : (
                <p className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">
                  Chấm công đã đầy đủ. Có thể chốt để tính lương.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>Để sau</Button>
          <Button type="button" size="sm" onClick={confirm} disabled={submitting || loading} className="gap-1.5">
            <Lock className="size-3.5" /> {submitting ? "Đang chốt…" : hasGaps ? "Vẫn chốt & khoá" : "Chốt chấm công"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, warn, hint }: { label: string; value: number; warn?: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums font-semibold ${warn ? "text-amber-600" : "text-foreground"}`}>
        {value}{hint ? <span className="ml-1 text-[11px] font-normal text-muted-foreground">· {hint}</span> : null}
      </span>
    </div>
  );
}
