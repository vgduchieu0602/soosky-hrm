// Soosky HRM — Performance review mock data + computation helpers.
// Replace with real API responses (see share-docs/API-SPEC.md) when the
// performance backend endpoints are available.

type BadgeVariant = "slate" | "amber" | "emerald" | "blue" | "violet" | "rose";

export interface CycleInfo {
  name: string;
  label: string;
  period: string;
  deadline: string;
}

export const CYCLE: CycleInfo = {
  name: "Tháng 5, 2026",
  label: "Kỳ đánh giá tháng 5",
  period: "01/05 – 31/05/2026",
  deadline: "05/06/2026",
};

/** Evaluation feeds 80% of salary: performance 60% + goal 20%. */
export const WEIGHTS = { perf: 0.6, goal: 0.2 } as const;

export interface Criterion {
  key: string;
  label: string;
  short: string;
}

export const CRITERIA: Criterion[] = [
  { key: "quality", label: "Chất lượng công việc", short: "Chất lượng" },
  { key: "productivity", label: "Năng suất & khối lượng", short: "Năng suất" },
  { key: "teamwork", label: "Phối hợp & tinh thần đồng đội", short: "Phối hợp" },
  { key: "discipline", label: "Kỷ luật & tuân thủ", short: "Kỷ luật" },
];

export const DEPTS = [
  "Tất cả",
  "Engineering",
  "Sales",
  "Marketing",
  "Operations",
  "Finance",
];

export interface RatingMeta {
  min: number;
  label: string;
  variant: BadgeVariant;
}

export const RATING: RatingMeta[] = [
  { min: 90, label: "Xuất sắc", variant: "emerald" },
  { min: 75, label: "Tốt", variant: "blue" },
  { min: 60, label: "Đạt", variant: "amber" },
  { min: 0, label: "Cần cải thiện", variant: "rose" },
];

/** Map a 0–100 performance average to its rating tier. */
export function ratingOf(perfAvg: number): RatingMeta {
  return RATING.find((r) => perfAvg >= r.min) ?? RATING[RATING.length - 1];
}

export type ReviewState = "done" | "in_review" | "self" | "not_started";

export interface ReviewStatusMeta {
  label: string;
  variant: BadgeVariant;
}

export const REVIEW_STATUS: Record<ReviewState, ReviewStatusMeta> = {
  done: { label: "Đã chốt", variant: "emerald" },
  in_review: { label: "Đang đánh giá", variant: "amber" },
  self: { label: "Tự đánh giá", variant: "blue" },
  not_started: { label: "Chưa bắt đầu", variant: "slate" },
};

export interface Review {
  code: string;
  name: string;
  initials: string;
  title: string;
  dept: string;
  state: ReviewState;
  scores: number[];
  goal: number;
  base: number;
  reviewer: string;
  summary: string;
}

export const REVIEWS: Review[] = [
  { code: "EMP-0011", name: "Phan Quỳnh Trang", initials: "QT", title: "Sales Lead", dept: "Sales", state: "done", scores: [95, 92, 90, 98], goal: 96, base: 32000000, reviewer: "Đức Hiếu", summary: "Hoàn thành xuất sắc chỉ tiêu doanh số quý, dẫn dắt đội ngũ hiệu quả và chủ động đào tạo thành viên mới." },
  { code: "EMP-0034", name: "Bùi Trọng Hải", initials: "TH", title: "Senior Engineer", dept: "Engineering", state: "done", scores: [94, 90, 88, 92], goal: 90, base: 38000000, reviewer: "Mai Lan", summary: "Chất lượng code cao, giải quyết tốt các sự cố hệ thống, cần cải thiện thêm về chia sẻ kiến thức trong nhóm." },
  { code: "EMP-0067", name: "Vũ Ngọc Linh", initials: "NL", title: "Product Designer", dept: "Marketing", state: "in_review", scores: [90, 88, 92, 86], goal: 88, base: 26000000, reviewer: "Đức Hiếu", summary: "Sản phẩm thiết kế nhất quán, phối hợp tốt với đội phát triển; đang trong quá trình đánh giá cuối kỳ." },
  { code: "EMP-0102", name: "Hoàng Văn Sơn", initials: "VS", title: "Customer Success", dept: "Operations", state: "in_review", scores: [85, 82, 88, 84], goal: 84, base: 22000000, reviewer: "Mai Lan", summary: "Chăm sóc khách hàng tận tâm, tỷ lệ hài lòng cao; cần nâng cao tốc độ xử lý yêu cầu phức tạp." },
  { code: "EMP-0145", name: "Đào Minh Châu", initials: "MC", title: "Marketing Manager", dept: "Marketing", state: "self", scores: [88, 90, 86, 89], goal: 90, base: 28000000, reviewer: "Đức Hiếu", summary: "Đã hoàn thành tự đánh giá, chờ quản lý xác nhận kết quả các chiến dịch trong tháng." },
  { code: "EMP-0089", name: "Nguyễn Văn Bảo", initials: "VB", title: "Backend Engineer", dept: "Engineering", state: "self", scores: [80, 84, 82, 86], goal: 82, base: 30000000, reviewer: "Mai Lan", summary: "Tự đánh giá đạt yêu cầu, cần quản lý đối chiếu với kết quả sprint tháng 5." },
  { code: "EMP-0207", name: "Phạm Thu Hà", initials: "TH", title: "Kế toán", dept: "Finance", state: "not_started", scores: [0, 0, 0, 0], goal: 0, base: 20000000, reviewer: "Đức Hiếu", summary: "Chưa bắt đầu chu trình đánh giá cho kỳ này." },
  { code: "EMP-0156", name: "Lê Khánh Duy", initials: "KD", title: "Sales Executive", dept: "Sales", state: "not_started", scores: [0, 0, 0, 0], goal: 0, base: 18000000, reviewer: "Đức Hiếu", summary: "Chưa bắt đầu chu trình đánh giá cho kỳ này." },
];

export interface ReviewComputation {
  perfAvg: number;
  rGoal: number;
  payPerf: number;
  payGoal: number;
  payTotal: number;
}

export function evalc(r: Review): ReviewComputation {
  const perfAvg = r.scores.reduce((s, v) => s + v, 0) / r.scores.length; // 0–100
  const rGoal = r.goal / 100;
  const payPerf = WEIGHTS.perf * r.base * (perfAvg / 100);
  const payGoal = WEIGHTS.goal * r.base * rGoal;
  const payTotal = payPerf + payGoal;
  return { perfAvg, rGoal, payPerf, payGoal, payTotal };
}

/** Format a number with Vietnamese thousands separators. */
export const fmt = (n: number): string => Math.round(n).toLocaleString("vi-VN");

/** Round a 0–100 ratio to an integer percentage. */
export const pctn = (n: number): number => Math.round(n);
