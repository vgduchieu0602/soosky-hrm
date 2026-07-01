import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Wallet } from "lucide-react";
import { FormModal } from "@shared/components/FormModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { payrollService } from "@features/payroll/services/payroll.service";
import type { PayrollPreflight } from "@features/payroll/types/payroll.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  periodName: string;
  /** Proceed to compute payroll; resolves after the run. */
  onRun: () => Promise<void>;
}

export function PayrollPreflightDialog({ open, onOpenChange, periodId, periodName, onRun }: Props) {
  const [data, setData] = useState<PayrollPreflight | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    payrollService.preflight(periodId)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [periodId]);

  async function run() {
    setRunning(true);
    try { await onRun(); onOpenChange(false); } finally { setRunning(false); }
  }

  const blocked = data?.items.filter((i) => i.blockers.length > 0) ?? [];
  const warned = data?.items.filter((i) => i.blockers.length === 0 && i.warnings.length > 0) ?? [];

  const footer = (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={running}>Đóng</Button>
      <Button type="button" size="sm" onClick={run} disabled={running || loading} className="gap-1.5">
        <Wallet className="size-3.5" /> {running ? "Đang tính…" : `Tính lương (${data?.ready ?? 0} người)`}
      </Button>
    </>
  );

  return (
    <FormModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={`Kiểm tra trước khi tính lương · ${periodName}`}
      subtitle='Rà soát nhân viên trước khi chạy. Nhân viên bị "chặn" sẽ không được tính cho đến khi bổ sung.'
      maxWidth={512}
      footer={footer}
    >
      <div className="flex flex-col gap-3">
          {loading && <p className="py-6 text-center text-[13px] text-muted-foreground">Đang kiểm tra…</p>}
          {!loading && data && (
            <>
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-[13px]">
                <CheckCircle2 className="size-5 text-emerald-500" />
                <span><b className="tabular-nums">{data.ready}</b>/{data.total} sẵn sàng tính</span>
                {data.blockedCount > 0 && <Badge variant="rose">{data.blockedCount} bị chặn</Badge>}
              </div>

              {data.policyWarnings.map((w, i) => (
                <p key={i} className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
                </p>
              ))}

              {(blocked.length > 0 || warned.length > 0) && (
                <div className="max-h-[260px] overflow-y-auto rounded-xl border">
                  {blocked.map((it) => (
                    <Row key={it.employeeId} code={it.employeeCode} name={it.fullName} msgs={it.blockers} tone="rose" />
                  ))}
                  {warned.map((it) => (
                    <Row key={it.employeeId} code={it.employeeCode} name={it.fullName} msgs={it.warnings} tone="amber" />
                  ))}
                </div>
              )}
              {blocked.length === 0 && warned.length === 0 && data.policyWarnings.length === 0 && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">Tất cả sẵn sàng — có thể tính lương.</p>
              )}
            </>
          )}
        </div>
    </FormModal>
  );
}

function Row({ code, name, msgs, tone }: { code: string; name: string; msgs: string[]; tone: "rose" | "amber" }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/40 px-3 py-2 text-[12.5px] last:border-0">
      <span className="min-w-0 flex-1">
        <span className="font-medium text-foreground">{name}</span>
        <span className="text-muted-foreground"> · <span className="font-mono">{code}</span></span>
      </span>
      <span className={`flex-1 text-right ${tone === "rose" ? "text-rose-600" : "text-amber-600"}`}>{msgs.join("; ")}</span>
    </div>
  );
}
