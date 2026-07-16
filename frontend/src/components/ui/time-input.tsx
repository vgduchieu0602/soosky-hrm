import { useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface Props {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
}

type Period = "AM" | "PM";

/** 24h "HH:mm" → 12h parts for display. */
function to12(h24: number): { hour12: number; period: Period } {
  const period: Period = h24 < 12 ? "AM" : "PM";
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12, period };
}

/** 12h hour + period → 24h hour. */
function to24(hour12: number, period: Period): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function toParts(v: string): { hh: string; mm: string; period: Period } {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return { hh: "", mm: "", period: "AM" };
  const { hour12, period } = to12(+m[1]);
  return { hh: String(hour12).padStart(2, "0"), mm: m[2], period };
}

const complete = (hh: string, mm: string) => hh.length === 2 && mm.length === 2;
function toValue(hh: string, mm: string, period: Period): string {
  if (!complete(hh, mm)) return "";
  const hour12 = +hh;
  if (hour12 < 1 || hour12 > 12 || +mm > 59) return "";
  const h24 = to24(hour12, period);
  return `${String(h24).padStart(2, "0")}:${mm}`;
}

const segCls =
  "bg-transparent text-center text-[13px] tabular-nums outline-none placeholder:text-muted-foreground/50 w-[1.6rem]";

/**
 * Locale-independent 12h time field — hh : mm plus an AM/PM toggle, so entry
 * never requires mental 24h conversion. Auto-advances forward as you type and
 * backward on backspace, validates each segment's range, offers a native
 * clock picker. Reads/writes 24h "HH:mm" (unchanged external contract).
 */
export function TimeInput({ value, onChange, className, id }: Props) {
  const [{ hh, mm, period }, setP] = useState(() => toParts(value));
  const hhRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const invalid = complete(hh, mm) && !toValue(hh, mm, period);
  const seg = (raw: string) => raw.replace(/\D/g, "").slice(0, 2);

  function update(nh: string, nm: string, np: Period) {
    setP({ hh: nh, mm: nm, period: np });
    onChange(toValue(nh, nm, np));
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        className || "h-9 rounded-lg border border-input bg-card px-2.5",
        "focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20",
        invalid && "!border-destructive ring-2 ring-destructive/20",
      )}
    >
      <input
        id={id} ref={hhRef}
        type="text" inputMode="numeric" autoComplete="off"
        placeholder="--" value={hh}
        onChange={(e) => {
          const nh = seg(e.target.value);
          update(nh, mm, period);
          if (nh.length === 2) mmRef.current?.focus();
        }}
        onBlur={(e) => {
          // Read the DOM value, not the closed-over `hh` — a programmatic
          // focus() (auto-advance to mm on the 2nd digit) fires this blur
          // synchronously before React re-renders, so `hh` here can still be
          // one render behind and stomp the just-typed second digit.
          const v = e.target.value;
          if (v.length === 1) update(v.padStart(2, "0"), mm, period);
        }}
        className={segCls}
      />
      <span className="text-muted-foreground/70">:</span>
      <input
        ref={mmRef}
        type="text" inputMode="numeric" autoComplete="off"
        placeholder="--" value={mm}
        onChange={(e) => update(hh, seg(e.target.value), period)}
        onBlur={(e) => {
          const v = e.target.value;
          if (v.length === 1) update(hh, v.padStart(2, "0"), period);
        }}
        onKeyDown={(e) => { if (e.key === "Backspace" && mm === "" && hhRef.current) { e.preventDefault(); hhRef.current.focus(); } }}
        className={segCls}
      />
      <button
        type="button"
        onClick={() => update(hh, mm, period === "AM" ? "PM" : "AM")}
        className="press ml-0.5 shrink-0 rounded px-1 text-[11px] font-semibold tracking-wide text-muted-foreground transition-colors hover:text-primary-600"
        tabIndex={-1}
        aria-label={period === "AM" ? "Chuyển sang PM" : "Chuyển sang AM"}
      >
        {period}
      </button>
      <button
        type="button"
        onClick={() => pickerRef.current?.showPicker?.()}
        className="press ml-auto flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-primary-600"
        tabIndex={-1}
      >
        <Clock className="size-4" />
      </button>
      <input
        ref={pickerRef}
        type="time"
        value={toValue(hh, mm, period)}
        onChange={(e) => { const t = toParts(e.target.value); update(t.hh, t.mm, t.period); }}
        className="pointer-events-none size-0 opacity-0"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
