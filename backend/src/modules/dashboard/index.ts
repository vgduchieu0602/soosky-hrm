// API công khai của module Dashboard.
// Chỉ những symbol export ở đây mới truy cập được từ các module khác.

export { createDashboardHttpRouter } from "@modules/dashboard/adapters/driver/http";
export type { DashboardHttpUseCases } from "@modules/dashboard/adapters/driver/http";
