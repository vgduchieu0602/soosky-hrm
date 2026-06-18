import { useState } from "react";

/** Normalize free text → "HH:mm" 24h (or "" if empty). Accepts "900", "9:0", "0900". */
function normalize(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (!d) return "";
  const h = Math.min(parseInt(d.slice(0, 2) || "0", 10), 23);
  const m = d.length > 2 ? Math.min(parseInt(d.slice(2, 4), 10), 59) : 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
}

/**
 * 24h time field (no AM/PM). A plain text input we normalize on blur, so it is
 * locale-independent — unlike `<input type="time">` which Chrome renders in the
 * OS locale's 12h format and ignores `lang`.
 */
export function TimeInput({ value, onChange, className, placeholder = "HH:mm", id }: Props) {
  const [text, setText] = useState(value);

  function commit(raw: string) {
    const n = normalize(raw);
    setText(n);
    onChange(n);
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      className={className}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }}
    />
  );
}
