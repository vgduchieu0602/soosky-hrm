// Maps a 0–100 score/ratio to a labelled band so HR & employees can read the
// number at a glance instead of guessing what "67%" means.
export type BandTone = "rose" | "amber" | "blue" | "emerald";

export interface ScoreBand {
  label: string;
  tone: BandTone;
}

export function scoreBand(value: number): ScoreBand {
  const v = Math.round(value);
  if (v < 50) return { label: "Kém", tone: "rose" };
  if (v < 70) return { label: "Đạt", tone: "amber" };
  if (v < 85) return { label: "Tốt", tone: "blue" };
  return { label: "Xuất sắc", tone: "emerald" };
}
