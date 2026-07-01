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

function toParts(v: string): { hh: string; mm: string } {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  return m ? { hh: m[1], mm: m[2] } : { hh: "", mm: "" };
}

const complete = (hh: string, mm: string) => hh.length === 2 && mm.length === 2;
function toValue(hh: string, mm: string): string {
  if (!complete(hh, mm)) return "";
  if (+hh > 23 || +mm > 59) return "";
  return `${hh}:${mm}`;
}

const segCls =
  "bg-transparent text-center text-[13px] tabular-nums outline-none placeholder:text-muted-foreground/50 w-[1.6rem]";

/**
 * Locale-independent 24h time field — always HH : mm with the ":" shown
 * up-front. Auto-advances forward as you type and backward on backspace,
 * validates each segment's range, offers a native clock picker. R/W "HH:mm".
 */
export function TimeInput({ value, onChange, className, id }: Props) {
  const [{ hh, mm }, setP] = useState(() => toParts(value));
  const hhRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const invalid = complete(hh, mm) && !toValue(hh, mm);
  const seg = (raw: string) => raw.replace(/\D/g, "").slice(0, 2);

  function update(nh: string, nm: string) {
    setP({ hh: nh, mm: nm });
    onChange(toValue(nh, nm));
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
          update(nh, mm);
          if (nh.length === 2) mmRef.current?.focus();
        }}
        className={segCls}
      />
      <span className="text-muted-foreground/70">:</span>
      <input
        ref={mmRef}
        type="text" inputMode="numeric" autoComplete="off"
        placeholder="--" value={mm}
        onChange={(e) => update(hh, seg(e.target.value))}
        onKeyDown={(e) => { if (e.key === "Backspace" && mm === "" && hhRef.current) { e.preventDefault(); hhRef.current.focus(); } }}
        className={segCls}
      />
      <button
        type="button"
        onClick={() => pickerRef.current?.showPicker?.()}
        className="ml-auto flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:text-primary-600"
        tabIndex={-1}
      >
        <Clock className="size-4" />
      </button>
      <input
        ref={pickerRef}
        type="time"
        value={toValue(hh, mm)}
        onChange={(e) => { const t = toParts(e.target.value); update(t.hh, t.mm); }}
        className="pointer-events-none size-0 opacity-0"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
