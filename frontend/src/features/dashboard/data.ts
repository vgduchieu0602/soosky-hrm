// Soosky HRM — Dashboard mock data
// Replace with real API responses (see share-docs/API-SPEC.md).

export type ChipColor =
  | "blue"
  | "emerald"
  | "indigo"
  | "violet"
  | "amber"
  | "rose"
  | "cyan";

export const NAV_ITEMS = [
  { id: "dash", label: "Tổng quan", icon: "LayoutDashboard", to: "/dashboard" },
  { id: "emp", label: "Nhân viên", icon: "Users", to: "/employees" },
  { id: "org", label: "Phòng ban", icon: "Building2", to: "/departments" },
  { id: "att", label: "Chấm công", icon: "Clock", to: "/attendance" },
  { id: "leave", label: "Nghỉ phép", icon: "CalendarDays", to: "/leave" },
  { id: "pay", label: "Bảng lương", icon: "Wallet", to: "/payroll" },
  { id: "perf", label: "Đánh giá", icon: "Trophy", to: "/performance" },
  { id: "mypayslips", label: "Phiếu lương của tôi", icon: "ReceiptText", to: "/me/payslips" },
  { id: "myeval", label: "Đánh giá của tôi", icon: "ClipboardList", to: "/me/evaluations" },
] as const;

export interface TopKpi {
  label: string;
  value: string;
  suffix?: string;
  icon: string;
  chip: ChipColor;
  delta?: number;
}

export const TOP_KPIS: TopKpi[] = [
  { label: "Total Employees", value: "248", icon: "Users", chip: "blue", delta: 4.8 },
  { label: "Active Employees", value: "234", icon: "UserCheck", chip: "emerald", delta: 2.1 },
  { label: "New Hires Tháng này", value: "12", icon: "UserPlus", chip: "indigo", delta: 33.3 },
  { label: "Đang nghỉ Hôm nay", value: "7", icon: "CalendarOff", chip: "violet", delta: -2 },
  { label: "Đơn nghỉ chờ duyệt", value: "5", icon: "CalendarDays", chip: "amber", delta: 25 },
  { label: "Đi muộn hôm nay", value: "14", icon: "Clock", chip: "rose", delta: -12.5 },
  { label: "Lương Tháng 5", value: "3,2B", suffix: "₫", icon: "Wallet", chip: "cyan", delta: 8.4 },
];

export const DEPARTMENTS_CHART = [
  { name: "Engineering", count: 96, color: "#00B8F5" },
  { name: "Sales & Marketing", count: 48, color: "#367BFF" },
  { name: "Operations", count: 36, color: "#8B5CF6" },
  { name: "Customer Success", count: 28, color: "#10B981" },
  { name: "Finance", count: 22, color: "#F59E0B" },
  { name: "Khác", count: 18, color: "#94A3B8" },
];

export const ATTENDANCE_TODAY = [
  { label: "Đúng giờ", value: 198, color: "#10B981" },
  { label: "Đi muộn", value: 14, color: "#F59E0B" },
  { label: "Đang nghỉ", value: 7, color: "#8B5CF6" },
  { label: "Chưa chấm", value: 29, color: "#CBD5E1" },
];

export const ATTENDANCE_TREND = {
  week: {
    labels: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
    attend: [92, 94, 91, 96, 93, 88, 0],
    late: [4, 3, 6, 2, 5, 3, 0],
  },
  month: {
    labels: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"],
    attend: [88, 86, 89, 91, 90, 87, 92, 88, 94, 91, 93, 92],
    late: [8, 9, 7, 6, 6, 8, 5, 6, 4, 5, 4, 5],
  },
};

