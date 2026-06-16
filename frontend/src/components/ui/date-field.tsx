import { useState } from "react";
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

/** ISO `yyyy-mm-dd` → display `dd/mm/yyyy`. */
function isoToDisplay(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Progressive mask: keep digits, group as dd/mm/yyyy. */
function mask(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join("/");
}

/** display `dd/mm/yyyy` → ISO `yyyy-mm-dd`, or "" if not a valid full date. */
function displayToIso(s: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return "";
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  // Reject overflow (e.g. 31/02 → normalized to March).
  if (date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Locale-independent date input that always reads/writes `dd/mm/yyyy`.
 * Replaces native `<input type="date">` whose visual format follows the
 * browser locale (often mm/dd/yyyy). Stores the ISO `yyyy-mm-dd` string.
 *
 * The parent owns the value; this seeds its display once on mount, so callers
 * remount it (via a changing dialog/form key) when opening a new record.
 */
export function DateField({ id, value, onChange, className, placeholder = "dd/mm/yyyy", autoFocus }: Props) {
  const [text, setText] = useState(() => isoToDisplay(value));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = mask(e.target.value);
    setText(next);
    onChange(displayToIso(next));
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={text}
      autoFocus={autoFocus}
      onChange={handleChange}
      className={cn(className)}
    />
  );
}
