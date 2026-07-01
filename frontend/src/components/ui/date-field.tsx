import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface Props {
  id?: string;
  /** ISO date `yyyy-mm-dd` (or empty). */
  value?: string;
  /** Emits ISO `yyyy-mm-dd`, or "" while incomplete/invalid. */
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

interface Parts { dd: string; mm: string; yyyy: string }

function isoToParts(iso?: string): Parts {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? { dd: m[3], mm: m[2], yyyy: m[1] } : { dd: "", mm: "", yyyy: "" };
}

/** Complete + real date → ISO; otherwise "". */
function partsToIso({ dd, mm, yyyy }: Parts): string {
  if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return "";
  const d = +dd, mo = +mm, y = +yyyy;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return "";
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return ""; // reject 31/02 etc.
  return `${yyyy}-${mm}-${dd}`;
}

const isComplete = (p: Parts) => p.dd.length === 2 && p.mm.length === 2 && p.yyyy.length === 4;
const segCls =
  "bg-transparent text-center text-[13px] tabular-nums outline-none placeholder:text-muted-foreground/50";

/**
 * Locale-independent segmented date input — always dd / mm / yyyy with the "/"
 * separators visible up-front. Auto-advances forward as you type and backward
 * on backspace, validates each segment + rejects impossible dates, and offers a
 * native calendar picker. Reads/writes ISO `yyyy-mm-dd` (drop-in DateField).
 */
export function DateField({ id, value, onChange, className, autoFocus }: Props) {
  const [p, setP] = useState<Parts>(() => isoToParts(value));
  const ddRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);
  const yyyyRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const invalid = isComplete(p) && !partsToIso(p);
  const seg = (raw: string, max: number) => raw.replace(/\D/g, "").slice(0, max);

  function update(next: Parts) {
    setP(next);
    onChange(partsToIso(next));
  }
  /** Backspace on an empty segment jumps to the end of the previous one. */
  function backNav(e: React.KeyboardEvent<HTMLInputElement>, cur: string, prev: React.RefObject<HTMLInputElement | null>) {
    if (e.key === "Backspace" && cur === "" && prev.current) {
      e.preventDefault();
      prev.current.focus();
    }
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
        id={id} ref={ddRef}
        type="text" inputMode="numeric" autoComplete="off" autoFocus={autoFocus}
        placeholder="dd" value={p.dd}
        onChange={(e) => {
          const dd = seg(e.target.value, 2);
          update({ ...p, dd });
          if (dd.length === 2) mmRef.current?.focus();
        }}
        className={cn(segCls, "w-[1.6rem]")}
      />
      <span className="text-muted-foreground/70">/</span>
      <input
        ref={mmRef}
        type="text" inputMode="numeric" autoComplete="off"
        placeholder="mm" value={p.mm}
        onChange={(e) => {
          const mm = seg(e.target.value, 2);
          update({ ...p, mm });
          if (mm.length === 2) yyyyRef.current?.focus();
        }}
        onKeyDown={(e) => backNav(e, p.mm, ddRef)}
        className={cn(segCls, "w-[1.6rem]")}
      />
      <span className="text-muted-foreground/70">/</span>
      <input
        ref={yyyyRef}
        type="text" inputMode="numeric" autoComplete="off"
        placeholder="yyyy" value={p.yyyy}
        onChange={(e) => update({ ...p, yyyy: seg(e.target.value, 4) })}
        onKeyDown={(e) => backNav(e, p.yyyy, mmRef)}
        className={cn(segCls, "w-[2.9rem]")}
      />
      <button
        type="button"
        onClick={() => pickerRef.current?.showPicker?.()}
        className="ml-auto flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:text-primary-600"
        tabIndex={-1}
      >
        <CalendarDays className="size-4" />
      </button>
      {/* Hidden native picker — only used for the calendar popup. */}
      <input
        ref={pickerRef}
        type="date"
        value={partsToIso(p)}
        onChange={(e) => update(isoToParts(e.target.value))}
        className="pointer-events-none size-0 opacity-0"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
