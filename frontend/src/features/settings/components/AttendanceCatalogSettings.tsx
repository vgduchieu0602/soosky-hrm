import { useEffect, useState } from "react";
import { Plus, Trash2, Clock, CalendarDays, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeSelect } from "@/components/ui/time-select";
import { fmtTime12 } from "@/shared/utils/time.utils";
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

/** ISO → `dd/mm` (recurring holidays — year is a sentinel). */
function fmtDM(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** The 8 attendance statuses a symbol can render for (grid/legend). */
const ATT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "present", label: "Đủ công" },
  { value: "late", label: "Đi muộn" },
  { value: "early_leave", label: "Về sớm" },
  { value: "incomplete", label: "Thiếu chấm" },
  { value: "absent", label: "Vắng" },
  { value: "leave_paid", label: "Nghỉ phép" },
  { value: "leave_unpaid", label: "Nghỉ không lương" },
  { value: "holiday", label: "Nghỉ lễ" },
];
const CHIP_COLORS = ["emerald", "amber", "rose", "violet", "cyan", "indigo", "blue"];
const attStatusLabel = (v?: string) => ATT_STATUS_OPTIONS.find((o) => o.value === v)?.label;

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
  const emptyShiftForm = {
    name: "", type: "morning" as "morning" | "afternoon" | "full_day", startTime: "08:00", endTime: "12:00",
    breakMinutes: "0", workingDays: DEFAULT_WORKING_DAYS, effectiveFrom: "", effectiveTo: "",
  };
  const [shiftForm, setShiftForm] = useState(emptyShiftForm);
  const [holidayForm, setHolidayForm] = useState({ name: "", recurring: true, date: "", day: "", month: "" });
  const [symbolForm, setSymbolForm] = useState({ code: "", label: "", appliesTo: "", color: "" });

  function addShift() {
    settingsService.createShift({
      name: shiftForm.name.trim(),
      type: shiftForm.type,
      // Công weight is derived from the ca type: nửa buổi = 0.5, cả ngày = 1.
      weight: shiftForm.type === "full_day" ? 1 : 0.5,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      breakMinutes: Number(shiftForm.breakMinutes) || 0,
      workingDays: shiftForm.workingDays.length ? shiftForm.workingDays : DEFAULT_WORKING_DAYS,
      effectiveFrom: shiftForm.effectiveFrom || null,
      effectiveTo: shiftForm.effectiveTo || null,
    })
      .then(() => { setShiftForm(emptyShiftForm); reload(); })
      .catch(() => {});
  }
  function addHoliday() {
    // Recurring (fixed-date) holidays like 8/3, 20/10 have no meaningful year —
    // store a sentinel leap year (2000) so 29/02 is valid; the payroll/leave
    // engine matches recurring holidays by month-day only.
    const date = holidayForm.recurring
      ? `2000-${holidayForm.month.padStart(2, "0")}-${holidayForm.day.padStart(2, "0")}`
      : holidayForm.date;
    settingsService.createHoliday({ name: holidayForm.name.trim(), date, isRecurring: holidayForm.recurring })
      .then(() => { setHolidayForm({ name: "", recurring: true, date: "", day: "", month: "" }); reload(); })
      .catch(() => {});
  }
  function addSymbol() {
    settingsService.createSymbol({
      code: symbolForm.code.trim(),
      label: symbolForm.label.trim(),
      ...(symbolForm.appliesTo ? { appliesTo: symbolForm.appliesTo } : {}),
      ...(symbolForm.color ? { color: symbolForm.color } : {}),
    })
      .then(() => { setSymbolForm({ code: "", label: "", appliesTo: "", color: "" }); reload(); })
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
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-end gap-3">
              <input className={inputCls} placeholder="Tên ca (VD: Ca sáng)" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} />
              <select className={inputCls} value={shiftForm.type} onChange={(e) => setShiftForm({ ...shiftForm, type: e.target.value as typeof shiftForm.type })}>
                <option value="morning">Nửa buổi sáng (0.5)</option>
                <option value="afternoon">Nửa buổi chiều (0.5)</option>
                <option value="full_day">Cả ngày (1)</option>
              </select>
              <TimeSelect aria-label="Giờ vào" className="w-full" value={shiftForm.startTime} onChange={(v) => setShiftForm({ ...shiftForm, startTime: v })} />
              <TimeSelect aria-label="Giờ ra" className="w-full" value={shiftForm.endTime} onChange={(v) => setShiftForm({ ...shiftForm, endTime: v })} />
              <input type="number" min={0} className={inputCls} placeholder="Nghỉ (phút)" value={shiftForm.breakMinutes} onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: e.target.value })} />
              <Button size="sm" disabled={!shiftForm.name.trim() || !shiftForm.workingDays.length} onClick={addShift} className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm ca</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">Áp dụng thứ:</span>
              <WeekdayPicker value={shiftForm.workingDays} onChange={(d) => setShiftForm({ ...shiftForm, workingDays: d })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">Áp dụng theo mùa (tuỳ chọn):</span>
              <DateField key={`new-shift-from-${rk}`} className={cn(inputCls, "w-[150px]")} value={shiftForm.effectiveFrom} onChange={(v) => setShiftForm({ ...shiftForm, effectiveFrom: v })} />
              <span className="text-muted-foreground">–</span>
              <DateField key={`new-shift-to-${rk}`} className={cn(inputCls, "w-[150px]")} value={shiftForm.effectiveTo} onChange={(v) => setShiftForm({ ...shiftForm, effectiveTo: v })} />
              <span className="text-[11.5px] text-muted-foreground">Để trống = áp dụng quanh năm.</span>
            </div>
          </div>
        )}
        <List rows={activeShifts} empty="Chưa có ca làm việc — hãy thêm ít nhất 1 ca." render={(s) => (
          <div key={s._id} className="flex flex-col gap-2.5 rounded-lg border p-3 text-[13px]">
            <div className="grid grid-cols-[1.6fr_1fr_auto_auto_1fr_auto] items-center gap-3">
              {canManage ? (
                <input className={inputCls} defaultValue={s.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) settingsService.updateShift(s._id, { name: v }).then(reload).catch(() => {}); }} />
              ) : (
                <span className="font-medium text-foreground">{s.name}</span>
              )}
              {canManage ? (
                <select
                  className={inputCls}
                  value={s.type}
                  onChange={(e) => {
                    const type = e.target.value as Shift["type"];
                    settingsService.updateShift(s._id, { type, weight: type === "full_day" ? 1 : 0.5 }).then(reload).catch(() => {});
                  }}
                >
                  <option value="morning">Nửa sáng (0.5)</option>
                  <option value="afternoon">Nửa chiều (0.5)</option>
                  <option value="full_day">Cả ngày (1)</option>
                </select>
              ) : (
                <span className="text-[12px] text-muted-foreground">{s.type === "full_day" ? "Cả ngày" : s.type === "morning" ? "Nửa sáng" : "Nửa chiều"}</span>
              )}
              {canManage ? (
                <div className="flex items-center gap-1.5">
                  <TimeSelect aria-label="Giờ vào" className="w-[118px]" value={s.startTime} onChange={(v) => { if (v && v !== s.startTime) settingsService.updateShift(s._id, { startTime: v }).then(reload).catch(() => {}); }} />
                  <span className="text-muted-foreground">–</span>
                  <TimeSelect aria-label="Giờ ra" className="w-[118px]" value={s.endTime} onChange={(v) => { if (v && v !== s.endTime) settingsService.updateShift(s._id, { endTime: v }).then(reload).catch(() => {}); }} />
                </div>
              ) : (
                <span className="font-mono text-[12px] text-muted-foreground">{fmtTime12(s.startTime)} – {fmtTime12(s.endTime)}</span>
              )}
              {canManage ? (
                <input
                  type="number" min={0} className={cn(inputCls, "w-[84px]")} defaultValue={s.breakMinutes}
                  onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== s.breakMinutes) settingsService.updateShift(s._id, { breakMinutes: v }).then(reload).catch(() => {}); }}
                />
              ) : (
                <span className="text-[12px] text-muted-foreground">nghỉ {s.breakMinutes}′</span>
              )}
              <span />
              {canManage && (
                <Button variant="ghost" size="icon" onClick={() => settingsService.deleteShift(s._id).then(reload).catch(() => {})} className="size-8 text-muted-foreground hover:text-rose-600" aria-label="Xoá ca"><Trash2 className="size-4" /></Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
              <span className="text-[11.5px] font-medium text-muted-foreground">Áp dụng thứ:</span>
              <WeekdayPicker
                value={s.workingDays?.length ? s.workingDays : DEFAULT_WORKING_DAYS}
                disabled={!canManage}
                onChange={(d) => { if (d.length) settingsService.updateShift(s._id, { workingDays: d }).then(reload).catch(() => {}); }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
              <span className="text-[11.5px] font-medium text-muted-foreground">Áp dụng theo mùa:</span>
              {canManage ? (
                <>
                  <DateField
                    key={`from-${s._id}-${s.effectiveFrom ?? ""}`}
                    className={cn(inputCls, "w-[150px]")}
                    value={s.effectiveFrom?.slice(0, 10)}
                    onChange={(v) => { if (v && v !== s.effectiveFrom?.slice(0, 10)) settingsService.updateShift(s._id, { effectiveFrom: v }).then(reload).catch(() => {}); }}
                  />
                  <span className="text-muted-foreground">–</span>
                  <DateField
                    key={`to-${s._id}-${s.effectiveTo ?? ""}`}
                    className={cn(inputCls, "w-[150px]")}
                    value={s.effectiveTo?.slice(0, 10)}
                    onChange={(v) => { if (v && v !== s.effectiveTo?.slice(0, 10)) settingsService.updateShift(s._id, { effectiveTo: v }).then(reload).catch(() => {}); }}
                  />
                  {(s.effectiveFrom || s.effectiveTo) ? (
                    <button
                      type="button"
                      onClick={() => settingsService.updateShift(s._id, { effectiveFrom: null, effectiveTo: null }).then(reload).catch(() => {})}
                      className="text-[11.5px] font-medium text-muted-foreground underline-offset-2 hover:text-rose-600 hover:underline"
                    >
                      Xoá (quanh năm)
                    </button>
                  ) : (
                    <span className="text-[11.5px] text-muted-foreground">Để trống = quanh năm.</span>
                  )}
                </>
              ) : (
                <span className="text-[12px] text-muted-foreground">
                  {s.effectiveFrom || s.effectiveTo ? `${fmtDMY(s.effectiveFrom ?? undefined) || "…"} – ${fmtDMY(s.effectiveTo ?? undefined) || "…"}` : "Quanh năm"}
                </span>
              )}
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
          <div className="mb-4 flex flex-col gap-2.5">
            <div className="grid grid-cols-[2fr_1.4fr_auto] items-center gap-3">
              <input className={inputCls} placeholder="Tên ngày lễ (VD: Quốc tế Phụ nữ)" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} />
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
              <Button size="sm" disabled={!holidayForm.name.trim() || (holidayForm.recurring ? !(holidayForm.day && holidayForm.month) : !holidayForm.date)} onClick={addHoliday} className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm</Button>
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
              <input className={cn(inputCls, "flex-1")} defaultValue={h.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== h.name) settingsService.updateHoliday(h._id, { name: v }).then(reload).catch(() => {}); }} />
            ) : (
              <span className="flex-1 font-medium text-foreground">{h.name}</span>
            )}
            {h.isRecurring ? (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono text-[12px] text-muted-foreground">{fmtDM(h.date)}</span>
                <CountBadge tone="violet">Hằng năm</CountBadge>
              </span>
            ) : canManage ? (
              <DateField className={cn(inputCls, "w-[190px]")} value={h.date?.slice(0, 10)} onChange={(v) => { if (v && v !== h.date?.slice(0, 10)) settingsService.updateHoliday(h._id, { date: v }).then(reload).catch(() => {}); }} />
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
          <div className="mb-4 grid grid-cols-[90px_1.4fr_1.3fr_100px_auto] items-end gap-3">
            <input className={cn(inputCls, "font-mono")} placeholder="Mã (X, P…)" value={symbolForm.code} onChange={(e) => setSymbolForm({ ...symbolForm, code: e.target.value })} />
            <input className={inputCls} placeholder="Ý nghĩa" value={symbolForm.label} onChange={(e) => setSymbolForm({ ...symbolForm, label: e.target.value })} />
            <select className={inputCls} value={symbolForm.appliesTo} onChange={(e) => setSymbolForm({ ...symbolForm, appliesTo: e.target.value })}>
              <option value="">— Trạng thái áp dụng —</option>
              {ATT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={cn(inputCls, "capitalize")} value={symbolForm.color} onChange={(e) => setSymbolForm({ ...symbolForm, color: e.target.value })}>
              <option value="">Màu</option>
              {CHIP_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Button size="sm" disabled={!symbolForm.code.trim() || !symbolForm.label.trim()} onClick={addSymbol} className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm</Button>
          </div>
        )}
        <List rows={symbols} empty="Chưa có ký hiệu." render={(s) => (
          <div key={s._id} className="flex items-center gap-3 rounded-lg border p-3 text-[13px]">
            <span className="flex size-7 items-center justify-center rounded-md font-mono font-bold" style={s.color ? { background: `var(--chip-${s.color}-bg)`, color: `var(--chip-${s.color}-ink)` } : { background: "var(--muted)", color: "var(--foreground)" }}>{s.code}</span>
            {canManage ? (
              <input className={cn(inputCls, "flex-1")} defaultValue={s.label} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.label) settingsService.updateSymbol(s._id, { label: v }).then(reload).catch(() => {}); }} />
            ) : (
              <span className="flex-1 text-foreground">{s.label}</span>
            )}
            {canManage ? (
              <select className={cn(inputCls, "w-[150px]")} value={s.appliesTo ?? ""} onChange={(e) => settingsService.updateSymbol(s._id, { appliesTo: e.target.value || null }).then(reload).catch(() => {})}>
                <option value="">— Không gán —</option>
                {ATT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <span className="text-[11px] text-muted-foreground">{attStatusLabel(s.appliesTo) ?? "—"}</span>
            )}
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
