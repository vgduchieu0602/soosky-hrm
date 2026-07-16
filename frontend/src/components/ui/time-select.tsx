import { useMemo } from "react";
import { cn } from "@/shared/utils/cn";
import { fmtTime12 } from "@/shared/utils/time.utils";

interface Props {
  /** 24h "HH:mm" (external contract identical to TimeInput). */
  value: string;
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
  /** Minute granularity of the option grid. Default 30. */
  stepMinutes?: number;
  "aria-label"?: string;
}

/**
 * Shift time picker — one dropdown, options on a fixed-minute grid labelled in
 * 12h SA/CH so no 24h mental math and no per-keystroke saves (a select emits a
 * single, final change). If the current value falls off the grid (legacy data,
 * e.g. 08:15) it is kept as an extra option so nothing is silently rewritten.
 */
export function TimeSelect({ value, onChange, className, disabled, stepMinutes = 30, ...aria }: Props) {
  const options = useMemo(() => {
    const grid: string[] = [];
    for (let mins = 0; mins < 24 * 60; mins += stepMinutes) {
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      grid.push(`${hh}:${mm}`);
    }
    if (value && !grid.includes(value) && /^\d{2}:\d{2}$/.test(value)) {
      grid.push(value);
      grid.sort();
    }
    return grid;
  }, [stepMinutes, value]);

  return (
    <select
      {...aria}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 cursor-pointer rounded-lg border border-input bg-card px-2.5 text-[13px] tabular-nums",
        "transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-primary-500/60",
        "focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20",
        className,
      )}
    >
      {!value && <option value="">— Giờ —</option>}
      {options.map((t) => (
        <option key={t} value={t}>{fmtTime12(t)}</option>
      ))}
    </select>
  );
}
