// API công khai của module Setting.
// Chỉ những symbol export ở đây mới truy cập được từ các module khác.

export { createSettingHttpRouter } from "@modules/setting/adapters/driver/http";
export type { SettingHttpUseCases } from "@modules/setting/adapters/driver/http";
