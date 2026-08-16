// Soosky HRM — Dashboard shape/type anchors + nav.
// NOTE: no more hardcoded sample data. The dashboard renders ONLY real data
// from GET /admin/dashboard (see dashboard.service). These exports are empty
// defaults / type anchors so components compile; they are never shown to users
// (DashboardPage gates rendering on the loaded API response).

export type ChipColor = "blue" | "emerald" | "indigo" | "violet" | "amber" | "rose" | "cyan";

/**
 * Mục điều hướng. `roles` liệt kê vai trò được THẤY mục đó; bỏ trống nghĩa là mọi
 * người đã đăng nhập. Đây chỉ là lớp trải nghiệm — máy chủ vẫn là nơi chặn thật,
 * và `RoleRoute` chặn ở tầng router.
 */
export const NAV_ITEMS = [
  { id: "dash", label: "Tổng quan", icon: "LayoutDashboard", to: "/dashboard" },
  { id: "emp", label: "Nhân viên", icon: "Users", to: "/employees", roles: ["admin", "hr_manager"] },
  { id: "org", label: "Phòng ban", icon: "Building2", to: "/departments", roles: ["admin", "hr_manager"] },
  { id: "att", label: "Chấm công", icon: "Clock", to: "/attendance" },
  { id: "leave", label: "Nghỉ phép", icon: "CalendarDays", to: "/leave" },
  { id: "pay", label: "Bảng lương", icon: "Wallet", to: "/payroll", roles: ["admin", "hr_manager"] },
  { id: "perf", label: "Đánh giá", icon: "Trophy", to: "/performance", roles: ["admin", "hr_manager"] },
  { id: "mypayslips", label: "Phiếu lương của tôi", icon: "ReceiptText", to: "/me/payslips" },
  { id: "myeval", label: "Đánh giá của tôi", icon: "ClipboardList", to: "/me/evaluations" },
] as const satisfies readonly {
  id: string;
  label: string;
  icon: string;
  to: string;
  roles?: readonly string[];
}[];

export interface TopKpi {
  label: string;
  value: string;
  suffix?: string;
  icon: string;
  chip: ChipColor;
  delta?: number;
}

// --- empty defaults / type anchors (populated at runtime from the API) ---
export const TOP_KPIS: TopKpi[] = [];

export const DEPARTMENTS_CHART: { name: string; count: number; color: string }[] = [];

export const ATTENDANCE_TODAY: { label: string; value: number; color: string }[] = [];

export const ATTENDANCE_TREND = {
  week: { labels: [] as string[], attend: [] as number[], late: [] as number[] },
  month: { labels: [] as string[], attend: [] as number[], late: [] as number[] },
};

export const PENDING_LEAVES: {
  name: string; initials: string; code: string; type: string; duration: string; range: string; submitted: string;
}[] = [];

export const UPCOMING_LEAVES: {
  name: string; initials: string; code: string; type: string; range: string; duration: string; relative: string;
}[] = [];

export const PAYROLL = {
  period: "—",
  status: "—",
  total: "0",
  computedRatio: 0,
  headcount: 0,
  payDate: "—",
  breakdown: [] as { label: string; value: string; tone?: "neg" }[],
};

export const PERFORMERS: {
  rank: number; name: string; initials: string; code: string; role: string; dept: string; score: number;
}[] = [];

export const ACTIVITIES: { who: string; what: string; target: string; when: string; icon: string }[] = [];
