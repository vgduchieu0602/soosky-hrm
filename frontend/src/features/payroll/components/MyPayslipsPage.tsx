import { useEffect, useState } from "react";
import { ChevronRight, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import { fmtVND } from "@/shared/utils/money";
import { useAuthStore } from "@core/store/auth.store";
import { payrollService } from "@features/payroll/services/payroll.service";
import { PayslipDrawer, type EmpInfo } from "@features/payroll/components/PayslipDrawer";
import type { PayrollRecord, PayrollStatus } from "@features/payroll/types/payroll.types";

type BadgeVariant = "slate" | "amber" | "emerald" | "blue" | "violet" | "rose";
const STATUS: Record<PayrollStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Nháp", variant: "slate" },
  approved: { label: "Đã duyệt", variant: "blue" },
  paid: { label: "Đã chi", variant: "emerald" },
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/[\s.@]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[parts.length - 1]?.[0] ?? "") + (parts[0]?.[0] ?? "")).toUpperCase() || "?";
}

export default function MyPayslipsPage() {
  const user = useAuthStore((s) => s.user);
  const [slips, setSlips] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PayrollRecord | null>(null);

  useEffect(() => {
    let active = true;
    payrollService
      .myPayslips()
      .then((rows) => { if (active) { setSlips(rows); setLoading(false); } })
      .catch(() => { if (active) { setSlips([]); setLoading(false); } });
    return () => { active = false; };
  }, []);

  const name = user?.username ?? "Tôi";
  const emp: EmpInfo = { name, code: user?.email ?? "", dept: "—", initials: initialsFrom(name) };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="mypayslips" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Phiếu lương của tôi"]} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto flex max-w-[920px] flex-col gap-6">
            <div>
              <h1 className="text-[26px] font-bold tracking-tight text-foreground">Phiếu lương của tôi</h1>
              <p className="mt-1 text-[13.5px] text-muted-foreground">Các kỳ lương đã được duyệt hoặc đã chi.</p>
            </div>

            <Card className="overflow-hidden">
              {loading && <div className="px-5 py-16 text-center text-[13px] text-muted-foreground">Đang tải…</div>}
              {!loading && slips.length === 0 && (
                <div className="px-5 py-16 text-center text-[13px] text-muted-foreground">Chưa có phiếu lương nào.</div>
              )}
              {!loading && slips.map((s) => (
                <button key={s._id} onClick={() => setDetail(s)}
                  className="group flex w-full items-center gap-4 border-b border-border/40 px-5 py-4 text-left transition-colors last:border-0 hover:bg-slate-50">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary-50 text-secondary-700">
                    <Wallet className="size-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">Kỳ lương {s.periodName || "—"}</div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {s.actualWorkDays}/{s.standardWorkDays} ngày công · hiệu suất {Math.round(s.performanceRatio)}%
                    </div>
                  </div>
                  <Badge variant={STATUS[s.status].variant}>{STATUS[s.status].label}</Badge>
                  <div className="w-36 text-right">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Thực nhận</div>
                    <div className="font-bold tabular-nums text-foreground">{fmtVND(s.netSalary)} ₫</div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              ))}
            </Card>
          </div>
        </main>
      </div>

      {detail && (
        <PayslipDrawer
          p={detail}
          emp={emp}
          periodName={detail.periodName ?? ""}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
