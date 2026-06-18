import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TimeInput } from "@/components/ui/time-input";
import { cn } from "@/shared/utils/cn";
import { settingsService } from "@features/settings/services/settings.service";
import type { AttendanceSymbol, Holiday, Shift } from "@features/settings/types/settings.types";

const inputCls =
  "flex h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

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
  const [shiftForm, setShiftForm] = useState({ name: "", startTime: "08:00", endTime: "12:00", breakMinutes: "0" });
  const [holidayForm, setHolidayForm] = useState({ name: "", date: "" });
  const [symbolForm, setSymbolForm] = useState({ code: "", label: "" });

  function addShift() {
    settingsService.createShift({
      name: shiftForm.name.trim(),
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      breakMinutes: Number(shiftForm.breakMinutes) || 0,
    })
      .then(() => { setShiftForm({ name: "", startTime: "08:00", endTime: "12:00", breakMinutes: "0" }); reload(); })
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

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-muted/50" />;

  return (
    <div className="flex flex-col gap-6">
      {/* Shifts */}
      <Card className="p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-foreground">Ca làm việc</h3>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground">{activeShifts.length} ca/ngày</span>
        </div>
        <p className="mb-4 text-[12.5px] text-muted-foreground">Số ca và giờ giấc do bạn cấu hình; bảng chấm công sẽ hiển thị đúng số ca này mỗi ngày.</p>
        {canManage && (
          <div className="mb-4 grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-end gap-3">
            <input className={inputCls} placeholder="Tên ca (VD: Ca sáng)" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} />
            <TimeInput className={inputCls} value={shiftForm.startTime} onChange={(v) => setShiftForm({ ...shiftForm, startTime: v })} />
            <TimeInput className={inputCls} value={shiftForm.endTime} onChange={(v) => setShiftForm({ ...shiftForm, endTime: v })} />
            <input type="number" min={0} className={inputCls} placeholder="Nghỉ (phút)" value={shiftForm.breakMinutes} onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: e.target.value })} />
            <Button size="sm" disabled={!shiftForm.name.trim()} onClick={addShift} className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm ca</Button>
          </div>
        )}
        <List rows={activeShifts} empty="Chưa có ca làm việc — hãy thêm ít nhất 1 ca." render={(s) => (
          <div key={s._id} className="grid grid-cols-[2fr_auto_auto_auto] items-center gap-3 rounded-lg border p-3 text-[13px]">
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
        )} />
      </Card>

      {/* Holidays */}
      <Card className="p-6">
        <h3 className="mb-4 text-[15px] font-semibold text-foreground">Ngày lễ</h3>
        {canManage && (
          <div className="mb-4 grid grid-cols-[2fr_1fr_auto] items-end gap-3">
            <input className={inputCls} placeholder="Tên ngày lễ" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} />
            <input type="date" className={inputCls} value={holidayForm.date} onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })} />
            <Button size="sm" disabled={!holidayForm.name.trim() || !holidayForm.date} onClick={addHoliday} className="h-9 gap-1.5 rounded-lg"><Plus className="size-3.5" /> Thêm</Button>
          </div>
        )}
        <List rows={holidays} empty="Chưa có ngày lễ." render={(h) => (
          <div key={h._id} className="flex items-center gap-3 rounded-lg border p-3 text-[13px]">
            <span className="flex-1 font-medium text-foreground">{h.name}</span>
            <span className="font-mono text-[12px] text-muted-foreground">{h.date?.slice(0, 10)}</span>
            {canManage && (
              <Button variant="ghost" size="icon" onClick={() => settingsService.deleteHoliday(h._id).then(reload).catch(() => {})} className="size-8 text-muted-foreground hover:text-rose-600"><Trash2 className="size-4" /></Button>
            )}
          </div>
        )} />
      </Card>

      {/* Symbols */}
      <Card className="p-6">
        <h3 className="mb-4 text-[15px] font-semibold text-foreground">Ký hiệu chấm công</h3>
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
            <span className="flex-1 text-foreground">{s.label}</span>
            <span className="text-[11px] text-muted-foreground">{s.paidStatus}{s.affectsPayroll ? " · ảnh hưởng lương" : ""}</span>
          </div>
        )} />
      </Card>
    </div>
  );
}

function List<T>({ rows, empty, render }: { rows: T[]; empty: string; render: (row: T) => React.ReactNode }) {
  if (rows.length === 0) return <p className="py-4 text-center text-[13px] text-muted-foreground">{empty}</p>;
  return <div className="flex flex-col gap-2">{rows.map(render)}</div>;
}
