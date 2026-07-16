/** 24h "HH:mm" → "hh:mm SA/CH" (12h, Vietnamese am/pm). */
export function fmtTime12(v: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return v;
  const h24 = +m[1];
  const suffix = h24 < 12 ? "SA" : "CH";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${m[2]} ${suffix}`;
}
