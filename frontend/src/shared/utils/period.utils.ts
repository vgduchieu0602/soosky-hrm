/**
 * Payroll periods are stored canonically as "YYYY-MM" (so string sort = time
 * order, and it matches the attendance grid month + backend regex). The UI
 * shows them as "MM-YYYY" per product preference.
 */

/** "2026-07" → "07-2026". Passes through anything not in canonical form. */
export function fmtPeriodName(name?: string | null): string {
  if (!name) return "—";
  const m = /^(\d{4})-(\d{2})$/.exec(name);
  return m ? `${m[2]}-${m[1]}` : name;
}

/**
 * Parse a free-typed month string into canonical "YYYY-MM" (or "" if not yet
 * complete). Accepts continuous digits with a 2-digit-month preference, so:
 *   "072026" → "2026-07",  "72026" → "2026-07" (72 > 12 ⇒ month is 7),
 *   "122026" → "2026-12".
 */
export function parseMonthInput(raw: string): { month: string; year: string } {
  const d = raw.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return { month: d, year: "" };
  const twoDigit = Number(d.slice(0, 2));
  const monthLen = twoDigit >= 1 && twoDigit <= 12 ? 2 : 1;
  return { month: d.slice(0, monthLen), year: d.slice(monthLen, monthLen + 4) };
}

/** month+year parts → canonical "YYYY-MM", or "" when incomplete/invalid. */
export function toCanonicalMonth(month: string, year: string): string {
  if (month.length === 0 || year.length !== 4) return "";
  const mm = Number(month);
  if (mm < 1 || mm > 12) return "";
  return `${year}-${String(mm).padStart(2, "0")}`;
}
