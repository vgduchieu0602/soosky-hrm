import { useEffect, useState } from "react";
import { Plus, Trash2, Clock, CalendarDays, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeInput } from "@/components/ui/time-input";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/shared/utils/cn";
import { settingsService } from "@features/settings/services/settings.service";
import { SettingsSection, CountBadge } from "@features/settings/components/SettingsSection";
import type { AttendanceSymbol, Holiday, Shift } from "@features/settings/types/settings.types";

const inputCls =
  "flex h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

/** ISO weekdays 1..7 (Mon..Sun) — the days a shift is applied (thời gian áp dụng). */
const WEEKDAYS: { iso: number; label: string }[] = [
  { iso: 1, label: "T2" }, { iso: 2, label: "T3" }, { iso: 3, label: "T4" },
  { iso: 4, label: "T5" }, { iso: 5, label: "T6" }, { iso: 6, label: "T7" }, { iso: 7, label: "CN" },
];
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

/** ISO `yyyy-mm-dd` (or full ISO datetime) → display `dd/mm/yyyy`. */
function fmtDMY(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Toggle row for the weekdays a shift applies to. */
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
              "h-7 w-9 rounded-md border text-[11.5px] font-medium transition-colors",
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

export function AttendanceCatalogSettings({ canManage }: Props) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [symbols, setSymbols] = useState<AttendanceSymbol[]>([]);
  const [rk, setRk] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      settingsService.listShifts().catch(() => []),
      settingsService.listHolidays().catch(() => []),
      settingsService.listSymbols().catch(() => []),
    ]).then(([s, h, sym]) => {
      if (!cancelled) { setShifts(s); setHolidays(h); setSymbols(sym); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [rk]);

  const reload = () => setRk((k) => k + 1);
  const activeShifts = shifts.filter((s) => s.status !== "archived");

  // shift form
  const [shiftForm, setShiftForm] = useState<{ name: string; startTime: string; endTime: string; breakMinutes: string; workingDays: number[] }>(
    { name: "", startTime: "08:00", endTime: "12:00", breakMinutes: "0", workingDays: DEFAULT_WORKING_DAYS },
  );
  const [holidayForm, setHolidayForm] = useState({ name: "", date: "" });
  const [symbolForm, setSymbolForm] = useState({ code: "", label: "" });

  function addShift() {
    settingsService.createShift({
      name: shiftForm.name.trim(),
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      breakMinutes: Number(shiftForm.breakMinutes) || 0,
      workingDays: shiftForm.workingDays.length ? shiftForm.workingDays : DEFAULT_WORKING_DAYS,
    })
      .then(() => { setShiftForm({ name: "", startTime: "08:00", endTime: "12:00", breakMinutes: "0", workingDays: DEFAULT_WORKING_DAYS }); reload(); })
      .catch(() => {});
  }
  function addHoliday() {
    settingsService.createHoliday({ name: holidayForm.name.trim(), date: holidayForm.date })
      .then(() => { setHolidayForm({ name: "", date: "" }); reload(); })
      .catch(() => {});
  }
  function addSymbol() {
    settingsService.createSymbol({ code: symbolForm.code.trim(), label: symbolForm.label.trim() })
      .then(() => { setSymbolForm({ code: "", label: "" }); reload(); })
      .catch(() => {});
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-muted/50" />;

  return (
    <div className="flex flex-col gap-6">
      {/* Shifts */}
      <SettingsSection
        icon={Clock}
        tone="cyan"
        title="Ca làm việc"
        description="Số ca và giờ giấc do bạn cấu hình; bảng chấm công sẽ hiển thị đúng số ca này mỗi ngày."
        badge={<CountBadge tone="cyan">{activeShifts.length} ca/ngày</CountBadge>}
      >
        {canManage && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-dashed p-3">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-end gap-3">
              <input className={inputCls} placeholder="Tên ca (VD: Ca sáng)" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} />
              <TimeInput className={inputCls} value={shiftForm.startTime} onChange={(v) => setShiftForm({ ...shiftForm, startTime: v })} />
              <TimeInput className={inputCls} value={shiftForm.endTime} onChange={(v) => setShiftForm({ ...shiftForm, endTime: v })} />
              <input type="number" min={0} className={inputCls} placeholder="Nghỉ (phút)" value={shiftForm.breakMinutes} onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: e.target.value })} />
              <Button size="sm" disabled={!shiftForm.name.trim() || !shiftForm.workingDays.length} onClick={addShift} className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm ca</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">Thời gian áp dụng:</span>
              <WeekdayPicker value={shiftForm.workingDays} onChange={(d) => setShiftForm({ ...shiftForm, workingDays: d })} />
            </div>
          </div>
        )}
        <List rows={activeShifts} empty="Chưa có ca làm việc — hãy thêm ít nhất 1 ca." render={(s) => (
          <div key={s._id} className="flex flex-col gap-2.5 rounded-lg border p-3 text-[13px]">
            <div className="grid grid-cols-[2fr_auto_auto_auto] items-center gap-3">
              {canManage ? (
                <input className={inputCls} defaultValue={s.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) settingsService.updateShift(s._id, { name: v }).then(reload).catch(() => {}); }} />
              ) : (
                <span className="font-medium text-foreground">{s.name}</span>
              )}
              {canManage ? (
                <div className="flex items-center gap-1.5">
                  <TimeInput className={cn(inputCls, "w-[96px]")} value={s.startTime} onChange={(v) => { if (v && v !== s.startTime) settingsService.updateShift(s._id, { startTime: v }).then(reload).catch(() => {}); }} />
                  <span className="text-muted-foreground">–</span>
                  <TimeInput className={cn(inputCls, "w-[96px]")} value={s.endTime} onChange={(v) => { if (v && v !== s.endTime) settingsService.updateShift(s._id, { endTime: v }).then(reload).catch(() => {}); }} />
                </div>
              ) : (
                <span className="font-mono text-[12px] text-muted-foreground">{s.startTime}–{s.endTime}</span>
              )}
              <span className="text-[12px] text-muted-foreground">nghỉ {s.breakMinutes}′</span>
              {canManage && (
                <Button variant="ghost" size="icon" onClick={() => settingsService.deleteShift(s._id).then(reload).catch(() => {})} className="size-8 text-muted-foreground hover:text-rose-600" aria-label="Xoá ca"><Trash2 className="size-4" /></Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
              <span className="text-[11.5px] font-medium text-muted-foreground">Thời gian áp dụng:</span>
              <WeekdayPicker
                value={s.workingDays?.length ? s.workingDays : DEFAULT_WORKING_DAYS}
                disabled={!canManage}
                onChange={(d) => { if (d.length) settingsService.updateShift(s._id, { workingDays: d }).then(reload).catch(() => {}); }}
              />
            </div>
          </div>
        )} />
      </SettingsSection>

      {/* Holidays */}
      <SettingsSection
        icon={CalendarDays}
        tone="rose"
        title="Ngày lễ"
        description="Ngày nghỉ lễ chính thức — không tính vào ngày công bắt buộc."
        badge={<CountBadge tone="rose">{holidays.length}</CountBadge>}
      >
        {canManage && (
          <div className="mb-4 grid grid-cols-[2fr_1fr_auto] items-end gap-3">
            <input className={inputCls} placeholder="Tên ngày lễ" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} />
            <DateField key={`new-holiday-${rk}`} className={inputCls} value={holidayForm.date} onChange={(v) => setHolidayForm({ ...holidayForm, date: v })} />
            <Button size="sm" disabled={!holidayForm.name.trim() || !holidayForm.date} onClick={addHoliday} className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm</Button>
          </div>
        )}
        <List rows={holidays} empty="Chưa có ngày lễ." render={(h) => (
          <div key={h._id} className="flex items-center gap-3 rounded-lg border p-3 text-[13px]">
            {canManage ? (
              <input className={cn(inputCls, "flex-1")} defaultValue={h.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== h.name) settingsService.updateHoliday(h._id, { name: v }).then(reload).catch(() => {}); }} />
            ) : (
              <span className="flex-1 font-medium text-foreground">{h.name}</span>
            )}
            {canManage ? (
              <DateField className={cn(inputCls, "w-[150px]")} value={h.date?.slice(0, 10)} onChange={(v) => { if (v && v !== h.date?.slice(0, 10)) settingsService.updateHoliday(h._id, { date: v }).then(reload).catch(() => {}); }} />
            ) : (
              <span className="font-mono text-[12px] text-muted-foreground">{fmtDMY(h.date)}</span>
            )}
            {canManage && (
              <Button variant="ghost" size="icon" onClick={() => settingsService.deleteHoliday(h._id).then(reload).catch(() => {})} className="size-8 text-muted-foreground hover:text-rose-600"><Trash2 className="size-4" /></Button>
            )}
          </div>
        )} />
      </SettingsSection>

      {/* Symbols */}
      <SettingsSection
        icon={Tags}
        tone="indigo"
        title="Ký hiệu chấm công"
        description="Mã ký hiệu dùng trên bảng chấm công (VD: X = đi làm, P = nghỉ phép)."
        badge={<CountBadge tone="indigo">{symbols.length}</CountBadge>}
      >
        {canManage && (
          <div className="mb-4 grid grid-cols-[120px_2fr_auto] items-end gap-3">
            <input className={cn(inputCls, "font-mono")} placeholder="Mã (X, P…)" value={symbolForm.code} onChange={(e) => setSymbolForm({ ...symbolForm, code: e.target.value })} />
            <input className={inputCls} placeholder="Ý nghĩa" value={symbolForm.label} onChange={(e) => setSymbolForm({ ...symbolForm, label: e.target.value })} />
            <Button size="sm" disabled={!symbolForm.code.trim() || !symbolForm.label.trim()} onClick={addSymbol} className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm</Button>
          </div>
        )}
        <List rows={symbols} empty="Chưa có ký hiệu." render={(s) => (
          <div key={s._id} className="flex items-center gap-3 rounded-lg border p-3 text-[13px]">
            <span className="flex size-7 items-center justify-center rounded-md bg-muted font-mono font-bold text-foreground">{s.code}</span>
            {canManage ? (
              <input className={cn(inputCls, "flex-1")} defaultValue={s.label} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.label) settingsService.updateSymbol(s._id, { label: v }).then(reload).catch(() => {}); }} />
            ) : (
              <span className="flex-1 text-foreground">{s.label}</span>
            )}
            <span className="text-[11px] text-muted-foreground">{s.paidStatus}{s.affectsPayroll ? " · ảnh hưởng lương" : ""}</span>
            {canManage && (
              <Button variant="ghost" size="icon" onClick={() => settingsService.deleteSymbol(s._id).then(reload).catch(() => {})} className="size-8 text-muted-foreground hover:text-rose-600" aria-label="Xoá ký hiệu"><Trash2 className="size-4" /></Button>
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
