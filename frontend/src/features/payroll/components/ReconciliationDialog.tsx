import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ScaleIcon, ShieldCheck } from "lucide-react";
import { FormModal } from "@shared/components/FormModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { fmtVND } from "@/shared/utils/money";
import { payrollService } from "@features/payroll/services/payroll.service";
import { toast } from "sonner";
import type { PayrollVariance } from "@features/payroll/types/payroll.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  periodName: string;
  /** Tên hiển thị theo employeeId, để bảng đối soát đọc được. */
  nameOf: (employeeId: string) => string;
  /** Gọi sau khi ký xong để trang cha cập nhật lại bước của kỳ. */
  onSigned?: () => void;
}

/** Tên tiếng Việt của các ô được đối soát. */
const FIELD_LABELS: Record<string, string> = {
  proRatedBaseSalary: "Lương theo công",
  grossSalary: "Tổng thu nhập",
  insurance: "Bảo hiểm",
  tax: "Thuế TNCN",
  totalDeductions: "Tổng khấu trừ",
  netSalary: "Thực nhận",
};

/**
 * Chạy song song hai phiên bản công thức và ký xác nhận từng chênh lệch.
 *
 * Còn dòng chưa ký thì backend chặn bước "HR đã soát", nên dialog này là chỗ
 * duy nhất mở được cổng đó.
 */
export function ReconciliationDialog({ open, onOpenChange, periodId, periodName, nameOf, onSigned }: Props) {
  const [rows, setRows] = useState<PayrollVariance[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [signing, setSigning] = useState<string | null>(null);

  useEffect(() => {
    // Không setState đồng bộ trong effect (eslint react-hooks/set-state-in-effect);
    // lần tải lại giữ nguyên danh sách cũ trên màn hình rồi thay bằng dữ liệu mới.
    let cancelled = false;
    payrollService.listReconciliation(periodId)
      .then((data) => { if (!cancelled) { setRows(data.variances); setLoading(false); } })
      .catch(() => { if (!cancelled) { setRows([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [periodId, reloadKey]);

  function runReconciliation() {
    setRunning(true);
    payrollService.reconcile(periodId)
      .then((result) => {
        toast.success(result.varianceCount === 0
          ? `Đối soát xong: hai phiên bản khớp trên ${result.comparedCount} phiếu`
          : `Đối soát xong: ${result.varianceCount}/${result.comparedCount} phiếu lệch, ${result.unsignedCount} chờ ký`);
        if (result.errors.length > 0) {
          toast.warning(`${result.errors.length} nhân viên không tính được bằng phiên bản cũ`);
        }
        setReloadKey((n) => n + 1);
      })
      .catch((error: unknown) => {
        const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
        toast.error(data?.message ?? "Không chạy được đối soát.");
      })
      .finally(() => setRunning(false));
  }

  function sign(employeeId: string) {
    const explanation = (drafts[employeeId] ?? "").trim();
    setSigning(employeeId);
    payrollService.signVariance(periodId, employeeId, explanation)
      .then(() => {
        toast.success("Đã ký xác nhận chênh lệch");
        setDrafts((d) => ({ ...d, [employeeId]: "" }));
        setReloadKey((n) => n + 1);
        onSigned?.();
      })
      .catch((error: unknown) => {
        const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
        toast.error(data?.message ?? "Không ký được.");
      })
      .finally(() => setSigning(null));
  }

  const unsigned = rows.filter((row) => row.signedAt == null);

  const footer = (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Đóng</Button>
      <Button type="button" size="sm" onClick={runReconciliation} disabled={running} className="gap-1.5">
        <ScaleIcon className="size-3.5" /> {running ? "Đang đối soát…" : "Chạy đối soát"}
      </Button>
    </>
  );

  return (
    <FormModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={`Đối soát song song · ${periodName}`}
      subtitle="Tính lại kỳ này bằng phiên bản công thức cũ (v1) rồi so từng dòng với bảng lương hiện tại (v2). Mọi chênh lệch phải được giải thích và ký."
      maxWidth={640}
      footer={footer}
    >
      <div className="flex flex-col gap-3">
        {loading && <p className="py-6 text-center text-[13px] text-muted-foreground">Đang tải…</p>}

        {!loading && rows.length === 0 && (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-[13px]">
            <CheckCircle2 className="size-5 text-emerald-500" />
            <span>Chưa ghi nhận chênh lệch nào. Bấm <b>Chạy đối soát</b> để so hai phiên bản.</span>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-[13px]">
            <ShieldCheck className="size-5 text-primary-600" />
            <span><b className="tabular-nums">{rows.length - unsigned.length}</b>/{rows.length} chênh lệch đã ký</span>
            {unsigned.length > 0 && <Badge variant="rose">{unsigned.length} chờ ký</Badge>}
          </div>
        )}

        {rows.map((row) => (
          <div key={row.employeeId} className="rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">{nameOf(row.employeeId)}</span>
              <span className={row.diff >= 0 ? "text-[13px] font-semibold tabular-nums text-emerald-600" : "text-[13px] font-semibold tabular-nums text-rose-600"}>
                {row.diff >= 0 ? "+" : "−"}{fmtVND(Math.abs(row.diff))} ₫
              </span>
            </div>

            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-muted-foreground/70">
                    <th className="py-1 text-left font-medium">Chỉ tiêu</th>
                    <th className="py-1 text-right font-medium">v1 (cũ)</th>
                    <th className="py-1 text-right font-medium">v2 (hiện tại)</th>
                  </tr>
                </thead>
                <tbody>
                  {row.fields.map((field) => (
                    <tr key={field.field} className="border-t">
                      <td className="py-1">{FIELD_LABELS[field.field] ?? field.field}</td>
                      <td className="py-1 text-right tabular-nums">{fmtVND(field.baseline)}</td>
                      <td className="py-1 text-right font-semibold tabular-nums">{fmtVND(field.target)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {row.signedAt != null ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {row.explanation}
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <p className="flex items-start gap-1.5 text-[12.5px] text-amber-700">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Cần giải thích vì sao lệch (tối thiểu 10 ký tự) rồi ký.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={drafts[row.employeeId] ?? ""}
                    onChange={(event) => setDrafts((d) => ({ ...d, [row.employeeId]: event.target.value }))}
                    placeholder="Ví dụ: nửa đầu tháng còn thử việc 85%, phiên bản cũ không tách đoạn hợp đồng"
                    className="h-9 text-[13px]"
                  />
                  <Button type="button" size="sm" className="h-9 shrink-0"
                    disabled={signing === row.employeeId || (drafts[row.employeeId] ?? "").trim().length < 10}
                    onClick={() => sign(row.employeeId)}>
                    Ký xác nhận
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </FormModal>
  );
}
