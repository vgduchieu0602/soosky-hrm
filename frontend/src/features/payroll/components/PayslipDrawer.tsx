import { Check, Loader2, Printer, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import { parseDecimal, fmtVND } from "@/shared/utils/money";
import { printPayslip } from "@features/payroll/utils/payslip-print";
import type { PayrollRecord, PayrollStatus } from "@features/payroll/types/payroll.types";

export interface EmpInfo {
  name: string;
  code: string;
  dept: string;
  initials: string;
}

type BadgeVariant = "slate" | "amber" | "emerald" | "blue" | "violet" | "rose";
const STATUS: Record<PayrollStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Nháp", variant: "slate" },
  approved: { label: "Đã duyệt", variant: "blue" },
  paid: { label: "Đã chi", variant: "emerald" },
};

interface Props {
  p: PayrollRecord;
  emp: EmpInfo;
  periodName: string;
  busy?: boolean;
  /** HR actions — omit for the read-only employee portal. */
  onApprove?: () => void;
  onRevert?: () => void;
  onClose: () => void;
}

export function PayslipDrawer({ p, emp, periodName, busy, onApprove, onRevert, onClose }: Props) {
  const st = STATUS[p.status];
  const handlePrint = () => {
    const ok = printPayslip(p, emp, periodName);
    if (!ok) toast.error("Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up rồi thử lại.");
  };
  const deductionRows = [
    { label: "BHXH (8%)", value: parseDecimal(p.socialInsurance) },
    { label: "BHYT (1.5%)", value: parseDecimal(p.healthInsurance) },
    { label: "BHTN (1%)", value: parseDecimal(p.unemploymentInsurance) },
    { label: "Thuế TNCN", value: parseDecimal(p.tax) },
    { label: "Đoàn phí công đoàn", value: parseDecimal(p.unionFee) },
    { label: "Khấu trừ khác", value: parseDecimal(p.otherDeductions) },
  ].filter((r) => r.value > 0);
  const totalDeductions = parseDecimal(p.totalDeductions);
  const addons = [
    { label: "Phụ cấp", value: parseDecimal(p.totalAllowances) },
    { label: "Tăng ca", value: parseDecimal(p.overtimePay) },
    { label: "Thưởng", value: parseDecimal(p.totalBonuses) },
  ].filter((r) => r.value);

  // Transparent breakdown so an employee sees HOW each amount is derived. Every
  // employment type (intern/probation/official) uses the 20/60/20 split.
  const base = parseDecimal(p.baseSalary);
  const att = p.attendanceRatio; // 0..1
  const attPct = Math.round(att * 100);
  const money0 = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));
  /** Perf/goal formula string; detects whether the stored amount was prorated
   *  by attendance and shows the exact factors that reconstruct it. */
  const kpiDetail = (weightPct: number, scorePct: number, amount: number): string => {
    const full = (weightPct / 100) * base * (scorePct / 100);
    const isProrated = full > 0 && Math.abs(amount - full * att) < Math.abs(amount - full);
    const head = `${weightPct}% × ${money0(base)} × ${Math.round(scorePct)}%`;
    return isProrated ? `${head} × ${attPct}% công` : head;
  };

  const groups = [
    { color: "#0E97C8", weight: "20%", title: "Lương ngày công", ratio: attPct, amount: parseDecimal(p.attendanceComponent), detail: `20% × ${money0(base)} × ${attPct}% công (${p.actualWorkDays}/${p.standardWorkDays} ngày)` },
    { color: "#2F66E0", weight: "60%", title: "Lương hiệu suất", ratio: Math.round(p.performanceRatio), amount: parseDecimal(p.performanceComponent), detail: kpiDetail(60, p.performanceRatio, parseDecimal(p.performanceComponent)) },
    { color: "#7C5CD6", weight: "20%", title: "Lương mục tiêu", ratio: Math.round(p.goalRatio), amount: parseDecimal(p.goalComponent), detail: kpiDetail(20, p.goalRatio, parseDecimal(p.goalComponent)) },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-secondary-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-[540px] max-w-[94vw] flex-col bg-background shadow-2xl animate-[slideOver_.28s_cubic-bezier(.2,.8,.2,1)]">
        <div className="relative shrink-0 overflow-hidden px-6 pb-5 pt-6 text-white" style={{ background: "linear-gradient(135deg,#1B3A74,#163985 55%,#11295C)" }}>
          <div className="absolute right-4 top-4 flex items-center gap-1.5">
            <button onClick={handlePrint} title="Lưu thành PDF / In phiếu lương" className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-[12.5px] font-medium text-white/90 transition hover:bg-white/20 hover:text-white"><Printer className="size-3.5" /> Lưu PDF</button>
            <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-white/10 text-[18px] font-medium ring-2 ring-white/20">{emp.initials}</span>
            <div className="min-w-0">
              <h2 className="truncate text-[19px] font-bold tracking-tight">{emp.name}</h2>
              <div className="mt-0.5 text-[13px] text-white/70"><span className="font-mono">{emp.code}</span> · {emp.dept}</div>
              <div className="mt-2"><Badge variant={st.variant} className="border border-white/10">{st.label}</Badge></div>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-white/[0.07] p-3.5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-white/50">Lương thực nhận · Phiếu lương {periodName}</div>
            <div className="mt-1 flex items-baseline gap-1.5"><span className="text-[28px] font-bold tabular-nums">{fmtVND(p.netSalary)}</span><span className="text-[13px] text-white/60">₫</span></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-5">
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3.5">
                <h3 className="text-[14px] font-semibold text-foreground">Lương theo hiệu suất (20/60/20)</h3>
                <span className="text-[12px] text-muted-foreground">Lương chuẩn <b className="tabular-nums text-foreground/80">{fmtVND(p.baseSalary)} ₫</b></span>
              </div>
              <div className="flex h-2 w-full overflow-hidden">
                <div style={{ width: "20%", background: "#0E97C8" }} />
                <div style={{ width: "60%", background: "#2F66E0" }} />
                <div style={{ width: "20%", background: "#7C5CD6" }} />
              </div>
              {groups.map((g, i) => (
                <div key={g.title} className={cn("px-5 py-4", i < groups.length - 1 && "border-b border-border/50")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 items-center rounded-md px-2 text-[12px] font-bold tabular-nums text-white" style={{ background: g.color }}>{g.weight}</span>
                      <div>
                        <div className="text-[13.5px] font-semibold text-foreground">{g.title}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{g.detail}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-bold tabular-nums text-foreground">{fmtVND(g.amount)} ₫</div>
                      <div className="text-[11px] font-semibold tabular-nums" style={{ color: g.color }}>tỷ lệ {g.ratio}%</div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3.5 text-[13px] font-semibold">
                <span className="text-foreground">Lương cấu thành theo hiệu suất</span>
                <span className="tabular-nums text-foreground">{fmtVND(p.proRatedBaseSalary)} ₫</span>
              </div>
            </Card>

            {addons.length > 0 && (
              <Card className="p-5">
                <h3 className="mb-3 text-[14px] font-semibold text-foreground">Phụ cấp & thưởng</h3>
                <dl className="flex flex-col">
                  {addons.map((r) => (
                    <div key={r.label} className="flex items-center justify-between border-b border-border/40 py-2 text-[13px] last:border-0">
                      <dt className="text-muted-foreground">{r.label}</dt>
                      <dd className="tabular-nums text-foreground">+{fmtVND(r.value)} ₫</dd>
                    </div>
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t pt-3 text-[13px] font-semibold">
                    <dt className="text-foreground">Tổng thu nhập (Gross)</dt>
                    <dd className="tabular-nums text-foreground">{fmtVND(p.grossSalary)} ₫</dd>
                  </div>
                </dl>
              </Card>
            )}

            <Card className="p-5">
              <h3 className="mb-3 text-[14px] font-semibold text-foreground">Khấu trừ</h3>
              <dl className="flex flex-col">
                {deductionRows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between border-b border-border/40 py-2 text-[13px] last:border-0">
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className="tabular-nums text-rose-500">−{fmtVND(r.value)} ₫</dd>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between border-t pt-3 text-[13px] font-semibold">
                  <dt className="text-foreground">Tổng khấu trừ</dt>
                  <dd className="tabular-nums text-rose-500">−{fmtVND(totalDeductions)} ₫</dd>
                </div>
              </dl>
            </Card>

            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-5 py-4">
              <span className="text-[14px] font-semibold text-emerald-900">Thực nhận (Net)</span>
              <span className="text-[20px] font-bold tabular-nums text-emerald-700">{fmtVND(p.netSalary)} ₫</span>
            </div>

            {onApprove && p.status === "draft" && (
              <Button disabled={busy} onClick={onApprove} className="w-full gap-2 rounded-xl">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={2.4} />} Duyệt lương
              </Button>
            )}
            {onRevert && p.status === "approved" && (
              <Button disabled={busy} variant="outline" onClick={onRevert} className="w-full gap-2 rounded-xl">
                <RotateCcw className="size-4" /> Mở lại (về nháp)
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
