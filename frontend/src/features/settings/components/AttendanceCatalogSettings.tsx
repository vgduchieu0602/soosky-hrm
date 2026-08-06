import { useEffect, useState } from "react";
import { Plus, Trash2, Clock, CalendarDays, Tags, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TimeSelect } from "@/components/ui/time-select";
import { fmtTime12 } from "@/shared/utils/time.utils";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/shared/utils/cn";
import { settingsService } from "@features/settings/services/settings.service";
import { SettingsSection, CountBadge } from "@features/settings/components/SettingsSection";
import { apiErrorMessage } from "@shared/utils/apiError";
import type { AttendanceSymbol, Holiday, Shift } from "@features/settings/types/settings.types";

const inputCls =
  "flex h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

/** Thứ theo ISO 1..7 (T2..CN) — những ngày ca được áp dụng. */
const WEEKDAYS: { iso: number; label: string }[] = [
  { iso: 1, label: "T2" }, { iso: 2, label: "T3" }, { iso: 3, label: "T4" },
  { iso: 4, label: "T5" }, { iso: 5, label: "T6" }, { iso: 6, label: "T7" }, { iso: 7, label: "CN" },
];
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

/** ISO `yyyy-mm-dd` (hoặc ISO datetime) → `dd/mm/yyyy`. */
function fmtDMY(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** ISO → `dd/mm` (ngày lễ lặp lại: phần năm chỉ là giá trị canh). */
function fmtDM(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
}

function fail(error: unknown, fallback: string): void {
  toast.error(apiErrorMessage(error, fallback));
}

/** Chọn các thứ mà ca áp dụng. */
function WeekdayPicker({ value, disabled, onChange }: { value: number[]; disabled?: boolean; onChange: (days: number[]) => void }) {
  const toggle = (iso: number) => {
    const next = value.includes(iso) ? value.filter((d) => d !== iso) : [...value, iso].sort((a, b) => a - b);
    onChange(next);
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {WEEKDAYS.map((d) => {
        const on = value.includes(d.iso);
        return (
          <button
            key={d.iso}
            type="button"
            disabled={disabled}
            onClick={() => toggle(d.iso)}
            aria-pressed={on}
            className={cn(
              "h-8 w-12 rounded-md border text-[12px] font-medium transition-colors",
              disabled ? "cursor-default" : "cursor-pointer hover:border-primary-500",
              on ? "border-primary-500 bg-primary-500/10 text-primary-700" : "border-input bg-card text-muted-foreground",
            )}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

interface Props { canManage: boolean }

/**
 * Danh mục chấm công: ca làm việc, ngày lễ, ký hiệu.
 *
 * Chỉ những trường backend thật sự lưu. Ca KHÔNG có "loại nửa buổi/cả ngày" hay
 * "áp dụng theo mùa": trọng số công do backend suy ra từ số ca của ngày, và mùa
 * vụ chưa có chỗ lưu. Ký hiệu chấm công là danh mục MÔ TẢ (mã + tên), không gắn
 * vào trạng thái nào trên lưới.
 */
export function AttendanceCatalogSettings({ canManage }: Props) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [symbols, setSymbols] = useState<AttendanceSymbol[]>([]);
  const [rk, setRk] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Ba danh mục tải cùng lúc; lỗi được GIỮ LẠI thay vì thay bằng mảng rỗng —
    // "chưa cấu hình" và "không tải được" là hai tình huống khác nhau.
    Promise.all([
      settingsService.listShifts(),
      settingsService.listHolidays(),
      settingsService.listSymbols(),
    ])
      .then(([s, h, sym]) => {
        if (cancelled) return;
        setShifts(s); setHolidays(h); setSymbols(sym); setLoadError(false); setLoading(false);
      })
      .catch(() => { if (!cancelled) { setLoadError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [rk]);

  const reload = () => setRk((k) => k + 1);
  const activeShifts = shifts.filter((s) => s.status !== "archived");

  const emptyShiftForm = {
    code: "", name: "", startTime: "08:00", endTime: "17:00",
    breakMinutes: "60", workingDays: DEFAULT_WORKING_DAYS,
  };
  const [shiftForm, setShiftForm] = useState(emptyShiftForm);
  const [holidayForm, setHolidayForm] = useState({ name: "", recurring: true, date: "", day: "", month: "" });
  const [symbolForm, setSymbolForm] = useState({ code: "", name: "", description: "" });

  function addShift() {
    settingsService.createShift({
      code: shiftForm.code.trim().toUpperCase(),
      name: shiftForm.name.trim(),
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      breakMinutes: Number(shiftForm.breakMinutes) || 0,
      workingDays: shiftForm.workingDays.length ? shiftForm.workingDays : DEFAULT_WORKING_DAYS,
    })
      .then(() => { setShiftForm(emptyShiftForm); reload(); })
      .catch((error) => fail(error, "Không thêm được ca."));
  }

  function addHoliday() {
    // Ngày lễ cố định (8/3, 20/10…) không có năm nào có nghĩa — dùng năm nhuận
    // 2000 làm giá trị canh để 29/02 vẫn hợp lệ; backend khớp theo ngày-tháng.
    const dateKey = holidayForm.recurring
      ? `2000-${holidayForm.month.padStart(2, "0")}-${holidayForm.day.padStart(2, "0")}`
      : holidayForm.date;

    settingsService.createHoliday({
      name: holidayForm.name.trim(),
      date: `${dateKey}T00:00:00.000Z`,
      isRecurring: holidayForm.recurring,
    })
      .then(() => { setHolidayForm({ name: "", recurring: true, date: "", day: "", month: "" }); reload(); })
      .catch((error) => fail(error, "Không thêm được ngày lễ."));
  }

  function addSymbol() {
    settingsService.createSymbol({
      code: symbolForm.code.trim().toUpperCase(),
      name: symbolForm.name.trim(),
      ...(symbolForm.description.trim() !== "" ? { description: symbolForm.description.trim() } : {}),
    })
      .then(() => { setSymbolForm({ code: "", name: "", description: "" }); reload(); })
      .catch((error) => fail(error, "Không thêm được ký hiệu."));
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-muted/50" />;

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-12 text-center">
        <p className="text-[13px] text-destructive">Không tải được danh mục chấm công.</p>
        <Button variant="outline" size="sm" onClick={reload} className="h-8 rounded-lg text-[12.5px]">Thử lại</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ca làm việc */}
      <SettingsSection
        icon={Clock}
        tone="cyan"
        title="Ca làm việc"
        description="Số ca và giờ giấc do bạn cấu hình; bảng chấm công hiển thị đúng số ca này mỗi ngày."
        badge={<CountBadge tone="cyan">{activeShifts.length} ca/ngày</CountBadge>}
      >
        {canManage && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-dashed p-3">
            <div className="grid grid-cols-[90px_2fr_1fr_1fr_1fr_auto] items-end gap-3">
              <input className={cn(inputCls, "font-mono")} placeholder="Mã (HC)" value={shiftForm.code}
                onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value })} />
              <input className={inputCls} placeholder="Tên ca (VD: Hành chính)" value={shiftForm.name}
                onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} />
              <TimeSelect aria-label="Giờ vào" className="w-full" value={shiftForm.startTime} onChange={(v) => setShiftForm({ ...shiftForm, startTime: v })} />
              <TimeSelect aria-label="Giờ ra" className="w-full" value={shiftForm.endTime} onChange={(v) => setShiftForm({ ...shiftForm, endTime: v })} />
              <input type="number" min={0} className={inputCls} placeholder="Nghỉ (phút)" value={shiftForm.breakMinutes}
                onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: e.target.value })} />
              <Button size="sm" disabled={!shiftForm.code.trim() || !shiftForm.name.trim() || !shiftForm.workingDays.length}
                onClick={addShift} className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm ca</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">Áp dụng thứ:</span>
              <WeekdayPicker value={shiftForm.workingDays} onChange={(d) => setShiftForm({ ...shiftForm, workingDays: d })} />
            </div>
          </div>
        )}
        <List rows={activeShifts} empty="Chưa có ca làm việc — hãy thêm ít nhất 1 ca." render={(s) => (
          <div key={s._id} className="flex flex-col gap-2.5 rounded-lg border p-3 text-[13px]">
            <div className="grid grid-cols-[80px_1.6fr_auto_auto_auto_auto] items-center gap-3">
              <span className="font-mono text-[12px] text-muted-foreground">{s.code}</span>
              {canManage ? (
                <input className={inputCls} defaultValue={s.name}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) settingsService.updateShift(s._id, { name: v }).then(reload).catch((error) => fail(error, "Không lưu được ca.")); }} />
              ) : (
                <span className="font-medium text-foreground">{s.name}</span>
              )}
              {canManage ? (
                <div className="flex items-center gap-1.5">
                  <TimeSelect aria-label="Giờ vào" className="w-[118px]" value={s.startTime}
                    onChange={(v) => { if (v && v !== s.startTime) settingsService.updateShift(s._id, { startTime: v }).then(reload).catch((error) => fail(error, "Không lưu được ca.")); }} />
                  <span className="text-muted-foreground">–</span>
                  <TimeSelect aria-label="Giờ ra" className="w-[118px]" value={s.endTime}
                    onChange={(v) => { if (v && v !== s.endTime) settingsService.updateShift(s._id, { endTime: v }).then(reload).catch((error) => fail(error, "Không lưu được ca.")); }} />
                </div>
              ) : (
                <span className="font-mono text-[12px] text-muted-foreground">{fmtTime12(s.startTime)} – {fmtTime12(s.endTime)}</span>
              )}
              {canManage ? (
                <input type="number" min={0} className={cn(inputCls, "w-[84px]")} defaultValue={s.breakMinutes}
                  onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== s.breakMinutes) settingsService.updateShift(s._id, { breakMinutes: v }).then(reload).catch((error) => fail(error, "Không lưu được ca.")); }} />
              ) : (
                <span className="text-[12px] text-muted-foreground">nghỉ {s.breakMinutes}′</span>
              )}
              {canManage && (
                <Button variant="ghost" size="icon" title="Lưu trữ ca (giữ nguyên lịch sử bảng công)"
                  onClick={() => settingsService.archiveShift(s._id).then(reload).catch((error) => fail(error, "Không lưu trữ được ca."))}
                  className="size-8 text-muted-foreground hover:text-amber-600" aria-label="Lưu trữ ca"><Archive className="size-4" /></Button>
              )}
              {canManage && (
                <Button variant="ghost" size="icon" title="Xoá ca — chỉ được khi chưa dùng trong bảng công"
                  onClick={() => settingsService.deleteShift(s._id).then(reload).catch((error) => fail(error, "Không xoá được ca (có thể đã dùng trong bảng công)."))}
                  className="size-8 text-muted-foreground hover:text-rose-600" aria-label="Xoá ca"><Trash2 className="size-4" /></Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
              <span className="text-[11.5px] font-medium text-muted-foreground">Áp dụng thứ:</span>
              <WeekdayPicker
                value={s.workingDays?.length ? s.workingDays : DEFAULT_WORKING_DAYS}
                disabled={!canManage}
                onChange={(d) => { if (d.length) settingsService.updateShift(s._id, { workingDays: d }).then(reload).catch((error) => fail(error, "Không lưu được ca.")); }}
              />
            </div>
          </div>
        )} />
      </SettingsSection>

      {/* Ngày lễ */}
      <SettingsSection
        icon={CalendarDays}
        tone="rose"
        title="Ngày lễ"
        description="Ngày nghỉ lễ chính thức — không tính vào ngày công bắt buộc."
        badge={<CountBadge tone="rose">{holidays.length}</CountBadge>}
      >
        {canManage && (
          <div className="mb-4 flex flex-col gap-2.5">
            <div className="grid grid-cols-[2fr_1.4fr_auto] items-center gap-3">
              <input className={inputCls} placeholder="Tên ngày lễ (VD: Quốc tế Phụ nữ)" value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} />
              {holidayForm.recurring ? (
                <div className="flex items-center gap-2">
                  <select className={cn(inputCls, "w-[72px]")} value={holidayForm.day} onChange={(e) => setHolidayForm({ ...holidayForm, day: e.target.value })}>
                    <option value="">Ngày</option>
                    {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                  </select>
                  <span className="text-muted-foreground">/</span>
                  <select className={cn(inputCls, "w-[84px]")} value={holidayForm.month} onChange={(e) => setHolidayForm({ ...holidayForm, month: e.target.value })}>
                    <option value="">Tháng</option>
                    {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>Th {i + 1}</option>)}
                  </select>
                </div>
              ) : (
                <DateField key={`new-holiday-${rk}`} className={inputCls} value={holidayForm.date} onChange={(v) => setHolidayForm({ ...holidayForm, date: v })} />
              )}
              <Button size="sm"
                disabled={!holidayForm.name.trim() || (holidayForm.recurring ? !(holidayForm.day && holidayForm.month) : !holidayForm.date)}
                onClick={addHoliday} className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm</Button>
            </div>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[12.5px] text-muted-foreground">
              <input type="checkbox" checked={holidayForm.recurring} onChange={(e) => setHolidayForm({ ...holidayForm, recurring: e.target.checked })} className="size-4 accent-primary-500" />
              Lặp lại hằng năm (ngày lễ cố định như 8/3, 20/10, 2/9…)
            </label>
          </div>
        )}
        <List rows={holidays} empty="Chưa có ngày lễ." render={(h) => (
          <div key={h._id} className="flex items-center gap-3 rounded-lg border p-3 text-[13px]">
            {canManage ? (
              <input className={cn(inputCls, "flex-1")} defaultValue={h.name}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== h.name) settingsService.updateHoliday(h._id, { name: v }).then(reload).catch((error) => fail(error, "Không lưu được ngày lễ.")); }} />
            ) : (
              <span className="flex-1 font-medium text-foreground">{h.name}</span>
            )}
            {h.isRecurring ? (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono text-[12px] text-muted-foreground">{fmtDM(h.date)}</span>
                <CountBadge tone="violet">Hằng năm</CountBadge>
              </span>
            ) : canManage ? (
              <DateField className={cn(inputCls, "w-[190px]")} value={h.date?.slice(0, 10)}
                onChange={(v) => { if (v && v !== h.date?.slice(0, 10)) settingsService.updateHoliday(h._id, { date: `${v}T00:00:00.000Z` }).then(reload).catch((error) => fail(error, "Không lưu được ngày lễ.")); }} />
            ) : (
              <span className="font-mono text-[12px] text-muted-foreground">{fmtDMY(h.date)}</span>
            )}
            {canManage && (
              <Button variant="ghost" size="icon" onClick={() => settingsService.deleteHoliday(h._id).then(reload).catch((error) => fail(error, "Không xoá được ngày lễ."))}
                className="size-8 text-muted-foreground hover:text-rose-600"><Trash2 className="size-4" /></Button>
            )}
          </div>
        )} />
      </SettingsSection>

      {/* Ký hiệu */}
      <SettingsSection
        icon={Tags}
        tone="indigo"
        title="Ký hiệu chấm công"
        description="Danh mục mã ký hiệu dùng khi in/đối chiếu bảng công (VD: X = đi làm, P = nghỉ phép)."
        badge={<CountBadge tone="indigo">{symbols.length}</CountBadge>}
      >
        {canManage && (
          <div className="mb-4 grid grid-cols-[90px_1.4fr_2fr_auto] items-end gap-3">
            <input className={cn(inputCls, "font-mono")} placeholder="Mã (X, P…)" value={symbolForm.code}
              onChange={(e) => setSymbolForm({ ...symbolForm, code: e.target.value })} />
            <input className={inputCls} placeholder="Ý nghĩa" value={symbolForm.name}
              onChange={(e) => setSymbolForm({ ...symbolForm, name: e.target.value })} />
            <input className={inputCls} placeholder="Mô tả (tuỳ chọn)" value={symbolForm.description}
              onChange={(e) => setSymbolForm({ ...symbolForm, description: e.target.value })} />
            <Button size="sm" disabled={!symbolForm.code.trim() || !symbolForm.name.trim()} onClick={addSymbol}
              className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm</Button>
          </div>
        )}
        <List rows={symbols} empty="Chưa có ký hiệu." render={(s) => (
          <div key={s._id} className="flex items-center gap-3 rounded-lg border p-3 text-[13px]">
            <span className="flex size-7 items-center justify-center rounded-md bg-muted font-mono font-bold text-foreground">{s.code}</span>
            {canManage ? (
              <input className={cn(inputCls, "flex-1")} defaultValue={s.name}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) settingsService.updateSymbol(s._id, { name: v }).then(reload).catch((error) => fail(error, "Không lưu được ký hiệu.")); }} />
            ) : (
              <span className="flex-1 text-foreground">{s.name}</span>
            )}
            {canManage ? (
              <input className={cn(inputCls, "flex-1")} defaultValue={s.description ?? ""} placeholder="Mô tả"
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== (s.description ?? "")) settingsService.updateSymbol(s._id, { description: v }).then(reload).catch((error) => fail(error, "Không lưu được ký hiệu.")); }} />
            ) : (
              <span className="flex-1 text-[12px] text-muted-foreground">{s.description || "—"}</span>
            )}
            {canManage && (
              <Button variant="ghost" size="icon" onClick={() => settingsService.deleteSymbol(s._id).then(reload).catch((error) => fail(error, "Không xoá được ký hiệu."))}
                className="size-8 text-muted-foreground hover:text-rose-600" aria-label="Xoá ký hiệu"><Trash2 className="size-4" /></Button>
            )}
          </div>
        )} />
      </SettingsSection>
    </div>
  );
}

function List<T>({ rows, empty, render }: { rows: T[]; empty: string; render: (row: T) => React.ReactNode }) {
  if (rows.length === 0) return <p className="py-4 text-center text-[13px] text-muted-foreground">{empty}</p>;
  return <div className="flex flex-col gap-2">{rows.map(render)}</div>;
}