export const PENDING_LEAVES = [
  { name: "Trần Minh Anh", initials: "MA", code: "EMP-0142", type: "Nghỉ phép năm", duration: "3 ngày", range: "12/06 → 14/06", submitted: "28/05 · 09:12" },
  { name: "Nguyễn Văn Bảo", initials: "VB", code: "EMP-0089", type: "Nghỉ phép năm", duration: "5 ngày", range: "10/06 → 14/06", submitted: "28/05 · 08:40" },
  { name: "Phạm Thu Hà", initials: "TH", code: "EMP-0207", type: "Nghỉ ốm", duration: "1 ngày", range: "28/05", submitted: "28/05 · 07:55" },
  { name: "Lê Khánh Duy", initials: "KD", code: "EMP-0156", type: "Việc riêng", duration: "0.5 ngày", range: "30/05 sáng", submitted: "27/05 · 16:20" },
  { name: "Đỗ Thanh Tùng", initials: "TT", code: "EMP-0073", type: "Nghỉ phép năm", duration: "2 ngày", range: "04/06 → 05/06", submitted: "27/05 · 14:08" },
];

export const UPCOMING_LEAVES = [
  { name: "Nguyễn Lan Anh", initials: "LA", code: "EMP-0024", type: "Nghỉ phép năm", range: "30/05 → 02/06", duration: "4 ngày", relative: "Sau 2 ngày" },
  { name: "Trần Đức Bình", initials: "DB", code: "EMP-0091", type: "Nghỉ phép năm", range: "03/06 → 07/06", duration: "5 ngày", relative: "Sau 6 ngày" },
  { name: "Mai Hoài Phương", initials: "HP", code: "EMP-0188", type: "Nghỉ thai sản", range: "10/06 → 30/09", duration: "112 ngày", relative: "Sau 13 ngày" },
  { name: "Lê Quang Vũ", initials: "QV", code: "EMP-0202", type: "Việc riêng", range: "12/06", duration: "1 ngày", relative: "Sau 15 ngày" },
];

export const PAYROLL = {
  period: "2026-05",
  status: "Đang xử lý",
  total: "3,2B",
  computedRatio: 0.86,
  headcount: 248,
  payDate: "31/05/2026",
  breakdown: [
    { label: "Salary Base", value: "2,1B" },
    { label: "Bonuses", value: "320M" },
    { label: "Overtime Pay", value: "220M" },
    { label: "Deductions", value: "−460M", tone: "neg" as const },
  ],
};

export const PERFORMERS = [
  { rank: 1, name: "Phan Quỳnh Trang", initials: "QT", code: "EMP-0011", role: "Sales Lead", dept: "Sales", score: 96 },
  { rank: 2, name: "Bùi Trọng Hải", initials: "TH", code: "EMP-0034", role: "Senior Engineer", dept: "Engineering", score: 94 },
  { rank: 3, name: "Vũ Ngọc Linh", initials: "NL", code: "EMP-0067", role: "Product Designer", dept: "Design", score: 92 },
  { rank: 4, name: "Hoàng Văn Sơn", initials: "VS", code: "EMP-0102", role: "Customer Success", dept: "CS", score: 91 },
  { rank: 5, name: "Đào Minh Châu", initials: "MC", code: "EMP-0145", role: "Marketing Manager", dept: "Marketing", score: 90 },
];

export const ACTIVITIES = [
  { who: "Hệ thống", what: "đã tính lương kỳ", target: "2026-05", when: "5 phút trước", icon: "Wallet" },
  { who: "Đức Hiếu", what: "đã phê duyệt đơn nghỉ phép của", target: "Trần Minh Anh", when: "12 phút trước", icon: "Check" },
  { who: "Mai Lan", what: "đã tạo nhân viên mới", target: "EMP-0249 · Trần Đức Thiện", when: "1 giờ trước", icon: "UserPlus" },
  { who: "Quỳnh Trang", what: "đã gửi đơn xin nghỉ phép", target: "Tháng 6 · 3 ngày", when: "2 giờ trước", icon: "CalendarDays" },
  { who: "Hệ thống", what: "phát hiện đi muộn ở phòng ban", target: "Engineering · 4 người", when: "3 giờ trước", icon: "Clock" },
  { who: "Đức Hiếu", what: "đã cập nhật hồ sơ của", target: "EMP-0142", when: "5 giờ trước", icon: "Pencil" },
  { who: "Mai Lan", what: "đã gửi email onboarding cho", target: "Trần Đức Thiện", when: "Hôm qua", icon: "Send" },
];
