import { useState } from "react";
import { cn } from "@/shared/utils/cn";
import { parseMonthInput, toCanonicalMonth } from "@/shared/utils/period.utils";

interface Props {
  /** Canonical "YYYY-MM" (or ""). */
  value: string;
  onChange: (canonical: string) => void;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}

function toParts(v: string): { month: string; year: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  return m ? { month: m[2], year: m[1] } : { month: "", year: "" };
}

/**
 * Month picker typed as MM-YYYY. Accepts continuous digits ("072026" or
 * "72026") in one field and auto-formats to "07-2026"; reads/writes canonical
 * "YYYY-MM" so the rest of the app (matching, sorting) is unchanged.
 */
export function MonthField({ value, onChange, className, id, autoFocus }: Props) {
  const [{ month, year }, setP] = useState(() => toParts(value));

  const canonical = toCanonicalMonth(month, year);
  const complete = month !== "" && year.length === 4;
  const invalid = complete && !canonical;

  function handle(raw: string) {
    const next = parseMonthInput(raw);
    setP(next);
    onChange(toCanonicalMonth(next.month, next.year));
  }

  function padMonthOnBlur() {
    if (month.length === 1) {
      const padded = month.padStart(2, "0");
      setP((p) => ({ ...p, month: padded }));
      onChange(toCanonicalMonth(padded, year));
    }
  }

  // Display string mirrors what the user typed, formatted MM-YYYY as it grows.
  const display = year.length ? `${month}-${year}` : month;

  return (
    <div
      className={cn(
        "flex h-9 items-center rounded-md border border-input bg-background px-3 text-[13px] tabular-nums",
        "transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20",
        invalid && "!border-destructive ring-2 ring-destructive/20",
        className,
      )}
    >
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="MM-YYYY"
        value={display}
        onChange={(e) => handle(e.target.value)}
        onBlur={padMonthOnBlur}
        className="w-full bg-transparent outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}
