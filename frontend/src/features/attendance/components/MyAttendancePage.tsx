import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/shared/utils/cn";
import Sidebar from "@features/dashboard/components/Sidebar";
import { TopBar } from "@features/dashboard/components/TopBar";
import type { ChipColor } from "@features/dashboard/data";
import { toast } from "sonner";
import { attendanceService } from "@features/attendance/services/attendance.service";
import { apiErrorMessage } from "@shared/utils/apiError";
import type {
  AttendanceCorrectionRecord,
  AttendanceRecord,
  CorrectionStatus,
  ShiftOption,
} from "@features/attendance/types/attendance.types";
import { STATUS_META, MONTH_OPTIONS, recordDateKey, hhmmVN } from "@features/attendance/attendance.constants";

const chip = (c: ChipColor): CSSProperties => ({ background: `var(--chip-${c}-bg)`, color: `var(--chip-${c}-ink)` });

const inputCls =
  "h-10 rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

const CORRECTION_STATUS_LABEL: Record<CorrectionStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

/**
 * `YYYY-MM-DD` + `HH:mm` giờ Việt Nam -> mốc thời gian ISO.
 *
 * Cộng bù 7 giờ ngay tại client: người dùng nhập giờ theo múi giờ của họ, còn
 * backend nhận mốc tuyệt đối.
 */
function vnInstant(dateKey: string, hhmm: string): string {
  return new Date(`${dateKey}T${hhmm}:00.000+07:00`).toISOString();
}

