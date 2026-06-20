/** Decimal128 may arrive as a plain string or as `{ $numberDecimal: "…" }`. */
export type DecimalLike = string | number | { $numberDecimal: string } | null | undefined;

/** Parse any Decimal128-ish value to a JS number (0 when absent/invalid). */
export function parseDecimal(value: DecimalLike): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (typeof value === "object" && "$numberDecimal" in value) {
    return Number(value.$numberDecimal) || 0;
  }
  return 0;
}

const VND = new Intl.NumberFormat("vi-VN");

/** Format a number (or Decimal-like) as grouped VND digits, no currency symbol. */
export function fmtVND(value: DecimalLike): string {
  return VND.format(Math.round(parseDecimal(value)));
}
