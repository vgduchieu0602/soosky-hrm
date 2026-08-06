// API công khai của module Department.
// Chỉ những symbol export ở đây mới truy cập được từ các module khác.

export { createDepartmentHttpRouter } from "@modules/department/adapters/driver/http";
export type { DepartmentHttpUseCases } from "@modules/department/adapters/driver/http";
export { createDepartmentDirectory } from "@modules/department/composition";
export type { DepartmentDirectory } from "@modules/department/composition";
export { createDepartmentNameDirectory } from "@modules/department/composition";
export type { DepartmentNameDirectory } from "@modules/department/composition";