export default function MyAttendancePage() {
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [corrections, setCorrections] = useState<AttendanceCorrectionRecord[]>([]);
  const [form, setForm] = useState({ date: "", checkIn: "", checkOut: "", reason: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      attendanceService.myMonth(month),
      attendanceService.shifts(),
      attendanceService.corrections(),
    ])
      .then(([month_, shiftList, correctionList]) => {
        if (!active) return;
        setRecords(month_.records);
        setShifts(shiftList);
        setCorrections(correctionList);
        setLoading(false);
      })
      .catch(() => { if (active) { setRecords([]); setLoading(false); } });
    return () => { active = false; };
  }, [month, reloadKey]);

  /**
   * Nhân viên KHÔNG tự ghi vào bảng công — chấm công do HR nhập. Sai giờ thì gửi
   * yêu cầu chỉnh công, HR/quản lý duyệt mới áp vào bảng công.
   */
  function submitCorrection() {
    if (form.date === "" || form.reason.trim() === "") {
      toast.error("Cần chọn ngày và nêu lý do.");
      return;
    }
    setSending(true);
    attendanceService
      .submitCorrection({
        date: new Date(`${form.date}T00:00:00.000Z`).toISOString(),
        reason: form.reason.trim(),
        requestedCheckIn: form.checkIn === "" ? null : vnInstant(form.date, form.checkIn),
        requestedCheckOut: form.checkOut === "" ? null : vnInstant(form.date, form.checkOut),
      })
      .then(() => {
        toast.success("Đã gửi yêu cầu chỉnh công, chờ HR/quản lý duyệt");
        setForm({ date: "", checkIn: "", checkOut: "", reason: "" });
        setReloadKey((k) => k + 1);
      })
      .catch((error: unknown) => toast.error(apiErrorMessage(error, "Không gửi được yêu cầu.")))
      .finally(() => setSending(false));
  }

  const summary = useMemo(() => {
    let work = 0;
    let hours = 0;
    let leave = 0;
    for (const r of records) {
      if (["present", "late", "early_leave"].includes(r.status)) work += 1;
      if (r.status === "leave_paid") leave += 1;
      if (r.workHours) hours += r.workHours;
    }
    return { work, hours: Math.round(hours * 10) / 10, leave };
  }, [records]);

  const shiftName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shifts) m.set(s._id, s.name);
    return m;
  }, [shifts]);
  const sorted = useMemo(
    () => [...records].sort((a, b) => a.date.localeCompare(b.date) || (a.shiftId ?? "").localeCompare(b.shiftId ?? "")),
    [records],
  );
  const caLabel = (r: AttendanceRecord) => (r.shiftId ? shiftName.get(r.shiftId) ?? "Ca" : "Cả ngày");

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="att" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar crumbs={["Trang chủ", "Chấm công của tôi"]} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto flex max-w-[900px] flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Chấm công của tôi</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">Xem lịch sử chấm công của bạn theo tháng.</p>
              </div>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-9 rounded-full border border-input bg-card px-4 text-[13px] focus-visible:outline-none"
              >
                {MONTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <Card className="flex flex-col gap-4 p-5">
              <div>
                <div className="text-[14px] font-semibold text-foreground">Yêu cầu chỉnh công</div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Chấm công do HR nhập. Nếu giờ trên bảng công sai, gửi yêu cầu chỉnh — HR hoặc quản lý duyệt mới áp vào bảng công.
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-[12px] text-muted-foreground">Ngày</label>
                  <input type="date" value={form.date} className={inputCls}
                    onChange={(event) => setForm((f) => ({ ...f, date: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-muted-foreground">Giờ vào</label>
                  <input type="time" value={form.checkIn} className={inputCls}
                    onChange={(event) => setForm((f) => ({ ...f, checkIn: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-muted-foreground">Giờ ra</label>
                  <input type="time" value={form.checkOut} className={inputCls}
                    onChange={(event) => setForm((f) => ({ ...f, checkOut: event.target.value }))} />
                </div>
                <div className="min-w-[220px] flex-1">
                  <label className="mb-1 block text-[12px] text-muted-foreground">Lý do</label>
                  <input value={form.reason} placeholder="Ví dụ: quên bấm giờ ra" className={inputCls}
                    onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))} />
                </div>
                <button onClick={submitCorrection} disabled={sending}
                  className="h-10 cursor-pointer rounded-xl bg-primary-500 px-5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                  {sending ? "Đang gửi…" : "Gửi yêu cầu"}
                </button>
              </div>

              {corrections.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t pt-3">
                  {corrections.slice(0, 5).map((request) => (
                    <div key={request._id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                      <span className="tabular-nums text-foreground/80">{recordDateKey(request.date)}</span>
                      <span className="text-muted-foreground">{request.reason}</span>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                        request.status === "pending" && "bg-amber-100 text-amber-700",
                        request.status === "approved" && "bg-emerald-100 text-emerald-700",
                        request.status === "rejected" && "bg-rose-100 text-rose-700",
                      )}>
                        {CORRECTION_STATUS_LABEL[request.status]}
                      </span>
                      {request.decisionNote != null && <span className="text-muted-foreground/80">· {request.decisionNote}</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="p-4"><div className="text-[22px] font-bold tabular-nums">{summary.work}</div><div className="mt-1 text-[12px] text-muted-foreground">Ngày công</div></Card>
              <Card className="p-4"><div className="text-[22px] font-bold tabular-nums">{summary.hours}</div><div className="mt-1 text-[12px] text-muted-foreground">Tổng giờ làm</div></Card>
              <Card className="p-4"><div className="text-[22px] font-bold tabular-nums">{summary.leave}</div><div className="mt-1 text-[12px] text-muted-foreground">Ngày nghỉ phép</div></Card>
            </div>

            <Card className="overflow-hidden">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 text-left">Ngày</th>
                    <th className="px-4 py-3 text-left">Ca</th>
                    <th className="px-4 py-3 text-left">Trạng thái</th>
                    <th className="px-4 py-3 text-center">Giờ vào</th>
                    <th className="px-4 py-3 text-center">Giờ ra</th>
                    <th className="px-4 py-3 text-right">Số giờ</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <tr key={r._id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2.5 tabular-nums text-foreground/80">{recordDateKey(r.date)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{caLabel(r)}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" style={chip(meta.color)}>{meta.label}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums">{hhmmVN(r.checkIn) || "—"}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums">{hhmmVN(r.checkOut) || "—"}</td>
                        <td className={cn("px-4 py-2.5 text-right tabular-nums", r.workHours == null && "text-muted-foreground/50")}>{r.workHours ?? "—"}</td>
                      </tr>
                    );
                  })}
                  {!loading && sorted.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-[13px] text-muted-foreground">Chưa có dữ liệu chấm công tháng này.</td></tr>
                  )}
                  {loading && <tr><td colSpan={6} className="px-4 py-16 text-center text-[13px] text-muted-foreground">Đang tải…</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
